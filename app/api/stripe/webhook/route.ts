import { EntitlementStatus, PriceKind } from "@prisma/client";
import Stripe from "stripe";

import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";

function activeFromSubscriptionStatus(status: Stripe.Subscription.Status): EntitlementStatus {
  if (status === "active" || status === "trialing" || status === "past_due") {
    return EntitlementStatus.ACTIVE;
  }

  return EntitlementStatus.EXPIRED;
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Missing webhook signature", { status: 400 });
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
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const productId = session.metadata?.productId;
        const priceId = session.metadata?.priceId;

        if (!userId || !productId || !priceId) {
          break;
        }

        const [user, price] = await Promise.all([
          db.user.findUnique({ where: { id: userId } }),
          db.price.findUnique({ where: { id: priceId } }),
        ]);

        if (!user || !price) {
          break;
        }

        if (typeof session.customer === "string" && user.stripeCustomerId !== session.customer) {
          await db.user.update({
            where: { id: user.id },
            data: { stripeCustomerId: session.customer },
          });
        }

        if (price.kind === PriceKind.SUBSCRIPTION) {
          let validUntil: Date | undefined;
          if (typeof session.subscription === "string") {
            try {
              const subscription = await getStripeClient().subscriptions.retrieve(
                session.subscription,
              );
              const periodEnd = (
                subscription as Stripe.Subscription & { current_period_end?: number }
              ).current_period_end;
              validUntil = periodEnd ? new Date(periodEnd * 1000) : undefined;
            } catch (error) {
              console.error("Failed to fetch subscription during webhook fulfillment", error);
            }
          }

          await db.entitlement.upsert({
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
          await db.entitlement.upsert({
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
              remainingUses: price.creditsGranted,
            },
            update: {
              status: EntitlementStatus.ACTIVE,
              remainingUses: {
                increment: price.creditsGranted,
              },
            },
          });
        }

        await db.auditLog.create({
          data: {
            userId,
            action: "billing.checkout_completed",
            metadataJson: {
              stripeCheckoutSessionId: session.id,
              stripePriceId: price.stripePriceId,
              mode: session.mode,
            },
          },
        });

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

        break;
      }

      default:
        break;
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Webhook processing failed", error);
    return new Response("Webhook handler failed", { status: 500 });
  }
}
