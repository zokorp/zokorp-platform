import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { validatorTierForProfile } from "@/lib/credit-tiers";
import { db } from "@/lib/db";
import { jsonNoStore } from "@/lib/internal-route";
import { decrementUsesAtomically, requireEntitlement } from "@/lib/entitlements";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { maxUploadBytes, isAllowedFileType } from "@/lib/security";
import { buildUniqueEstimateReferenceCode } from "@/lib/privacy-leads";
import { parseValidatorInput } from "@/lib/validator";
import { buildValidatorEmailContent, buildValidatorEstimate, sendValidatorResultsEmail } from "@/lib/validator-delivery";
import { getValidatorTargetOptions, resolveValidatorTargetContext } from "@/lib/validator-library";
import { VALIDATION_PROFILES } from "@/lib/zokorp-validator-engine";
import { syncZohoInvoiceEstimate } from "@/lib/zoho-invoice";
import { recordEstimateCompanion } from "@/lib/estimate-companions";
import { CreditTier, EntitlementStatus } from "@prisma/client";

export const runtime = "nodejs";

const formSchema = z.object({
  validationProfile: z.enum(VALIDATION_PROFILES),
  validationTargetId: z.string().max(160).optional(),
  additionalContext: z.string().max(1200).optional(),
});

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      crossSiteResponse.headers.set("Cache-Control", "no-store");
      return crossSiteResponse;
    }

    const user = await requireUser();
    const limiter = await consumeRateLimit({
      key: `validator:${user.id}:${getRequestFingerprint(request)}`,
      limit: 25,
      windowMs: 60 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return jsonNoStore(
        { error: "Rate limit reached. Please wait before running another validation." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const rawProfile = formData.get("validationProfile");
    const rawTargetId = formData.get("validationTargetId");
    const rawContext = formData.get("additionalContext");
    const parsedForm = formSchema.safeParse({
      validationProfile: typeof rawProfile === "string" ? rawProfile : undefined,
      validationTargetId: typeof rawTargetId === "string" && rawTargetId.trim() ? rawTargetId : undefined,
      additionalContext: typeof rawContext === "string" && rawContext.trim() ? rawContext : undefined,
    });

    if (!(file instanceof File)) {
      return jsonNoStore({ error: "File is required" }, { status: 400 });
    }

    if (!parsedForm.success) {
      return jsonNoStore(
        { error: "Validation profile is required." },
        { status: 400 },
      );
    }

    const creditTier = validatorTierForProfile(parsedForm.data.validationProfile);

    const entitlementAccess = await requireEntitlement({
      userId: user.id,
      productSlug: "zokorp-validator",
      minUses: 1,
      creditTier,
      allowGeneralCreditFallback: true,
    });

    const maxBytes = maxUploadBytes(Number(process.env.UPLOAD_MAX_MB ?? "10"));
    if (file.size > maxBytes) {
      return jsonNoStore(
        { error: `File too large. Max allowed is ${process.env.UPLOAD_MAX_MB ?? 10}MB.` },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const targetOptions = getValidatorTargetOptions(parsedForm.data.validationProfile);
    const selectedTarget = resolveValidatorTargetContext(
      parsedForm.data.validationProfile,
      parsedForm.data.validationTargetId || undefined,
    );

    if (parsedForm.data.validationTargetId && !selectedTarget) {
      return jsonNoStore(
        { error: "Invalid checklist selection. Please choose a valid target and retry." },
        { status: 400 },
      );
    }

    if (!parsedForm.data.validationTargetId && targetOptions.length > 0 && !selectedTarget) {
      return jsonNoStore(
        { error: "Checklist targets unavailable. Please retry in a moment." },
        { status: 503 },
      );
    }

    if (!isAllowedFileType(file.name, file.type, buffer)) {
      return jsonNoStore(
        {
          error:
            "Unsupported file type. Please upload a PDF or Excel file (.xlsx).",
        },
        { status: 400 },
      );
    }

    if (buffer.length > maxBytes) {
      return jsonNoStore(
        { error: `File too large. Max allowed is ${process.env.UPLOAD_MAX_MB ?? 10}MB.` },
        { status: 413 },
      );
    }

    const result = await parseValidatorInput({
      filename: file.name,
      mimeType: file.type,
      buffer,
      profile: parsedForm.data.validationProfile,
      target: selectedTarget,
      additionalContext: parsedForm.data.additionalContext,
    });
    const estimate = buildValidatorEstimate(result.report);
    const estimateReferenceCode =
      user.email
        ? buildUniqueEstimateReferenceCode({
            source: "zokorp-validator",
            email: user.email,
            generatedAtISO: new Date().toISOString(),
            runKey: `${user.id}:${file.name}:${buffer.length}:${result.report.rulepack.id}`,
          })
        : result.report.rulepack.id;
    const quoteCompanionResult =
      estimate.quoteUsd > 0 && user.email
        ? await syncZohoInvoiceEstimate({
            email: user.email,
            fullName: user.name ?? null,
            serviceLabel: `${result.report.profileLabel} remediation estimate`,
            referenceNumber: estimateReferenceCode,
            notes: [
              `Profile: ${parsedForm.data.validationProfile}`,
              `Score: ${result.report.score}%`,
              selectedTarget ? `Checklist target: ${selectedTarget.label}` : "Checklist target: default",
              `Estimated effort: ${estimate.estimatedHoursTotal} hours`,
              ...estimate.lineItems.map(
                (lineItem) =>
                  `Scope: ${lineItem.serviceLineLabel} (${lineItem.status}, ${lineItem.estimatedHours}h, $${lineItem.amountUsd})`,
              ),
            ],
            lineItems: estimate.lineItems.map((lineItem) => ({
              name: lineItem.serviceLineLabel,
              description: lineItem.publicFixSummary,
              rate: lineItem.amountUsd,
            })),
          })
        : {
            ok: false as const,
            status: "not_configured" as const,
            error: "QUOTE_COMPANION_SKIPPED",
            referenceNumber: estimateReferenceCode,
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
          estimateId: "estimateId" in quoteCompanionResult ? quoteCompanionResult.estimateId : undefined,
          estimateNumber: null,
          error: quoteCompanionResult.error,
        };
    const emailContent = buildValidatorEmailContent({
      report: result.report,
      estimate,
      toEmail: user.email ?? "",
      officialEstimateReference: quoteCompanion.status === "created" ? quoteCompanion.estimateNumber : null,
    });
    const emailDelivery = user.email
      ? await sendValidatorResultsEmail({
          to: user.email,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        })
      : {
          ok: false,
          status: "not_configured" as const,
          error: "USER_EMAIL_MISSING",
        };

    if (user.email) {
      try {
        await recordEstimateCompanion({
          userId: user.id,
          source: "zokorp-validator",
          sourceRecordKey: estimateReferenceCode,
          sourceLabel: `${result.report.profileLabel} remediation estimate`,
          provider: quoteCompanion.provider,
          status: quoteCompanion.status,
          referenceCode: estimateReferenceCode,
          customerEmail: user.email,
          customerName: user.name ?? null,
          amountUsd: estimate.quoteUsd,
          externalId: quoteCompanion.estimateId,
          externalNumber: quoteCompanion.estimateNumber ?? null,
          summary: estimate.summary,
          metadata: {
            profile: parsedForm.data.validationProfile,
            targetId: selectedTarget?.id ?? null,
            targetLabel: selectedTarget?.label ?? null,
            estimatedHoursTotal: estimate.estimatedHoursTotal,
            slaLabel: estimate.slaLabel,
          },
        });
      } catch (error) {
        console.error("Failed to persist validator estimate companion", error);
      }
    }

    const decrementResult = await decrementUsesAtomically({
      userId: user.id,
      productSlug: "zokorp-validator",
      uses: 1,
      creditTier,
      allowGeneralCreditFallback: true,
    });

    let remainingUsesForProfile = decrementResult.remainingUses ?? 0;

    try {
      const entitlement = await db.entitlement.findFirst({
        where: {
          userId: user.id,
          product: { slug: "zokorp-validator" },
        },
        select: {
          productId: true,
          remainingUses: true,
        },
      });

      if (entitlement?.productId) {
        try {
          const balances = await db.creditBalance.findMany({
            where: {
              userId: user.id,
              productId: entitlement.productId,
              status: EntitlementStatus.ACTIVE,
              tier: {
                in: [creditTier, CreditTier.GENERAL],
              },
            },
            select: {
              remainingUses: true,
            },
          });
          remainingUsesForProfile = balances.reduce((total, item) => total + item.remainingUses, 0);
        } catch (error) {
          console.error("Failed to refresh validator remaining uses", error);
        }
      }
    } catch (error) {
      console.error("Failed to load validator entitlement after decrement", error);
    }

    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "tool.zokorp_validator_run",
          metadataJson: {
            filename: file.name,
            mimeType: file.type,
            bytes: buffer.length,
            profile: parsedForm.data.validationProfile,
            targetId: selectedTarget?.id ?? null,
            targetLabel: selectedTarget?.label ?? null,
            score: result.report.score,
            rulepackId: result.report.rulepack.id,
            estimateReferenceCode,
            deliveryStatus: emailDelivery.status,
            estimateQuoteUsd: estimate.quoteUsd,
            estimateHoursTotal: estimate.estimatedHoursTotal,
            estimateSla: estimate.slaLabel,
            quoteCompanionStatus: quoteCompanion.status,
            quoteCompanionProvider: quoteCompanion.provider,
            quoteCompanionReference: quoteCompanion.status === "created" ? quoteCompanion.estimateNumber : null,
            quoteCompanionError: quoteCompanion.status === "failed" ? quoteCompanion.error : null,
            redactions: result.meta?.redactions ?? null,
            controlCalibrationTotal: result.report.controlCalibration?.totalControls ?? null,
            adminBypass: entitlementAccess.adminBypass,
          },
        },
      });
    } catch (error) {
      console.error("Failed to write validator audit log", error);
    }

    return jsonNoStore({
      output: result.output,
      meta: result.meta,
      report: result.report,
      reviewedWorkbookBase64: result.reviewedWorkbookBase64,
      reviewedWorkbookFileName: result.reviewedWorkbookFileName,
      reviewedWorkbookMimeType: result.reviewedWorkbookMimeType,
      remainingUses: remainingUsesForProfile,
      adminBypass: entitlementAccess.adminBypass,
      emailDeliveryStatus: emailDelivery.status,
      estimate,
      quoteCompanion,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
      }

      if (error.message === "ENTITLEMENT_REQUIRED" || error.message === "INSUFFICIENT_USES") {
        return jsonNoStore({ error: "Purchase required before running this tool." }, { status: 402 });
      }

      if (error.message === "UNREADABLE_SPREADSHEET") {
        return jsonNoStore(
          { error: "The spreadsheet could not be parsed. Please upload a valid .xlsx file." },
          { status: 400 },
        );
      }
    }

    console.error(error);
    return jsonNoStore({ error: "Tool execution failed" }, { status: 500 });
  }
}
