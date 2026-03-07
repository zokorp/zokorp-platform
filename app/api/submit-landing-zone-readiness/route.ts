import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { sendToolResultEmail } from "@/lib/architecture-review/sender";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { buildLandingZoneReadinessEmailContent } from "@/lib/landing-zone-readiness/email";
import { buildLandingZoneReadinessReport } from "@/lib/landing-zone-readiness/engine";
import { isAllowedLandingZoneBusinessEmail, normalizeLandingZoneWebsite } from "@/lib/landing-zone-readiness/input";
import {
  landingZoneReadinessAnswersSchema,
  type LandingZoneReadinessSubmissionResponse,
} from "@/lib/landing-zone-readiness/types";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { upsertZohoLead } from "@/lib/zoho-crm";

export const runtime = "nodejs";

const RATE_LIMIT = 8;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function jsonResponse(body: LandingZoneReadinessSubmissionResponse, requestId: string, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    const limiter = consumeRateLimit({
      key: `landing-zone-readiness:${getRequestFingerprint(request)}`,
      limit: RATE_LIMIT,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });

    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
            "X-Request-Id": requestId,
          },
        },
      );
    }

    const rawBody = await request.json();
    const parsed = landingZoneReadinessAnswersSchema.safeParse(rawBody);

    if (!parsed.success) {
      return jsonResponse({ error: "Please complete the required fields and try again." }, requestId, 400);
    }

    const answers = {
      ...parsed.data,
      email: parsed.data.email.trim().toLowerCase(),
      website: normalizeLandingZoneWebsite(parsed.data.website),
      biggestChallenge: parsed.data.biggestChallenge?.trim() ?? "",
    };

    if (!isAllowedLandingZoneBusinessEmail(answers.email)) {
      return jsonResponse(
        { error: "Personal email domains are not allowed. Use your business email." },
        requestId,
        400,
      );
    }

    const report = buildLandingZoneReadinessReport(answers);
    const user = await db.user.findUnique({
      where: { email: answers.email },
      select: { id: true },
    });

    const created = await db.landingZoneReadinessSubmission.create({
      data: {
        userId: user?.id ?? null,
        email: answers.email,
        fullName: answers.fullName,
        companyName: answers.companyName,
        roleTitle: answers.roleTitle,
        website: answers.website,
        primaryCloud: answers.primaryCloud,
        secondaryCloud: answers.secondaryCloud ?? null,
        answersJson: answers,
        scoreOverall: report.overallScore,
        scoreByCategoryJson: report.categoryScores,
        maturityBand: report.maturityBand,
        findingsJson: report.findings,
        quoteJson: report.quote,
        freeTextChallenge: answers.biggestChallenge || null,
        crmSyncStatus: "pending",
        emailDeliveryStatus: "pending",
        source: "landing-zone-readiness-checker",
      },
    });

    const zohoDescription = [
      `Score: ${report.overallScore}/100`,
      `Maturity: ${report.maturityBand}`,
      `PrimaryCloud: ${answers.primaryCloud}`,
      `SecondaryCloud: ${answers.secondaryCloud ?? "none"}`,
      `QuoteTier: ${report.quote.quoteTier}`,
      `QuoteRange: ${report.quote.quoteLow}-${report.quote.quoteHigh}`,
      `Summary: ${report.summaryLine}`,
      answers.biggestChallenge ? `Challenge: ${answers.biggestChallenge}` : null,
    ]
      .filter(Boolean)
      .join("; ");

    const zohoResult = await upsertZohoLead({
      email: answers.email,
      fullName: answers.fullName,
      companyName: answers.companyName,
      website: answers.website,
      roleTitle: answers.roleTitle,
      leadSource: "ZoKorp Landing Zone Checker",
      description: zohoDescription,
    });

    const emailContent = buildLandingZoneReadinessEmailContent({ answers, report });
    const sendResult = await sendToolResultEmail({
      to: answers.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await db.landingZoneReadinessSubmission.update({
      where: { id: created.id },
      data: {
        crmSyncStatus:
          zohoResult.status === "success" || zohoResult.status === "duplicate"
            ? "synced"
            : zohoResult.status === "not_configured"
              ? "not_configured"
              : "failed",
        zohoRecordId: "recordId" in zohoResult ? (zohoResult.recordId ?? null) : null,
        zohoSyncError: zohoResult.error ?? null,
        emailDeliveryStatus: sendResult.ok ? "sent" : "failed",
      },
    });

    await db.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action: "tool.landing_zone_readiness_submit",
        metadataJson: {
          email: answers.email,
          primaryCloud: answers.primaryCloud,
          secondaryCloud: answers.secondaryCloud ?? null,
          companyName: answers.companyName,
          score: report.overallScore,
          maturityBand: report.maturityBand,
          quoteTier: report.quote.quoteTier,
          emailStatus: sendResult.ok ? "sent" : "failed",
          crmSyncStatus:
            zohoResult.status === "success" || zohoResult.status === "duplicate"
              ? "synced"
              : zohoResult.status,
          requestId,
        },
      },
    });

    if (!sendResult.ok) {
      return jsonResponse(
        {
          status: "fallback",
          overallScore: report.overallScore,
          maturityBand: report.maturityBand,
          quoteTier: report.quote.quoteTier,
          reason: "Automated email delivery was unavailable. Please retry shortly.",
        },
        requestId,
        200,
      );
    }

    return jsonResponse(
      {
        status: "sent",
        overallScore: report.overallScore,
        maturityBand: report.maturityBand,
        quoteTier: report.quote.quoteTier,
      },
      requestId,
      200,
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Invalid submission payload." }, requestId, 400);
    }

    if (isSchemaDriftError(error)) {
      return jsonResponse(
        { error: "Landing Zone Readiness Checker is being enabled. Please retry shortly." },
        requestId,
        503,
      );
    }

    console.error("submit-landing-zone-readiness failed", { requestId, error });
    return jsonResponse({ error: "Unable to submit the readiness check right now." }, requestId, 500);
  }
}
