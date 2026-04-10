import { randomUUID } from "node:crypto";

import { Prisma, type ToolRun } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildArchitectureReviewCtaLinks } from "@/lib/architecture-review/cta-links";
import { buildArchitectureReviewEmailContent, buildMailtoUrl } from "@/lib/architecture-review/email";
import { createEmlToken } from "@/lib/architecture-review/eml-token";
import { calculateLeadScore } from "@/lib/architecture-review/lead";
import {
  buildArchitecturePrivacyDeliveryIdempotencyKey,
  buildArchitecturePrivacyInteractionEventId,
  buildArchitecturePrivacySourceRecordKey,
  ensureArchitectureReviewLead,
  findArchitecturePrivacyFingerprint,
} from "@/lib/architecture-review/privacy-context";
import { loadArchitectureEstimateSnapshot } from "@/lib/architecture-review/rule-catalog";
import { sendArchitectureReviewEmail } from "@/lib/architecture-review/sender";
import { summarizeTopIssues } from "@/lib/architecture-review/report";
import { architectureReviewPrivacyEmailSchema } from "@/lib/architecture-review/types";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { buildEmailPreferenceLinks } from "@/lib/email-preferences";
import { recordEstimateCompanion } from "@/lib/estimate-companions";
import { isFreeToolAccessError, requireVerifiedFreeToolAccess } from "@/lib/free-tool-access";
import { jsonNoStore } from "@/lib/internal-route";
import { ensureLeadInteraction, recordLeadEvent } from "@/lib/privacy-leads";
import { requireSameOrigin } from "@/lib/request-origin";
import { estimateBandForRange, scoreBandForScore } from "@/lib/tool-consent";
import { claimToolRunDelivery, recordArchitectureReviewToolRun } from "@/lib/tool-runs";
import { syncZohoInvoiceEstimate } from "@/lib/zoho-invoice";
import { ensureLeadLogSchemaReady } from "@/lib/lead-log-schema";

export const runtime = "nodejs";

function emlSecret() {
  return process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function resolveAuthProvider(provider: string | null | undefined) {
  const normalized = provider?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "credentials") {
    return "password";
  }

  return normalized.slice(0, 60);
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBoolean(record: Record<string, unknown> | null, key: string) {
  return record?.[key] === true;
}

function readQuoteCompanion(record: Record<string, unknown> | null) {
  const status = readString(record, "status");
  const provider = readString(record, "provider");
  const estimateId = readString(record, "estimateId");
  const estimateNumber = readString(record, "estimateNumber");
  const error = readString(record, "error");

  if (
    status !== "created" &&
    status !== "failed" &&
    status !== "not_configured"
  ) {
    return null;
  }

  if (provider !== "zoho-invoice" && provider !== null) {
    return null;
  }

  return {
    status,
    provider,
    estimateId,
    estimateNumber,
    error,
  };
}

function buildStoredPrivacyEmailResponse(toolRun: ToolRun | null) {
  if (!toolRun) {
    return null;
  }

  const metadata = asRecord(toolRun.metadataJson);
  const deliveryResult = asRecord(metadata?.deliveryResult);
  const storedStatus = readString(deliveryResult, "status");
  const requestId = readString(deliveryResult, "requestId") ?? null;
  const estimateReferenceCode =
    readString(deliveryResult, "estimateReferenceCode") ?? toolRun.estimateReferenceCode ?? null;
  const quoteCompanion = readQuoteCompanion(asRecord(deliveryResult?.quoteCompanion));

  if (storedStatus === "sent" || toolRun.deliveryStatus === "sent") {
    return {
      status: "sent" as const,
      requestId: requestId ?? randomUUID(),
      reused: readBoolean(deliveryResult, "reused") || true,
      estimateReferenceCode: estimateReferenceCode ?? undefined,
      quoteCompanion: quoteCompanion ?? undefined,
    };
  }

  if (storedStatus === "fallback" || toolRun.deliveryStatus === "fallback") {
    return {
      status: "fallback" as const,
      requestId: requestId ?? randomUUID(),
      reused: readBoolean(deliveryResult, "reused") || true,
      reason: readString(deliveryResult, "reason") ?? undefined,
      mailtoUrl: readString(deliveryResult, "mailtoUrl") ?? undefined,
      emlDownloadToken: readString(deliveryResult, "emlDownloadToken") ?? undefined,
      estimateReferenceCode: estimateReferenceCode ?? undefined,
      quoteCompanion: quoteCompanion ?? undefined,
    };
  }

  if (toolRun.deliveryStatus === "delivery-processing") {
    return {
      status: "processing" as const,
      requestId: requestId ?? randomUUID(),
      reused: true,
    };
  }

  return null;
}

async function recordPrivacyEmailAudit(input: {
  userId: string;
  requestId: string;
  toolRunId: string;
  deliveryState: string;
  sourceRecordKey?: string | null;
  reused?: boolean;
  provider?: string | null;
  estimateReferenceCode?: string | null;
  quoteCompanionStatus?: string | null;
  reason?: string | null;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: "tool.architecture_review_privacy_delivery",
        metadataJson: {
          requestId: input.requestId,
          toolRunId: input.toolRunId,
          deliveryState: input.deliveryState,
          sourceRecordKey: input.sourceRecordKey ?? null,
          reused: input.reused ?? false,
          provider: input.provider ?? null,
          estimateReferenceCode: input.estimateReferenceCode ?? null,
          quoteCompanionStatus: input.quoteCompanionStatus ?? null,
          reason: input.reason ?? null,
        },
      },
    });
  } catch (error) {
    console.error("Failed to persist privacy email audit log", {
      requestId: input.requestId,
      error,
    });
  }
}

async function findLatestAccountProvider(userId: string) {
  try {
    const latestAccount = await db.account.findFirst({
      where: { userId },
      select: { provider: true },
      orderBy: { id: "desc" },
    });
    return resolveAuthProvider(latestAccount?.provider);
  } catch (error) {
    if (!isSchemaDriftError(error)) {
      throw error;
    }

    return null;
  }
}

async function createPrivacyLeadLog(input: {
  userId: string;
  userEmail: string;
  userName: string | null;
  report: z.infer<typeof architectureReviewPrivacyEmailSchema>["report"];
  allowCrmFollowUp: boolean;
}) {
  const leadSchemaReady = await ensureLeadLogSchemaReady();
  if (!leadSchemaReady) {
    return null;
  }

  const authProvider = await findLatestAccountProvider(input.userId);

  try {
    const existing = await db.leadLog.findFirst({
      where: {
        userId: input.userId,
        userEmail: input.userEmail,
        architectureProvider: input.report.provider,
        overallScore: input.report.overallScore,
        analysisConfidence: input.report.analysisConfidence,
        quoteTier: input.report.quoteTier,
        topIssues: summarizeTopIssues(input.report.findings) || "none",
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
    });

    if (existing) {
      return existing;
    }

    return await db.leadLog.create({
      data: {
        userId: input.userId,
        userEmail: input.userEmail,
        userName: input.userName,
        architectureProvider: input.report.provider,
        authProvider,
        overallScore: input.report.overallScore,
        analysisConfidence: input.report.analysisConfidence,
        quoteTier: input.report.quoteTier,
        topIssues: summarizeTopIssues(input.report.findings) || "none",
        inputParagraph: null,
        reportJson: Prisma.JsonNull,
        leadScore: calculateLeadScore({
          overallScore: input.report.overallScore,
          userEmail: input.userEmail,
          analysisConfidence: input.report.analysisConfidence,
          quoteTier: input.report.quoteTier,
          submissionContext: null,
        }),
        leadStage: "New Review",
        workdriveUploadStatus: "not_requested",
        emailDeliveryMode: "pending",
        saveForFollowUp: false,
        allowCrmFollowUp: input.allowCrmFollowUp,
        zohoSyncNeedsUpdate: input.allowCrmFollowUp,
      },
    });
  } catch (error) {
    if (!isSchemaDriftError(error)) {
      throw error;
    }

    return db.leadLog.create({
      data: {
        userId: input.userId,
        userEmail: input.userEmail,
        architectureProvider: input.report.provider,
        authProvider,
        overallScore: input.report.overallScore,
        topIssues: summarizeTopIssues(input.report.findings) || "none",
      },
    });
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();

  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      crossSiteResponse.headers.set("Cache-Control", "no-store");
      crossSiteResponse.headers.set("X-Request-Id", requestId);
      return crossSiteResponse;
    }

    const access = await requireVerifiedFreeToolAccess({
      toolName: "Architecture Diagram Reviewer",
    });
    const payload = architectureReviewPrivacyEmailSchema.parse(await request.json());
    const fingerprint = await findArchitecturePrivacyFingerprint({
      fingerprintHash: payload.submissionFingerprintHash,
      userId: access.user.id,
    });

    if (!fingerprint) {
      return jsonNoStore(
        {
          error: "Privacy-mode telemetry expired. Run the local review again before requesting email delivery.",
          requestId,
        },
        {
          status: 409,
          headers: {
            "X-Request-Id": requestId,
          },
        },
      );
    }

    const deliveryIdempotencyKey = buildArchitecturePrivacyDeliveryIdempotencyKey({
      userId: access.user.id,
      fingerprintId: fingerprint.id,
    });
    const deliveryClaim = await claimToolRunDelivery({
      toolRunId: payload.toolRunId,
      userId: access.user.id,
      toolSlug: "architecture-diagram-reviewer",
      from: ["local-email-pending", "local-only"],
      to: "delivery-processing",
    });

    if (deliveryClaim.state === "missing") {
      return jsonNoStore(
        {
          error: "Privacy-mode run record was not found. Run the local review again before requesting email delivery.",
          requestId,
        },
        {
          status: 409,
          headers: {
            "X-Request-Id": requestId,
          },
        },
      );
    }

    if (deliveryClaim.state !== "claimed") {
      const existingResult = buildStoredPrivacyEmailResponse(deliveryClaim.toolRun);

      if (existingResult) {
        await recordPrivacyEmailAudit({
          userId: access.user.id,
          requestId,
          toolRunId: payload.toolRunId,
          deliveryState: existingResult.status,
          reused: true,
          estimateReferenceCode:
            "estimateReferenceCode" in existingResult ? existingResult.estimateReferenceCode ?? null : null,
          reason: "reason" in existingResult ? existingResult.reason ?? null : null,
        });

        return jsonNoStore(
          existingResult,
          {
            status: existingResult.status === "processing" ? 202 : 200,
            headers: {
              "X-Request-Id": requestId,
            },
          },
        );
      }

      await recordPrivacyEmailAudit({
        userId: access.user.id,
        requestId,
        toolRunId: payload.toolRunId,
        deliveryState: "processing",
        reused: true,
      });

      return jsonNoStore(
        {
          status: "processing",
          requestId,
          reused: true,
        },
        {
          status: 202,
          headers: {
            "X-Request-Id": requestId,
          },
        },
      );
    }

    const report = {
      ...payload.report,
      userEmail: access.email,
    };
    const lead = await ensureArchitectureReviewLead({
      userId: access.user.id,
      email: access.email,
      name: access.user.name,
    });
    const sourceRecordKey = buildArchitecturePrivacySourceRecordKey(fingerprint.id);
    const ctaLinks = await buildArchitectureReviewCtaLinks(lead.id);
    const { snapshot: estimateSnapshot, auditUsage: estimateAuditUsage } = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: ctaLinks.bookArchitectureCallUrl,
    });
    const quoteCompanionResult =
      estimateSnapshot.policy.payableQuoteEnabled && estimateSnapshot.totalUsd > 0
        ? await syncZohoInvoiceEstimate({
            email: access.email,
            fullName: access.user.name ?? null,
            serviceLabel: `Architecture Diagram Reviewer (${report.provider.toUpperCase()})`,
            referenceNumber: estimateSnapshot.referenceCode,
            notes: [
              `Score: ${report.overallScore}/100`,
              `Confidence: ${report.analysisConfidence}`,
              `Work path: ${report.quoteTier}`,
              ...estimateSnapshot.lineItems.map(
                (lineItem) =>
                  `${lineItem.ruleId}: ${lineItem.serviceLineLabel} (${lineItem.amountUsd}, ${lineItem.estimatedHours}h)`,
              ),
            ],
            lineItems:
              estimateSnapshot.lineItems.length > 0
                ? estimateSnapshot.lineItems.map((lineItem) => ({
                    name: `${lineItem.ruleId} · ${lineItem.serviceLineLabel}`,
                    description: `${lineItem.publicFixSummary} Approx. ${lineItem.estimatedHours}h.`,
                    rate: lineItem.amountUsd,
                  }))
                : [
                    {
                      name: "Architecture remediation estimate",
                      description: `Architecture remediation follow-up for ${report.provider.toUpperCase()} findings.`,
                      rate: estimateSnapshot.totalUsd,
                    },
                  ],
          })
        : {
            ok: false as const,
            status: "not_configured" as const,
            error: "QUOTE_COMPANION_SKIPPED",
            referenceNumber: estimateSnapshot.referenceCode,
          };
    const quoteCompanion = quoteCompanionResult.ok
      ? {
          status: "created" as const,
          provider: "zoho-invoice" as const,
          estimateId: quoteCompanionResult.estimateId,
          estimateNumber: quoteCompanionResult.estimateNumber ?? quoteCompanionResult.referenceNumber,
        }
      : {
          status: quoteCompanionResult.status === "timeout" ? "failed" : quoteCompanionResult.status,
          provider: quoteCompanionResult.status === "not_configured" ? null : ("zoho-invoice" as const),
          estimateId:
            "estimateId" in quoteCompanionResult && quoteCompanionResult.estimateId
              ? quoteCompanionResult.estimateId
              : null,
          estimateNumber: null,
          error: quoteCompanionResult.error,
        };

    const leadLog = await createPrivacyLeadLog({
      userId: access.user.id,
      userEmail: access.email,
      userName: access.user.name ?? null,
      report,
      allowCrmFollowUp: payload.allowCrmFollowUp,
    });

    if (access.email) {
      try {
        await recordEstimateCompanion({
          userId: access.user.id,
          source: "architecture-review",
          sourceRecordKey,
          sourceLabel: `Architecture Diagram Reviewer (${report.provider.toUpperCase()})`,
          provider: quoteCompanion.provider,
          status: quoteCompanion.status,
          referenceCode: estimateSnapshot.referenceCode,
          customerEmail: access.email,
          customerName: access.user.name ?? null,
          amountUsd: estimateSnapshot.totalUsd,
          externalId: quoteCompanion.estimateId,
          externalNumber: quoteCompanion.estimateNumber ?? null,
          summary: `Architecture review score ${report.overallScore}/100.`,
          metadata: {
            provider: report.provider,
            score: report.overallScore,
            analysisConfidence: report.analysisConfidence,
            quoteTier: report.quoteTier,
            executionMode: "privacy",
            lineItems: estimateSnapshot.lineItems.map((lineItem) => ({
              ruleId: lineItem.ruleId,
              serviceLineLabel: lineItem.serviceLineLabel,
              amountUsd: lineItem.amountUsd,
              estimatedHours: lineItem.estimatedHours,
            })),
          },
        });
      } catch (error) {
        console.error("Failed to persist architecture privacy estimate companion", error);
      }
    }

    const emailContent = buildArchitectureReviewEmailContent(report, {
      ctaLinks: {
        bookArchitectureCallUrl: ctaLinks.bookArchitectureCallUrl,
      },
      estimateSnapshot,
      officialEstimateReference: quoteCompanion.status === "created" ? quoteCompanion.estimateNumber : null,
      emailPreferenceLinks: buildEmailPreferenceLinks({
        userId: access.user.id,
        email: access.email,
      }),
    });
    const sendResult = await sendArchitectureReviewEmail({
      to: access.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    if (leadLog) {
      try {
        await db.leadLog.update({
          where: { id: leadLog.id },
          data: {
            emailDeliveryMode: sendResult.ok ? "sent" : "fallback",
            leadStage: sendResult.ok ? "Email Sent" : "New Review",
            emailSentAt: sendResult.ok ? new Date() : null,
            zohoSyncNeedsUpdate: payload.allowCrmFollowUp,
          },
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }
      }
    }

    if (sendResult.ok) {
      await recordLeadEvent({
        leadId: lead.id,
        userId: access.user.id,
        aggregate: {
          source: "architecture-review",
          deliveryState: "sent",
          crmSyncState: payload.allowCrmFollowUp ? "pending" : "skipped",
          saveForFollowUp: false,
          allowCrmFollowUp: payload.allowCrmFollowUp,
          scoreBand: scoreBandForScore(report.overallScore),
          estimateBand: estimateBandForRange(estimateSnapshot.totalUsd, estimateSnapshot.totalUsd),
          recommendedEngagement: report.quoteTier,
          sourceRecordKey,
        },
      });

      await ensureLeadInteraction({
        leadId: lead.id,
        userId: access.user.id,
        source: "architecture-review",
        action: "delivery_sent",
        provider: sendResult.provider,
        externalEventId: buildArchitecturePrivacyInteractionEventId({
          fingerprintId: fingerprint.id,
          action: "delivery_sent",
        }),
        estimateReferenceCode: estimateSnapshot.referenceCode,
      });

      try {
        await recordArchitectureReviewToolRun({
          toolRunId: payload.toolRunId,
          userId: access.user.id,
          summary: `${report.provider.toUpperCase()} privacy review · ${report.overallScore}/100 · emailed`,
          sourceType: "privacy",
          sourceName: report.provider.toUpperCase(),
          score: report.overallScore,
          confidenceLabel: report.analysisConfidence,
          deliveryStatus: "sent",
          estimateAmountUsd: estimateSnapshot.totalUsd,
          estimateSla: estimateSnapshot.policy.headline,
          estimateReferenceCode: estimateSnapshot.referenceCode,
          report,
          metadata: {
            executionMode: "privacy",
            sourceRecordKey,
            submissionFingerprintHash: payload.submissionFingerprintHash,
            quoteTier: report.quoteTier,
            scoreBand: scoreBandForScore(report.overallScore),
            policyBand: estimateSnapshot.policy.band,
            allowCrmFollowUp: payload.allowCrmFollowUp,
            deliveryIdempotencyKey,
            quoteCompanionStatus: quoteCompanion.status,
            estimateLineItems: estimateAuditUsage,
            deliveryResult: {
              status: "sent",
              requestId,
              reused: false,
              estimateReferenceCode: estimateSnapshot.referenceCode,
              quoteCompanion,
            },
          },
        });
      } catch (toolRunError) {
        console.error("Failed to persist privacy email tool run", toolRunError);
      }

      await recordPrivacyEmailAudit({
        userId: access.user.id,
        requestId,
        toolRunId: payload.toolRunId,
        deliveryState: "sent",
        sourceRecordKey,
        provider: sendResult.provider,
        estimateReferenceCode: estimateSnapshot.referenceCode,
        quoteCompanionStatus: quoteCompanion.status,
      });

      return jsonNoStore(
        {
          status: "sent",
          requestId,
          reused: false,
          estimateReferenceCode: estimateSnapshot.referenceCode,
          quoteCompanion,
        },
        {
          headers: {
            "X-Request-Id": requestId,
          },
        },
      );
    }

    const mailtoUrl = buildMailtoUrl({
      to: access.email,
      subject: emailContent.subject,
      body: emailContent.text,
    });
    const secret = emlSecret();
    const emlDownloadToken =
      secret.length > 0
        ? createEmlToken(
            {
              to: access.email,
              subject: emailContent.subject,
              body: emailContent.text,
            },
            secret,
          )
        : null;

    await recordLeadEvent({
      leadId: lead.id,
      userId: access.user.id,
      aggregate: {
        source: "architecture-review",
        deliveryState: "fallback",
        crmSyncState: payload.allowCrmFollowUp ? "pending" : "skipped",
        saveForFollowUp: false,
        allowCrmFollowUp: payload.allowCrmFollowUp,
        scoreBand: scoreBandForScore(report.overallScore),
        estimateBand: estimateBandForRange(estimateSnapshot.totalUsd, estimateSnapshot.totalUsd),
        recommendedEngagement: report.quoteTier,
        sourceRecordKey,
      },
    });

    await ensureLeadInteraction({
      leadId: lead.id,
      userId: access.user.id,
      source: "architecture-review",
      action: "delivery_fallback",
      provider: sendResult.provider,
      externalEventId: buildArchitecturePrivacyInteractionEventId({
        fingerprintId: fingerprint.id,
        action: "delivery_fallback",
      }),
      estimateReferenceCode: estimateSnapshot.referenceCode,
    });

    try {
      await recordArchitectureReviewToolRun({
        toolRunId: payload.toolRunId,
        userId: access.user.id,
        summary: `${report.provider.toUpperCase()} privacy review · ${report.overallScore}/100 · fallback delivery`,
        sourceType: "privacy",
        sourceName: report.provider.toUpperCase(),
        score: report.overallScore,
        confidenceLabel: report.analysisConfidence,
        deliveryStatus: "fallback",
        estimateAmountUsd: estimateSnapshot.totalUsd,
        estimateSla: estimateSnapshot.policy.headline,
        estimateReferenceCode: estimateSnapshot.referenceCode,
        report,
        metadata: {
          executionMode: "privacy",
          sourceRecordKey,
          submissionFingerprintHash: payload.submissionFingerprintHash,
          quoteTier: report.quoteTier,
          scoreBand: scoreBandForScore(report.overallScore),
          policyBand: estimateSnapshot.policy.band,
          allowCrmFollowUp: payload.allowCrmFollowUp,
          deliveryIdempotencyKey,
          fallbackReason: sendResult.error ?? null,
          quoteCompanionStatus: quoteCompanion.status,
          estimateLineItems: estimateAuditUsage,
          deliveryResult: {
            status: "fallback",
            requestId,
            reused: false,
            reason: sendResult.error ?? "EMAIL_DELIVERY_FAILED",
            mailtoUrl,
            emlDownloadToken,
            estimateReferenceCode: estimateSnapshot.referenceCode,
            quoteCompanion,
          },
        },
      });
    } catch (toolRunError) {
      console.error("Failed to persist privacy email tool run", toolRunError);
    }

    await recordPrivacyEmailAudit({
      userId: access.user.id,
      requestId,
      toolRunId: payload.toolRunId,
      deliveryState: "fallback",
      sourceRecordKey,
      provider: sendResult.provider,
      estimateReferenceCode: estimateSnapshot.referenceCode,
      quoteCompanionStatus: quoteCompanion.status,
      reason: sendResult.error ?? "EMAIL_DELIVERY_FAILED",
    });

    return jsonNoStore(
      {
        status: "fallback",
        requestId,
        reused: false,
        reason: sendResult.error ?? "EMAIL_DELIVERY_FAILED",
        mailtoUrl,
        emlDownloadToken,
        estimateReferenceCode: estimateSnapshot.referenceCode,
        quoteCompanion,
      },
      {
        headers: {
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    if (isFreeToolAccessError(error)) {
      return jsonNoStore(
        {
          error: error.message,
          requestId,
        },
        {
          status: error.status,
          headers: {
            "X-Request-Id": requestId,
          },
        },
      );
    }

    console.error("architecture-review privacy email failed", { requestId, error });
    return NextResponse.json(
      {
        error: "Unable to deliver the privacy-mode architecture review email.",
        requestId,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  }
}
