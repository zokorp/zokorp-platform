import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { getSiteOriginFromRequest } from "@/lib/site-origin";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      return crossSiteResponse;
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
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
      return NextResponse.json(
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
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      if (!user.email) {
        return NextResponse.json({ error: "Account email is required for billing." }, { status: 400 });
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });

      customerId = customer.id;
      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "STRIPE_SECRET_KEY is missing") {
      return NextResponse.json(
        { error: "Billing portal setup is still in progress. Please try again shortly." },
        { status: 503 },
      );
    }

    console.error(error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
