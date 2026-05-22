import Stripe from "stripe";

import { createInternalAuditLog, methodNotAllowedJson, NO_STORE_HEADERS } from "@/lib/internal-route";
import { getStripeClient } from "@/lib/stripe";
import { dispatchStripeWebhookEvent } from "@/lib/stripe-webhook-handlers";
import { recordStripeWebhookEvent } from "@/lib/stripe-webhook-events";

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

    await dispatchStripeWebhookEvent(event);

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
