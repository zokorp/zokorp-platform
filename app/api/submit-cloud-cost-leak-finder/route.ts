import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { sendToolResultEmail } from "@/lib/architecture-review/sender";
import {
  selectCloudCostLeakFinderFollowUpQuestions,
  validateCloudCostLeakFinderFollowUpAnswers,
} from "@/lib/cloud-cost-leak-finder/adaptive";
import { buildCloudCostLeakFinderEmailContent } from "@/lib/cloud-cost-leak-finder/email";
import { buildCloudCostLeakFinderReport } from "@/lib/cloud-cost-leak-finder/engine";
import {
  isAllowedCloudCostBusinessEmail,
  narrativeValidationMessage,
  normalizeCloudCostWebsite,
} from "@/lib/cloud-cost-leak-finder/input";
import { extractCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import {
  cloudCostLeakFinderAnswersSchema,
  cloudCostLeakFinderSubmissionResponseSchema,
  type FollowUpQuestionId,
  type CloudCostLeakFinderSubmissionResponse,
} from "@/lib/cloud-cost-leak-finder/types";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { upsertZohoLead } from "@/lib/zoho-crm";

export const runtime = "nodejs";

const RATE_LIMIT = 8;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function jsonResponse(body: CloudCostLeakFinderSubmissionResponse, requestId: string, status = 200) {
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
      key: `cloud-cost-leak-finder:${getRequestFingerprint(request)}`,
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
    const parsed = cloudCostLeakFinderAnswersSchema.safeParse(rawBody);

    if (!parsed.success) {
      return jsonResponse({ error: "Please complete the required fields and try again." }, requestId, 400);
    }

    const answers = {
      ...parsed.data,
      email: parsed.data.email.trim().toLowerCase(),
      website: normalizeCloudCostWebsite(parsed.data.website),
      narrativeInput: parsed.data.narrativeInput.trim(),
      billingSummaryInput: parsed.data.billingSummaryInput?.trim() ?? "",
    };

    if (!isAllowedCloudCostBusinessEmail(answers.email)) {
      return jsonResponse(
        { error: "Personal email domains are not allowed. Use your business email." },
        requestId,
        400,
      );
    }

    const narrativeError = narrativeValidationMessage(answers.narrativeInput);
    if (narrativeError) {
      return jsonResponse({ error: narrativeError }, requestId, 400);
    }

    const extractedSignals = extractCloudCostSignals(answers);
    const adaptiveQuestions = selectCloudCostLeakFinderFollowUpQuestions(extractedSignals);
    const adaptiveAnswers = Object.fromEntries(
      adaptiveQuestions
        .map((question) => [question.id, answers.adaptiveAnswers[question.id]])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    ) as Partial<Record<FollowUpQuestionId, string>>;
    const followUpError = validateCloudCostLeakFinderFollowUpAnswers(adaptiveQuestions, adaptiveAnswers);
    if (followUpError) {
      return jsonResponse({ error: followUpError }, requestId, 400);
    }

    const normalizedAnswers = {
      ...answers,
      adaptiveAnswers,
    };

    const report = buildCloudCostLeakFinderReport(normalizedAnswers);
    const user = await db.user.findUnique({
      where: { email: normalizedAnswers.email },
      select: { id: true },
    });

    const created = await db.cloudCostLeakFinderSubmission.create({
      data: {
        userId: user?.id ?? null,
        email: normalizedAnswers.email,
        fullName: normalizedAnswers.fullName,
        companyName: normalizedAnswers.companyName,
        roleTitle: normalizedAnswers.roleTitle,
        website: normalizedAnswers.website,
        primaryCloud: normalizedAnswers.primaryCloud,
        secondaryCloud: normalizedAnswers.secondaryCloud ?? null,
        narrativeInput: normalizedAnswers.narrativeInput,
        billingSummaryInput: normalizedAnswers.billingSummaryInput || null,
        extractedSignalsJson: report.extractedSignals,
        adaptiveAnswersJson: normalizedAnswers.adaptiveAnswers,
        wasteRiskScore: report.scores.wasteRiskScore,
        finopsMaturityScore: report.scores.finopsMaturityScore,
        savingsConfidenceScore: report.scores.savingsConfidenceScore,
        implementationComplexityScore: report.scores.implementationComplexityScore,
        roiPlausibilityScore: report.scores.roiPlausibilityScore,
        confidenceScore: report.scores.confidenceScore,
        likelyWasteCategoriesJson: report.likelyWasteCategories,
        savingsEstimateJson: report.savingsEstimate,
        findingsJson: report.topFindings,
        actionsJson: report.topActions,
        quoteJson: report.quote,
        crmSyncStatus: "pending",
        emailDeliveryStatus: "pending",
        source: "cloud-cost-leak-finder",
      },
    });

    const zohoDescription = [
      `Verdict: ${report.verdictHeadline}`,
      `MonthlySavings: ${report.savingsEstimate.estimatedMonthlySavingsRange}`,
      `WasteRisk: ${report.scores.wasteRiskScore}/100`,
      `FinOpsMaturity: ${report.scores.finopsMaturityScore}/100`,
      `PrimaryCloud: ${normalizedAnswers.primaryCloud}`,
      `SecondaryCloud: ${normalizedAnswers.secondaryCloud ?? "none"}`,
      `Engagement: ${report.quote.engagementType}`,
      `QuoteRange: ${report.quote.quoteLow}-${report.quote.quoteHigh}`,
      `Categories: ${report.likelyWasteCategories.join(",")}`,
    ]
      .filter(Boolean)
      .join("; ");

    const zohoResult = await upsertZohoLead({
      email: normalizedAnswers.email,
      fullName: normalizedAnswers.fullName,
      companyName: normalizedAnswers.companyName,
      website: normalizedAnswers.website,
      roleTitle: normalizedAnswers.roleTitle,
      leadSource: "ZoKorp Cloud Cost Leak Finder",
      description: zohoDescription,
    });

    const emailContent = buildCloudCostLeakFinderEmailContent({
      answers: normalizedAnswers,
      report,
    });
    const sendResult = await sendToolResultEmail({
      to: normalizedAnswers.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await db.cloudCostLeakFinderSubmission.update({
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
        action: "tool.cloud_cost_leak_finder_submit",
        metadataJson: {
          email: normalizedAnswers.email,
          companyName: normalizedAnswers.companyName,
          primaryCloud: normalizedAnswers.primaryCloud,
          verdictClass: report.verdictClass,
          quoteTier: report.quote.engagementType,
          wasteRiskScore: report.scores.wasteRiskScore,
          savingsRange: report.savingsEstimate.estimatedMonthlySavingsRange,
          emailStatus: sendResult.ok ? "sent" : "failed",
          crmSyncStatus:
            zohoResult.status === "success" || zohoResult.status === "duplicate"
              ? "synced"
              : zohoResult.status,
          requestId,
        },
      },
    });

    const responseBody = cloudCostLeakFinderSubmissionResponseSchema.parse({
      status: sendResult.ok ? "sent" : "fallback",
      verdictHeadline: report.verdictHeadline,
      savingsRangeLine:
        report.scores.savingsConfidenceScore >= 45
          ? `Likely savings range: ${report.savingsEstimate.estimatedMonthlySavingsRange} per month`
          : undefined,
      reason: sendResult.ok ? undefined : "Automated email delivery was unavailable. Please retry shortly.",
    });

    return jsonResponse(responseBody, requestId, 200);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Invalid submission payload." }, requestId, 400);
    }

    if (isSchemaDriftError(error)) {
      return jsonResponse(
        { error: "Cloud Cost Leak Finder is being enabled. Please retry shortly." },
        requestId,
        503,
      );
    }

    console.error("submit-cloud-cost-leak-finder failed", { requestId, error });
    return jsonResponse({ error: "Unable to submit the cost review right now." }, requestId, 500);
  }
}
