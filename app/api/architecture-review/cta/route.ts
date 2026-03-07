import { NextResponse } from "next/server";

import { verifyArchitectureReviewCtaToken } from "@/lib/architecture-review/cta-token";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";

export const runtime = "nodejs";

function ctaSecret() {
  return process.env.ARCH_REVIEW_CTA_SECRET ?? process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function destinationForType(ctaType: "book-call" | "remediation-plan") {
  if (ctaType === "book-call") {
    return process.env.ARCH_REVIEW_BOOK_CALL_URL ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://zokorp-web.vercel.app"}/services#service-request`;
  }

  return (
    process.env.ARCH_REVIEW_REMEDIATION_PLAN_URL ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://zokorp-web.vercel.app"}/services#service-request`
  );
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

    try {
      await db.leadLog.update({
        where: { id: payload.leadId },
        data: {
          leadStage: payload.ctaType === "book-call" ? "Call Booked" : "CTA Clicked",
          ctaClicks: {
            increment: 1,
          },
          lastCtaClickedAt: new Date(),
          zohoSyncNeedsUpdate: true,
        },
      });
    } catch (error) {
      if (!isSchemaDriftError(error)) {
        throw error;
      }
    }

    return NextResponse.redirect(destinationForType(payload.ctaType), { status: 302 });
  } catch {
    return NextResponse.redirect(destinationForType("book-call"), { status: 302 });
  }
}
