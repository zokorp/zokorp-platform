import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSiteOriginFromRequest } from "@/lib/site-origin";
import { requireMlopsContext } from "@/lib/mlops-auth";
import { getStripeClient } from "@/lib/stripe";

const schema = z.object({
  organizationSlug: z.string().trim().min(2),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const context = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.ADMIN,
    });

    if (!context.organization.stripeCustomerId) {
      return NextResponse.json({ error: "No billing profile found for this organization." }, { status: 404 });
    }

    const origin = getSiteOriginFromRequest(request);

    const portalSession = await getStripeClient().billingPortal.sessions.create({
      customer: context.organization.stripeCustomerId,
      return_url: `${origin}/mlops/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to create portal session" }, { status: 500 });
  }
}
