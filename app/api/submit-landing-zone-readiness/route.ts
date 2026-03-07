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

const FINGERPRINT_RATE_LIMIT = 8;
const FINGERPRINT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RATE_LIMIT = 4;
const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUEST_BODY_CHARS = 32_000;
const JSON_CONTENT_TYPE = "application/json";
const SUBMISSION_SOURCE = "landing-zone-readiness-checker";
const INVALID_CONTENT_TYPE = "INVALID_CONTENT_TYPE";
const INVALID_PAYLOAD = "INVALID_PAYLOAD";
const PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE";

type ZohoSyncStatus = "pending" | "synced" | "not_configured" | "failed";

function jsonResponse(body: LandingZoneReadinessSubmissionResponse, requestId: string, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
    },
  });
}

function contentTypeIsJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes(JSON_CONTENT_TYPE);
}

async function parseRequestBody(request: Request) {
  if (!contentTypeIsJson(request)) {
    throw new Error(INVALID_CONTENT_TYPE);
  }

  const rawBody = await request.text();
  if (!rawBody.trim()) {
    throw new Error(INVALID_PAYLOAD);
  }

  if (rawBody.length > MAX_REQUEST_BODY_CHARS) {
    throw new Error(PAYLOAD_TOO_LARGE);
  }

  return JSON.parse(rawBody) as unknown;
}

function deriveZohoSyncStatus(result: Awaited<ReturnType<typeof upsertZohoLead>>): ZohoSyncStatus {
  if (result.status === "success" || result.status === "duplicate") {
    return "synced";
  }

  if (result.status === "not_configured") {
    return "not_configured";
  }

  return "failed";
}

function buildZohoDescription(input: {
  answers: {
    primaryCloud: string;
    secondaryCloud?: string;
    biggestChallenge?: string;
  };
  report: ReturnType<typeof buildLandingZoneReadinessReport>;
}) {
  return [
    `Score: ${input.report.overallScore}/100`,
    `Maturity: ${input.report.maturityBand}`,
    `PrimaryCloud: ${input.answers.primaryCloud}`,
    `SecondaryCloud: ${input.answers.secondaryCloud ?? "none"}`,
    `QuoteTier: ${input.report.quote.quoteTier}`,
    `QuoteRange: ${input.report.quote.quoteLow}-${input.report.quote.quoteHigh}`,
    `EstimatedDays: ${input.report.quote.estimatedDaysLow}-${input.report.quote.estimatedDaysHigh}`,
    `Summary: ${input.report.summaryLine}`,
    input.answers.biggestChallenge ? `Challenge: ${input.answers.biggestChallenge}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    const limiter = await consumeRateLimit({
      key: `landing-zone-readiness:${getRequestFingerprint(request)}`,
      limit: FINGERPRINT_RATE_LIMIT,
      windowMs: FINGERPRINT_RATE_LIMIT_WINDOW_MS,
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

    const rawBody = await parseRequestBody(request);
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

    const emailLimiter = await consumeRateLimit({
      key: `landing-zone-readiness-email:${answers.email}`,
      limit: EMAIL_RATE_LIMIT,
      windowMs: EMAIL_RATE_LIMIT_WINDOW_MS,
    });

    if (!emailLimiter.allowed) {
      return NextResponse.json(
        { error: "Too many submissions were sent for this email. Please wait and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(emailLimiter.retryAfterSeconds),
            "X-Request-Id": requestId,
          },
        },
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
        source: SUBMISSION_SOURCE,
      },
    });

    const zohoResult = await upsertZohoLead({
      email: answers.email,
      fullName: answers.fullName,
      companyName: answers.companyName,
      website: answers.website,
      roleTitle: answers.roleTitle,
      leadSource: "ZoKorp Landing Zone Checker",
      description: buildZohoDescription({
        answers,
        report,
      }),
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
        crmSyncStatus: deriveZohoSyncStatus(zohoResult),
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
          crmSyncStatus: deriveZohoSyncStatus(zohoResult),
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
    if (error instanceof Error && error.message === INVALID_CONTENT_TYPE) {
      return jsonResponse({ error: "Submissions must be sent as JSON." }, requestId, 415);
    }

    if (error instanceof Error && error.message === PAYLOAD_TOO_LARGE) {
      return jsonResponse({ error: "Submission payload is too large." }, requestId, 413);
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Invalid submission payload." }, requestId, 400);
    }

    if (error instanceof Error && error.message === INVALID_PAYLOAD) {
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
