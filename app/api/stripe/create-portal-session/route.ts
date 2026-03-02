import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    if (!user.stripeCustomerId) {
      return NextResponse.json({ error: "No Stripe customer exists for this account" }, { status: 400 });
    }

    const stripe = getStripeClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error(error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
