import { EntitlementStatus, PriceKind, Prisma } from "@prisma/client";
import Stripe from "stripe";

import { effectiveCreditTierForPrice } from "@/lib/credit-tiers";
import { db } from "@/lib/db";
import { createInternalAuditLog, methodNotAllowedJson, NO_STORE_HEADERS } from "@/lib/internal-route";
import { getStripeClient } from "@/lib/stripe";

function activeFromSubscriptionStatus(status: Stripe.Subscription.Status): EntitlementStatus {
  if (status === "active" || status === "trialing" || status === "past_due") {
    return EntitlementStatus.ACTIVE;
  }

  return EntitlementStatus.EXPIRED;
}

function isDuplicateCheckoutFulfillmentError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("stripeCheckoutSessionId");
  }

  if (typeof target === "string") {
    return target.includes("stripeCheckoutSessionId");
  }

  return false;
}

function shouldFulfillCheckoutSession(input: {
  session: Stripe.Checkout.Session;
  priceKind: PriceKind;
  eventType: Stripe.Event["type"];
}) {
  if (input.priceKind === PriceKind.SUBSCRIPTION) {
    if (input.eventType === "checkout.session.async_payment_succeeded") {
      return true;
    }

    return (
      input.session.payment_status === "paid" || input.session.payment_status === "no_payment_required"
    );
  }

  return input.session.payment_status === "paid";
}

function textNoStore(body: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"]);

  return new Response(body, {
    ...init,
    headers,
  });
}

export function GET() {
  return methodNotAllowedJson();
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return textNoStore("Missing webhook signature", { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    console.error("Webhook signature verification failed", error);
    return textNoStore("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const productId = session.metadata?.productId;
        const priceId = session.metadata?.priceId;
        const checkoutSessionId = session.id;

        if (!userId || !productId || !priceId || !checkoutSessionId) {
          await createInternalAuditLog("billing.webhook_checkout_skipped", {
            stripeEventId: event.id,
            eventType: event.type,
            reason: "missing_checkout_metadata",
            stripeCheckoutSessionId: session.id,
          });
          break;
        }

        const [user, price] = await Promise.all([
          db.user.findUnique({ where: { id: userId } }),
          db.price.findUnique({
            where: { id: priceId },
            include: { product: { select: { slug: true } } },
          }),
        ]);

        if (!user || !price) {
          await createInternalAuditLog("billing.webhook_checkout_skipped", {
            stripeEventId: event.id,
            eventType: event.type,
            reason: "missing_db_record",
            stripeCheckoutSessionId: session.id,
          });
          break;
        }

        if (
          !shouldFulfillCheckoutSession({
            session,
            priceKind: price.kind,
            eventType: event.type,
          })
        ) {
          await createInternalAuditLog("billing.webhook_checkout_skipped", {
            stripeEventId: event.id,
            eventType: event.type,
            reason: "payment_not_ready",
            stripeCheckoutSessionId: session.id,
            paymentStatus: session.payment_status ?? "unknown",
          });
          break;
        }

        let validUntil: Date | undefined;
        if (price.kind === PriceKind.SUBSCRIPTION && typeof session.subscription === "string") {
          try {
            const subscription = await getStripeClient().subscriptions.retrieve(session.subscription);
            const periodEnd = (
              subscription as Stripe.Subscription & { current_period_end?: number }
            ).current_period_end;
            validUntil = periodEnd ? new Date(periodEnd * 1000) : undefined;
          } catch (error) {
            console.error("Failed to fetch subscription during webhook fulfillment", error);
          }
        }

        try {
          await db.$transaction(async (tx) => {
            await tx.checkoutFulfillment.create({
              data: {
                stripeCheckoutSessionId: checkoutSessionId,
                stripeEventId: event.id,
                userId,
                productId,
              },
            });

            if (typeof session.customer === "string" && user.stripeCustomerId !== session.customer) {
              await tx.user.update({
                where: { id: user.id },
                data: { stripeCustomerId: session.customer },
              });
            }

            if (price.kind === PriceKind.SUBSCRIPTION) {
              await tx.entitlement.upsert({
                where: {
                  userId_productId: {
                    userId,
                    productId,
                  },
                },
                create: {
                  userId,
                  productId,
                  status: EntitlementStatus.ACTIVE,
                  stripeSubscriptionId:
                    typeof session.subscription === "string" ? session.subscription : undefined,
                  validUntil,
                  remainingUses: 0,
                },
                update: {
                  status: EntitlementStatus.ACTIVE,
                  stripeSubscriptionId:
                    typeof session.subscription === "string" ? session.subscription : undefined,
                  validUntil,
                },
              });
            } else {
              const creditTier = effectiveCreditTierForPrice({
                creditTier: price.creditTier,
                amount: price.amount,
                product: { slug: price.product.slug },
              });

              await tx.creditBalance.upsert({
                where: {
                  userId_productId_tier: {
                    userId,
                    productId,
                    tier: creditTier,
                  },
                },
                create: {
                  userId,
                  productId,
                  tier: creditTier,
                  status: EntitlementStatus.ACTIVE,
                  remainingUses: price.creditsGranted,
                },
                update: {
                  status: EntitlementStatus.ACTIVE,
                  remainingUses: {
                    increment: price.creditsGranted,
                  },
                },
              });

              const aggregate = await tx.creditBalance.aggregate({
                where: {
                  userId,
                  productId,
                  status: EntitlementStatus.ACTIVE,
                },
                _sum: {
                  remainingUses: true,
                },
              });

              await tx.entitlement.upsert({
                where: {
                  userId_productId: {
                    userId,
                    productId,
                  },
                },
                create: {
                  userId,
                  productId,
                  status: EntitlementStatus.ACTIVE,
                  remainingUses: aggregate._sum.remainingUses ?? 0,
                },
                update: {
                  status: EntitlementStatus.ACTIVE,
                  remainingUses: aggregate._sum.remainingUses ?? 0,
                },
              });
            }

            await tx.auditLog.create({
              data: {
                userId,
                action: "billing.checkout_completed",
                metadataJson: {
                  stripeCheckoutSessionId: session.id,
                  stripePriceId: price.stripePriceId,
                  mode: session.mode,
                  paymentStatus: session.payment_status,
                },
              },
            });
          });
        } catch (error) {
          if (isDuplicateCheckoutFulfillmentError(error)) {
            // Duplicate delivery for the same Checkout Session.
            await createInternalAuditLog("billing.webhook_checkout_duplicate", {
              stripeEventId: event.id,
              eventType: event.type,
              stripeCheckoutSessionId: session.id,
            });
            return textNoStore("ok", { status: 200 });
          }

          throw error;
        }

        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number })
          .current_period_end;

        await db.entitlement.updateMany({
          where: {
            stripeSubscriptionId: subscription.id,
          },
          data: {
            status: activeFromSubscriptionStatus(subscription.status),
            validUntil: periodEnd ? new Date(periodEnd * 1000) : null,
          },
        });

        await createInternalAuditLog("billing.subscription_sync_applied", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          validUntil: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        });

        break;
      }

      default:
        break;
    }

    return textNoStore("ok", { status: 200 });
  } catch (error) {
    await createInternalAuditLog("billing.webhook_failed", {
      stripeEventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : "Unknown webhook failure",
    });
    console.error("Webhook processing failed", error);
    return textNoStore("Webhook handler failed", { status: 500 });
  }
}
