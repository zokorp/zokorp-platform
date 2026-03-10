import { PriceKind } from "@prisma/client";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonNoStore, methodNotAllowedJson } from "@/lib/internal-route";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { getSiteOriginFromRequest } from "@/lib/site-origin";
import { isCheckoutEnabledStripePriceId } from "@/lib/stripe-price-id";
import { ensureStripeCustomerForUser, StripeCustomerBindingError } from "@/lib/stripe-customer";
import { getStripeClient } from "@/lib/stripe";

const schema = z.object({
  priceId: z.string().min(1),
  productSlug: z.string().min(1),
});

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
        { error: "Billing setup is still in progress. Please try again shortly." },
        { status: 503 },
      );
    }

    const user = await requireUser();
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return jsonNoStore({ error: "Invalid request body" }, { status: 400 });
    }

    if (!isCheckoutEnabledStripePriceId(parsed.data.priceId)) {
      return jsonNoStore({ error: "Price not available" }, { status: 404 });
    }

    const limiter = await consumeRateLimit({
      key: `checkout:${user.id}:${parsed.data.productSlug}:${getRequestFingerprint(request)}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return jsonNoStore(
        { error: "Too many checkout attempts. Please wait a few minutes and retry." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const price = await db.price.findUnique({
      where: { stripePriceId: parsed.data.priceId },
      include: { product: true },
    });

    if (!price || !price.active || !price.product.active || price.product.slug !== parsed.data.productSlug) {
      return jsonNoStore({ error: "Price not available" }, { status: 404 });
    }

    if (!isCheckoutEnabledStripePriceId(price.stripePriceId)) {
      return jsonNoStore({ error: "Price not available" }, { status: 404 });
    }

    const stripe = getStripeClient();
    const customerId = await ensureStripeCustomerForUser(user, stripe);
    const origin = getSiteOriginFromRequest(request);
    const isSubscription = price.kind === PriceKind.SUBSCRIPTION;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: price.stripePriceId, quantity: 1 }],
      success_url: `${origin}/software/${price.product.slug}?checkout=success`,
      cancel_url: `${origin}/software/${price.product.slug}?checkout=cancelled`,
      metadata: {
        userId: user.id,
        productId: price.productId,
        priceId: price.id,
        productSlug: price.product.slug,
        creditsGranted: String(price.creditsGranted),
      },
      allow_promotion_codes: true,
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "billing.checkout_session_created",
        metadataJson: {
          stripeCheckoutSessionId: session.id,
          stripePriceId: price.stripePriceId,
          productSlug: price.product.slug,
          mode: session.mode,
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
        { error: "Billing setup is still in progress. Please try again shortly." },
        { status: 503 },
      );
    }

    console.error(error);
    return jsonNoStore({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
