import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonNoStore, methodNotAllowedJson } from "@/lib/internal-route";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { getSiteOriginFromRequest } from "@/lib/site-origin";
import { ensureStripeCustomerForUser, StripeCustomerBindingError } from "@/lib/stripe-customer";
import { getStripeClient } from "@/lib/stripe";

export function GET() {
  return methodNotAllowedJson();
}

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      return crossSiteResponse;
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return jsonNoStore(
        { error: "Billing portal setup is still in progress. Please try again shortly." },
        { status: 503 },
      );
    }

    const user = await requireUser();
    const limiter = await consumeRateLimit({
      key: `billing-portal:${user.id}:${getRequestFingerprint(request)}`,
      limit: 15,
      windowMs: 10 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return jsonNoStore(
        { error: "Too many billing portal requests. Please wait and retry." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const stripe = getStripeClient();
    const origin = getSiteOriginFromRequest(request);
    const customerId = await ensureStripeCustomerForUser(user, stripe);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "billing.portal_session_created",
        metadataJson: {
          stripePortalSessionId: session.id,
          stripeCustomerId: customerId,
        },
      },
    });

    return jsonNoStore({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof StripeCustomerBindingError) {
      return jsonNoStore({ error: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message === "STRIPE_SECRET_KEY is missing") {
      return jsonNoStore(
        { error: "Billing portal setup is still in progress. Please try again shortly." },
        { status: 503 },
      );
    }

    console.error(error);
    return jsonNoStore({ error: "Failed to create portal session" }, { status: 500 });
  }
}
