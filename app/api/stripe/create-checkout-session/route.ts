import { NextResponse } from "next/server";
import { PriceKind } from "@prisma/client";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";

const schema = z.object({
  priceId: z.string().min(1),
  productSlug: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const price = await db.price.findUnique({
      where: { stripePriceId: parsed.data.priceId },
      include: { product: true },
    });

    if (!price || !price.active || !price.product.active || price.product.slug !== parsed.data.productSlug) {
      return NextResponse.json({ error: "Price not available" }, { status: 404 });
    }

    const stripe = getStripeClient();

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId && !user.email) {
      return NextResponse.json(
        { error: "Account must have an email before checkout can start." },
        { status: 400 },
      );
    }

    if (!stripeCustomerId && user.email) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });

      stripeCustomerId = customer.id;

      await db.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    const customerId = stripeCustomerId ?? undefined;
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const isSubscription = price.kind === PriceKind.SUBSCRIPTION;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: !customerId ? user.email ?? undefined : undefined,
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

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error(error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
