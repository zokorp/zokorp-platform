import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { requireMlopsContext } from "@/lib/mlops-auth";
import { getSiteOriginFromRequest } from "@/lib/site-origin";
import { getStripeClient } from "@/lib/stripe";

const schema = z.object({
  organizationSlug: z.string().trim().min(2),
  billingInterval: z.enum(["monthly", "annual"]),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid billing request." }, { status: 400 });
    }

    const env = getEnv();

    const priceId =
      parsed.data.billingInterval === "monthly"
        ? env.STRIPE_PRICE_ID_MLOPS_STARTER_MONTHLY
        : env.STRIPE_PRICE_ID_MLOPS_STARTER_ANNUAL;

    if (!priceId) {
      return NextResponse.json(
        { error: "MLOps billing is not configured yet." },
        { status: 503 },
      );
    }

    const context = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.ADMIN,
    });

    let stripeCustomerId = context.organization.stripeCustomerId ?? context.user.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await getStripeClient().customers.create({
        email: context.user.email ?? undefined,
        name: context.organization.name,
        metadata: {
          userId: context.user.id,
          organizationId: context.organization.id,
        },
      });

      stripeCustomerId = customer.id;

      await db.$transaction([
        db.organization.update({
          where: {
            id: context.organization.id,
          },
          data: {
            stripeCustomerId,
          },
        }),
        db.user.update({
          where: {
            id: context.user.id,
          },
          data: {
            stripeCustomerId,
          },
        }),
      ]);
    }

    const origin = getSiteOriginFromRequest(request);

    const session = await getStripeClient().checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/mlops/settings/billing?checkout=success`,
      cancel_url: `${origin}/mlops/settings/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        organizationId: context.organization.id,
        organizationSlug: context.organization.slug,
        initiatedByUserId: context.user.id,
        checkoutPurpose: "mlops_subscription",
      },
    });

    await db.auditLog.create({
      data: {
        userId: context.user.id,
        organizationId: context.organization.id,
        action: "mlops.billing_checkout_session_created",
        metadataJson: {
          stripeCheckoutSessionId: session.id,
          interval: parsed.data.billingInterval,
          stripePriceId: priceId,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to start checkout" }, { status: 500 });
  }
}
