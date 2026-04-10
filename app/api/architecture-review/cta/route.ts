import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { verifyArchitectureReviewCtaToken } from "@/lib/architecture-review/cta-token";
import { buildCalendlyBookingUrl } from "@/lib/calendly";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { buildEstimateReferenceCode, ensureLeadInteraction, upsertLead } from "@/lib/privacy-leads";
import { getMarketingSiteUrl } from "@/lib/site";

export const runtime = "nodejs";

function ctaSecret() {
  return process.env.ARCH_REVIEW_CTA_SECRET ?? process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function destinationForType(
  ctaType: "book-call" | "remediation-plan",
  estimateReferenceCode?: string | null,
) {
  if (ctaType === "book-call") {
    const destination = process.env.ARCH_REVIEW_BOOK_CALL_URL ?? `${getMarketingSiteUrl()}/services#service-request`;

    return buildCalendlyBookingUrl({
      baseUrl: destination,
      estimateReferenceCode,
    });
  }

  return (
    process.env.ARCH_REVIEW_REMEDIATION_PLAN_URL ?? `${getMarketingSiteUrl()}/services#service-request`
  );
}

function buildArchitectureReviewCtaEventId(token: string) {
  return `architecture-review:cta:${createHash("sha256").update(token).digest("hex")}`;
}

export async function GET(request: Request) {
  const secret = ctaSecret();
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("token") ?? "";

  if (!secret || !token) {
    return NextResponse.redirect(destinationForType("book-call"), { status: 302 });
  }

  try {
    const payload = verifyArchitectureReviewCtaToken(token, secret);
    let estimateReferenceCode: string | null = null;

    try {
      const updatedLeadLog = await db.leadLog.update({
        where: { id: payload.leadId },
        select: {
          id: true,
          userId: true,
          userEmail: true,
          userName: true,
        },
        data: {
          leadStage: "CTA Clicked",
          ctaClicks: {
            increment: 1,
          },
          lastCtaClickedAt: new Date(),
        },
      });

      const lead = await upsertLead({
        userId: updatedLeadLog.userId,
        email: updatedLeadLog.userEmail,
        name: updatedLeadLog.userName,
      });

      estimateReferenceCode = buildEstimateReferenceCode({
        source: "architecture-review",
        email: updatedLeadLog.userEmail,
      });

      await ensureLeadInteraction({
        leadId: lead.id,
        userId: updatedLeadLog.userId,
        source: "architecture-review",
        action: "cta_clicked",
        provider: payload.ctaType === "book-call" ? "calendly" : null,
        externalEventId: buildArchitectureReviewCtaEventId(token),
        estimateReferenceCode,
      });
    } catch (error) {
      if (!isSchemaDriftError(error)) {
        throw error;
      }
    }

    return NextResponse.redirect(destinationForType(payload.ctaType, estimateReferenceCode), { status: 302 });
  } catch {
    return NextResponse.redirect(destinationForType("book-call"), { status: 302 });
  }
}
