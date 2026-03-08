import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { sendToolResultEmail } from "@/lib/architecture-review/sender";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { buildAiDeciderEmailContent } from "@/lib/ai-decider/email";
import { buildAiDeciderReport } from "@/lib/ai-decider/engine";
import { isAllowedAiDeciderBusinessEmail, normalizeAiDeciderWebsite } from "@/lib/ai-decider/input";
import { buildAiDeciderQuestions, validateAiDeciderAnswers } from "@/lib/ai-decider/questions";
import { extractAiDeciderSignals } from "@/lib/ai-decider/signals";
import {
  aiDeciderSubmissionRequestSchema,
  type AiDeciderSubmissionResponse,
} from "@/lib/ai-decider/types";
import { isFreeToolAccessError, requireVerifiedFreeToolAccess } from "@/lib/free-tool-access";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { upsertZohoLead } from "@/lib/zoho-crm";

export const runtime = "nodejs";

const RATE_LIMIT = 6;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function jsonResponse(body: AiDeciderSubmissionResponse, requestId: string, status = 200) {
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
    const limiter = await consumeRateLimit({
      key: `ai-decider:${getRequestFingerprint(request)}`,
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
    const parsed = aiDeciderSubmissionRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return jsonResponse({ error: "Please complete the required fields and try again." }, requestId, 400);
    }

    const submission = {
      ...parsed.data,
      email: parsed.data.email.trim().toLowerCase(),
      website: normalizeAiDeciderWebsite(parsed.data.website ?? ""),
      narrativeInput: parsed.data.narrativeInput.trim(),
    };

    if (!isAllowedAiDeciderBusinessEmail(submission.email)) {
      return jsonResponse(
        { error: "Personal email domains are not allowed. Use your business email." },
        requestId,
        400,
      );
    }

    const access = await requireVerifiedFreeToolAccess({
      toolName: "AI Decider",
      submittedEmail: submission.email,
    });

    submission.email = access.email;

    const signals = extractAiDeciderSignals(submission.narrativeInput);
    const questions = buildAiDeciderQuestions(signals);
    const answerValidation = validateAiDeciderAnswers(questions, submission.answers);
    if (!answerValidation.ok) {
      return jsonResponse({ error: answerValidation.error }, requestId, 400);
    }

    const report = buildAiDeciderReport({
      lead: submission,
      answers: submission.answers,
    });

    const created = await db.aiDeciderSubmission.create({
      data: {
        userId: access.user.id,
        email: submission.email,
        fullName: submission.fullName,
        companyName: submission.companyName,
        roleTitle: submission.roleTitle,
        website: submission.website || null,
        narrativeInput: submission.narrativeInput,
        signalsJson: toInputJson(report.signals),
        answersJson: toInputJson(submission.answers),
        scoresJson: toInputJson(report.scores),
        recommendation: report.recommendation,
        findingsJson: toInputJson(report.findings),
        blockersJson: toInputJson(report.blockers),
        quoteJson: toInputJson(report.quote),
        verdictHeadline: report.verdictHeadline,
        verdictLine: report.verdictLine,
        summaryParagraph: report.summaryParagraph,
        crmSyncStatus: "pending",
        emailDeliveryStatus: "pending",
        source: "ai-decider",
      },
    });

    const zohoDescription = [
      `Verdict: ${report.verdictLine}`,
      `Recommendation: ${report.recommendation}`,
      `AI fit: ${report.scores.aiFitScore}/100`,
      `Automation fit: ${report.scores.automationFitScore}/100`,
      `Data readiness: ${report.scores.dataReadinessScore}/100`,
      `Implementation risk: ${report.scores.implementationRiskScore}/100`,
      `Quote: ${report.quote.engagementType} ${report.quote.priceLow}-${report.quote.priceHigh}`,
      `Narrative: ${submission.narrativeInput.slice(0, 400)}`,
    ].join("; ");

    const zohoResult = await upsertZohoLead({
      email: submission.email,
      fullName: submission.fullName,
      companyName: submission.companyName,
      website: submission.website || undefined,
      roleTitle: submission.roleTitle,
      leadSource: "ZoKorp AI Decider",
      description: zohoDescription,
    });

    const emailContent = buildAiDeciderEmailContent({
      lead: submission,
      report,
    });
    const sendResult = await sendToolResultEmail({
      to: submission.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await db.aiDeciderSubmission.update({
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
        userId: access.user.id,
        action: "tool.ai_decider_submit",
        metadataJson: {
          email: submission.email,
          companyName: submission.companyName,
          recommendation: report.recommendation,
          verdictLine: report.verdictLine,
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
          verdictLine: report.verdictLine,
          recommendation: report.recommendation,
          reason: "Automated email delivery was unavailable. Please retry shortly.",
        },
        requestId,
        200,
      );
    }

    return jsonResponse(
      {
        status: "sent",
        verdictLine: report.verdictLine,
        recommendation: report.recommendation,
      },
      requestId,
      200,
    );
  } catch (error) {
    if (isFreeToolAccessError(error)) {
      return jsonResponse({ error: error.message }, requestId, error.status);
    }

    if (error instanceof SyntaxError) {
      return jsonResponse({ error: "Invalid submission payload." }, requestId, 400);
    }

    if (isSchemaDriftError(error)) {
      return jsonResponse(
        { error: "AI Decider is being enabled. Please retry shortly." },
        requestId,
        503,
      );
    }

    console.error("submit-ai-decider failed", { requestId, error });
    return jsonResponse({ error: "Unable to submit AI Decider right now." }, requestId, 500);
  }
}
