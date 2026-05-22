import { CreditLedgerReason, EntitlementStatus, PriceKind, Prisma } from "@prisma/client";
import Stripe from "stripe";

import { recordCreditLedgerEntry } from "@/lib/credit-ledger";
import { effectiveCreditTierForPrice } from "@/lib/credit-tiers";
import { db } from "@/lib/db";
import { createInternalAuditLog, methodNotAllowedJson, NO_STORE_HEADERS } from "@/lib/internal-route";
import { getStripeClient } from "@/lib/stripe";
import { recordStripeWebhookEvent } from "@/lib/stripe-webhook-events";

function activeFromSubscriptionStatus(status: Stripe.Subscription.Status): EntitlementStatus {
  if (status === "active" || status === "trialing" || status === "past_due") {
    return EntitlementStatus.ACTIVE;
  }

  return EntitlementStatus.EXPIRED;
}

// Stripe SDK v20 does not expose `Charge.invoice` on the default type because the
// field is "expandable". The runtime value is always either a string ID, an Invoice
// object, or null — narrow to the ID safely.
function getChargeInvoiceId(charge: Stripe.Charge | Stripe.Response<Stripe.Charge>): string | null {
  const value = (charge as { invoice?: unknown }).invoice;
  return typeof value === "string" ? value : null;
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
    await recordStripeWebhookEvent({
      event,
      processingStatus: "received",
      metadata: {
        eventCreatedAt:
          typeof event.created === "number" && Number.isFinite(event.created)
            ? new Date(event.created * 1000).toISOString()
            : null,
      },
    });

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const checkoutType = session.metadata?.checkoutType;
        const userId = session.metadata?.userId;
        const productId = session.metadata?.productId;
        const priceId = session.metadata?.priceId;
        const checkoutSessionId = session.id;

        if (checkoutType === "architecture-remediation") {
          if (!userId || !productId || !checkoutSessionId) {
            await createInternalAuditLog("billing.webhook_checkout_skipped", {
              stripeEventId: event.id,
              eventType: event.type,
              reason: "missing_architecture_checkout_metadata",
              stripeCheckoutSessionId: session.id,
            });
            await recordStripeWebhookEvent({
              event,
              processingStatus: "ignored",
              metadata: {
                reason: "missing_architecture_checkout_metadata",
                paymentStatus: session.payment_status ?? null,
              },
            });
            break;
          }

          if (session.payment_status !== "paid") {
            await createInternalAuditLog("billing.webhook_checkout_skipped", {
              stripeEventId: event.id,
              eventType: event.type,
              reason: "architecture_payment_not_ready",
              stripeCheckoutSessionId: session.id,
              paymentStatus: session.payment_status ?? "unknown",
            });
            await recordStripeWebhookEvent({
              event,
              processingStatus: "ignored",
              metadata: {
                reason: "architecture_payment_not_ready",
                paymentStatus: session.payment_status ?? null,
              },
            });
            break;
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

              await tx.auditLog.create({
                data: {
                  userId,
                  action: "billing.architecture_checkout_completed",
                  metadataJson: {
                    stripeCheckoutSessionId: session.id,
                    stripeEventId: event.id,
                    jobId: session.metadata?.jobId ?? null,
                    estimateReferenceCode: session.metadata?.estimateReferenceCode ?? null,
                    amountTotal: session.amount_total ?? null,
                    currency: session.currency ?? null,
                  },
                },
              });
            });
          } catch (error) {
            if (!isDuplicateCheckoutFulfillmentError(error)) {
              throw error;
            }
          }

          await recordStripeWebhookEvent({
            event,
            processingStatus: "processed",
            metadata: {
              fulfillmentMode: "architecture-remediation",
              paymentStatus: session.payment_status ?? null,
              amountTotal: session.amount_total ?? null,
            },
          });
          break;
        }

        if (!userId || !productId || !priceId || !checkoutSessionId) {
          await createInternalAuditLog("billing.webhook_checkout_skipped", {
            stripeEventId: event.id,
            eventType: event.type,
            reason: "missing_checkout_metadata",
            stripeCheckoutSessionId: session.id,
          });
          await recordStripeWebhookEvent({
            event,
            processingStatus: "ignored",
            metadata: {
              reason: "missing_checkout_metadata",
              paymentStatus: session.payment_status ?? null,
            },
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
          await recordStripeWebhookEvent({
            event,
            processingStatus: "ignored",
            metadata: {
              reason: "missing_db_record",
              paymentStatus: session.payment_status ?? null,
            },
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
          await recordStripeWebhookEvent({
            event,
            processingStatus: "ignored",
            metadata: {
              reason: "payment_not_ready",
              paymentStatus: session.payment_status ?? null,
            },
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

              const wallet = await tx.creditBalance.upsert({
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
                select: {
                  remainingUses: true,
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

              await recordCreditLedgerEntry({
                client: tx,
                userId,
                productId,
                tier: creditTier,
                delta: price.creditsGranted,
                balanceAfter: wallet.remainingUses,
                reason: CreditLedgerReason.PURCHASE,
                source: "stripe-checkout",
                sourceRecordKey: checkoutSessionId,
                metadata: {
                  stripeEventId: event.id,
                  stripePriceId: price.stripePriceId,
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
            await recordStripeWebhookEvent({
              event,
              processingStatus: "ignored",
              metadata: {
                reason: "duplicate_checkout_fulfillment",
                paymentStatus: session.payment_status ?? null,
              },
            });
            return textNoStore("ok", { status: 200 });
          }

          throw error;
        }

        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            fulfillment: "checkout_completed",
            paymentStatus: session.payment_status ?? null,
            userId,
            productId,
            priceId,
          },
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number })
          .current_period_end;

        // updateMany is a no-op if the entitlement does not exist yet. The
        // checkout.session.completed handler is the source of truth for first
        // creation; subscription.created fires before checkout.completed.
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
        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            subscriptionStatus: subscription.status,
            validUntil: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          },
        });

        break;
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        await createInternalAuditLog("billing.subscription_trial_will_end", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeSubscriptionId: subscription.id,
          trialEnd: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
        });
        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            trialEnd: subscription.trial_end ?? null,
          },
        });

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await createInternalAuditLog("billing.checkout_async_payment_failed", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeCheckoutSessionId: session.id,
          paymentStatus: session.payment_status ?? null,
          customerEmail: session.customer_details?.email ?? null,
        });
        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            paymentStatus: session.payment_status ?? null,
          },
        });

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const invoiceSubscription = invoice.subscription;
        const subscriptionId =
          typeof invoiceSubscription === "string" ? invoiceSubscription : null;

        // Sync entitlement validUntil from the renewed subscription.
        if (subscriptionId) {
          try {
            const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
            const periodEnd = (subscription as Stripe.Subscription & {
              current_period_end?: number;
            }).current_period_end;
            await db.entitlement.updateMany({
              where: {
                stripeSubscriptionId: subscriptionId,
              },
              data: {
                status: activeFromSubscriptionStatus(subscription.status),
                validUntil: periodEnd ? new Date(periodEnd * 1000) : null,
              },
            });
          } catch (error) {
            console.error("Failed to sync subscription on invoice.paid", error);
          }
        }

        await createInternalAuditLog("billing.invoice_paid", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
          stripeSubscriptionId: subscriptionId,
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
        });
        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            invoiceStatus: invoice.status ?? null,
            amountPaid: invoice.amount_paid,
            currency: invoice.currency,
          },
        });

        break;
      }

      case "invoice.finalized": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const invoiceSubscription = invoice.subscription;
        await createInternalAuditLog("billing.invoice_finalized", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
          stripeSubscriptionId:
            typeof invoiceSubscription === "string" ? invoiceSubscription : null,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
        });
        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            invoiceStatus: invoice.status ?? null,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
          },
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const invoiceSubscription = invoice.subscription;

        await createInternalAuditLog("billing.invoice_payment_failed", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeInvoiceId: invoice.id,
          stripeCustomerId: typeof invoice.customer === "string" ? invoice.customer : null,
          stripeSubscriptionId: typeof invoiceSubscription === "string" ? invoiceSubscription : null,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count,
        });
        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            invoiceStatus: invoice.status ?? null,
            attemptCount: invoice.attempt_count,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
          },
        });

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await createInternalAuditLog("billing.payment_intent_failed", {
          stripeEventId: event.id,
          eventType: event.type,
          stripePaymentIntentId: paymentIntent.id,
          stripeCustomerId:
            typeof paymentIntent.customer === "string" ? paymentIntent.customer : null,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          lastPaymentError: paymentIntent.last_payment_error?.message ?? null,
        });
        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
          },
        });

        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const stripeCustomerId =
          typeof charge.customer === "string" ? charge.customer : null;
        const stripeInvoiceId =
          getChargeInvoiceId(charge);

        await createInternalAuditLog("billing.charge_refunded", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeChargeId: charge.id,
          stripeCustomerId,
          stripeInvoiceId,
          amountRefunded: charge.amount_refunded,
          amountCaptured: charge.amount_captured,
          currency: charge.currency,
        });

        // Attempt to revoke the entitlement tied to this charge.
        // Subscription charges: invoice -> subscription -> entitlement.
        // One-time charges: log for operator review (mapping requires a manual decision
        // because the credit may already have been consumed and the run completed).
        let revocationOutcome:
          | "subscription_entitlement_revoked"
          | "subscription_entitlement_not_found"
          | "manual_review_required"
          | "skipped_no_customer"
          | "skipped_lookup_failed" = "skipped_no_customer";

        if (stripeCustomerId) {
          const user = await db.user.findUnique({
            where: { stripeCustomerId },
            select: { id: true },
          });

          if (user) {
            if (stripeInvoiceId) {
              try {
                const invoice = (await getStripeClient().invoices.retrieve(
                  stripeInvoiceId,
                )) as Stripe.Invoice & { subscription?: string | null };
                const subscriptionId =
                  typeof invoice.subscription === "string" ? invoice.subscription : null;

                if (subscriptionId) {
                  const revoked = await db.entitlement.updateMany({
                    where: {
                      stripeSubscriptionId: subscriptionId,
                      status: EntitlementStatus.ACTIVE,
                    },
                    data: {
                      status: EntitlementStatus.REVOKED,
                    },
                  });

                  if (revoked.count > 0) {
                    revocationOutcome = "subscription_entitlement_revoked";
                    await db.auditLog.create({
                      data: {
                        userId: user.id,
                        action: "billing.entitlement_revoked_for_refund",
                        metadataJson: {
                          stripeChargeId: charge.id,
                          stripeSubscriptionId: subscriptionId,
                          stripeInvoiceId,
                          amountRefunded: charge.amount_refunded,
                          currency: charge.currency,
                        },
                      },
                    });
                  } else {
                    revocationOutcome = "subscription_entitlement_not_found";
                  }
                } else {
                  revocationOutcome = "manual_review_required";
                  await db.auditLog.create({
                    data: {
                      userId: user.id,
                      action: "billing.refund_manual_review_required",
                      metadataJson: {
                        stripeChargeId: charge.id,
                        stripeInvoiceId,
                        amountRefunded: charge.amount_refunded,
                        note: "Invoice has no subscription; one-time invoice — operator should confirm credit was not consumed.",
                      },
                    },
                  });
                }
              } catch (error) {
                console.error("Failed to revoke entitlement on refund", error);
                revocationOutcome = "skipped_lookup_failed";
              }
            } else {
              // One-time charge (Checkout-driven credit purchase). The credit
              // may have been used already. Flag for operator decision.
              revocationOutcome = "manual_review_required";
              await db.auditLog.create({
                data: {
                  userId: user.id,
                  action: "billing.refund_manual_review_required",
                  metadataJson: {
                    stripeChargeId: charge.id,
                    amountRefunded: charge.amount_refunded,
                    currency: charge.currency,
                    note: "One-time charge refund — operator should manually revoke unused credit balance.",
                  },
                },
              });
            }
          }
        }

        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            refundStatus: "refunded",
            amountRefunded: charge.amount_refunded,
            currency: charge.currency,
            revocationOutcome,
          },
        });

        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const stripeChargeId =
          typeof dispute.charge === "string" ? dispute.charge : null;

        await createInternalAuditLog("billing.dispute_created", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeDisputeId: dispute.id,
          stripeChargeId,
          amount: dispute.amount,
          currency: dispute.currency,
          reason: dispute.reason ?? null,
          status: dispute.status,
        });

        // Freeze the entitlement until the dispute is closed. Restore on win.
        let freezeOutcome:
          | "subscription_entitlement_frozen"
          | "subscription_entitlement_not_found"
          | "manual_review_required"
          | "skipped_no_charge"
          | "skipped_lookup_failed" = "skipped_no_charge";

        if (stripeChargeId) {
          try {
            const charge = await getStripeClient().charges.retrieve(stripeChargeId);
            const stripeCustomerId =
              typeof charge.customer === "string" ? charge.customer : null;
            const stripeInvoiceId =
              getChargeInvoiceId(charge);

            if (stripeCustomerId) {
              const user = await db.user.findUnique({
                where: { stripeCustomerId },
                select: { id: true },
              });

              if (user) {
                if (stripeInvoiceId) {
                  const invoice = (await getStripeClient().invoices.retrieve(
                    stripeInvoiceId,
                  )) as Stripe.Invoice & { subscription?: string | null };
                  const subscriptionId =
                    typeof invoice.subscription === "string"
                      ? invoice.subscription
                      : null;

                  if (subscriptionId) {
                    const frozen = await db.entitlement.updateMany({
                      where: {
                        stripeSubscriptionId: subscriptionId,
                        status: EntitlementStatus.ACTIVE,
                      },
                      data: {
                        status: EntitlementStatus.REVOKED,
                      },
                    });

                    freezeOutcome =
                      frozen.count > 0
                        ? "subscription_entitlement_frozen"
                        : "subscription_entitlement_not_found";

                    if (frozen.count > 0) {
                      await db.auditLog.create({
                        data: {
                          userId: user.id,
                          action: "billing.entitlement_frozen_for_dispute",
                          metadataJson: {
                            stripeDisputeId: dispute.id,
                            stripeChargeId,
                            stripeSubscriptionId: subscriptionId,
                            disputeReason: dispute.reason ?? null,
                            note: "Entitlement frozen pending dispute resolution. Restored on charge.dispute.closed if won.",
                          },
                        },
                      });
                    }
                  } else {
                    freezeOutcome = "manual_review_required";
                  }
                } else {
                  freezeOutcome = "manual_review_required";
                  await db.auditLog.create({
                    data: {
                      userId: user.id,
                      action: "billing.dispute_manual_review_required",
                      metadataJson: {
                        stripeDisputeId: dispute.id,
                        stripeChargeId,
                        note: "One-time charge dispute — operator should review whether to freeze credit balance.",
                      },
                    },
                  });
                }
              }
            }
          } catch (error) {
            console.error("Failed to freeze entitlement on dispute", error);
            freezeOutcome = "skipped_lookup_failed";
          }
        }

        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            disputeStatus: dispute.status,
            disputeReason: dispute.reason ?? null,
            amount: dispute.amount,
            currency: dispute.currency,
            freezeOutcome,
          },
        });

        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const stripeChargeId =
          typeof dispute.charge === "string" ? dispute.charge : null;

        await createInternalAuditLog("billing.dispute_closed", {
          stripeEventId: event.id,
          eventType: event.type,
          stripeDisputeId: dispute.id,
          stripeChargeId,
          status: dispute.status,
          reason: dispute.reason ?? null,
          amount: dispute.amount,
          currency: dispute.currency,
        });

        // If the merchant won the dispute, restore the entitlement that was
        // frozen by charge.dispute.created. If lost, the refund flow already
        // revoked the entitlement; nothing to do here.
        let restoreOutcome:
          | "subscription_entitlement_restored"
          | "subscription_entitlement_not_found"
          | "dispute_lost_no_action"
          | "skipped_no_charge"
          | "skipped_lookup_failed" = "skipped_no_charge";

        if (dispute.status !== "won") {
          restoreOutcome = "dispute_lost_no_action";
        } else if (stripeChargeId) {
          try {
            const charge = await getStripeClient().charges.retrieve(stripeChargeId);
            const stripeCustomerId =
              typeof charge.customer === "string" ? charge.customer : null;
            const stripeInvoiceId =
              getChargeInvoiceId(charge);

            if (stripeCustomerId && stripeInvoiceId) {
              const user = await db.user.findUnique({
                where: { stripeCustomerId },
                select: { id: true },
              });

              if (user) {
                const invoice = (await getStripeClient().invoices.retrieve(
                  stripeInvoiceId,
                )) as Stripe.Invoice & { subscription?: string | null };
                const subscriptionId =
                  typeof invoice.subscription === "string"
                    ? invoice.subscription
                    : null;

                if (subscriptionId) {
                  // Only restore if the Stripe subscription is still active.
                  const subscription =
                    await getStripeClient().subscriptions.retrieve(subscriptionId);
                  const subscriptionActive =
                    subscription.status === "active" ||
                    subscription.status === "trialing" ||
                    subscription.status === "past_due";

                  if (subscriptionActive) {
                    const restored = await db.entitlement.updateMany({
                      where: {
                        stripeSubscriptionId: subscriptionId,
                        status: EntitlementStatus.REVOKED,
                      },
                      data: {
                        status: EntitlementStatus.ACTIVE,
                      },
                    });

                    restoreOutcome =
                      restored.count > 0
                        ? "subscription_entitlement_restored"
                        : "subscription_entitlement_not_found";

                    if (restored.count > 0) {
                      await db.auditLog.create({
                        data: {
                          userId: user.id,
                          action: "billing.entitlement_restored_after_dispute_won",
                          metadataJson: {
                            stripeDisputeId: dispute.id,
                            stripeChargeId,
                            stripeSubscriptionId: subscriptionId,
                          },
                        },
                      });
                    }
                  } else {
                    restoreOutcome = "subscription_entitlement_not_found";
                  }
                }
              }
            }
          } catch (error) {
            console.error("Failed to restore entitlement after dispute won", error);
            restoreOutcome = "skipped_lookup_failed";
          }
        }

        await recordStripeWebhookEvent({
          event,
          processingStatus: "processed",
          metadata: {
            disputeStatus: dispute.status,
            disputeReason: dispute.reason ?? null,
            restoreOutcome,
          },
        });

        break;
      }

      default:
        await recordStripeWebhookEvent({
          event,
          processingStatus: "ignored",
          metadata: {
            reason: "unsupported_event",
          },
        });
        break;
    }

    return textNoStore("ok", { status: 200 });
  } catch (error) {
    await recordStripeWebhookEvent({
      event,
      processingStatus: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown webhook failure",
      metadata: {
        failedAt: new Date().toISOString(),
      },
    });
    await createInternalAuditLog("billing.webhook_failed", {
      stripeEventId: event.id,
      eventType: event.type,
      error: error instanceof Error ? error.message : "Unknown webhook failure",
    });
    console.error("Webhook processing failed", error);
    return textNoStore("Webhook handler failed", { status: 500 });
  }
}
