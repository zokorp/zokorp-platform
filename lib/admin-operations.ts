import { db } from "@/lib/db";

type OperationsIssue = {
  id: string;
  createdAt: Date;
  title: string;
  statusLabel: string;
  statusTone: "secondary" | "success" | "warning" | "danger" | "info";
  summary: string;
  details: string[];
  href?: string | null;
};

export type AdminOperationsSnapshot = {
  stats: {
    pendingArchitectureEmail: number;
    failedArchitectureEmail: number;
    crmNeedsAttention: number;
    failedQuoteCompanions: number;
    recentValidatorRuns: number;
    recentMlopsRuns: number;
  };
  architectureEmailIssues: OperationsIssue[];
  crmSyncIssues: OperationsIssue[];
  estimateCompanionIssues: OperationsIssue[];
  toolRunSignals: OperationsIssue[];
};

function asRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getAdminOperationsSnapshot(): Promise<AdminOperationsSnapshot> {
  const [emailOutboxes, crmLeads, estimateCompanions, toolRuns] = await Promise.all([
    db.architectureReviewEmailOutbox.findMany({
      where: {
        status: {
          in: ["pending", "failed"],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 20,
      include: {
        job: {
          select: {
            overallScore: true,
            userEmail: true,
          },
        },
      },
    }),
    db.leadLog.findMany({
      where: {
        OR: [{ zohoSyncNeedsUpdate: true }, { zohoSyncError: { not: null } }],
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        userEmail: true,
        overallScore: true,
        analysisConfidence: true,
        quoteTier: true,
        zohoSyncNeedsUpdate: true,
        zohoSyncError: true,
        leadStage: true,
      },
    }),
    db.estimateCompanion.findMany({
      where: {
        status: {
          in: ["failed", "not_configured"],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 20,
    }),
    db.auditLog.findMany({
      where: {
        action: {
          in: ["tool.zokorp_validator_run", "tool.mlops_forecast_run"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
    }),
  ]);

  return {
    stats: {
      pendingArchitectureEmail: emailOutboxes.filter((item) => item.status === "pending").length,
      failedArchitectureEmail: emailOutboxes.filter((item) => item.status === "failed").length,
      crmNeedsAttention: crmLeads.length,
      failedQuoteCompanions: estimateCompanions.length,
      recentValidatorRuns: toolRuns.filter((item) => item.action === "tool.zokorp_validator_run").length,
      recentMlopsRuns: toolRuns.filter((item) => item.action === "tool.mlops_forecast_run").length,
    },
    architectureEmailIssues: emailOutboxes.map((item) => ({
      id: item.id,
      createdAt: item.updatedAt,
      title: "Architecture review delivery",
      statusLabel: item.status,
      statusTone: item.status === "failed" ? "danger" : "warning",
      summary: `${item.toEmail} · ${item.job.overallScore !== null ? `Score ${item.job.overallScore}/100` : "Score pending"}`,
      details: [item.provider ? `Provider ${item.provider}` : null, item.errorMessage ? item.errorMessage : null].filter(
        (value): value is string => Boolean(value),
      ),
      href: "/admin/leads?source=architecture-review&ops=needs-attention",
    })),
    crmSyncIssues: crmLeads.map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      title: "CRM follow-up sync",
      statusLabel: item.zohoSyncError ? "failed" : "pending",
      statusTone: item.zohoSyncError ? "danger" : "warning",
      summary: `${item.userEmail} · Score ${item.overallScore}/100 · ${item.leadStage}`,
      details: [
        item.analysisConfidence ? `${item.analysisConfidence} confidence` : null,
        item.quoteTier ? item.quoteTier : null,
        item.zohoSyncError ? item.zohoSyncError : "Waiting for Zoho sync update.",
      ].filter((value): value is string => Boolean(value)),
      href: "/admin/leads?source=architecture-review&ops=needs-attention",
    })),
    estimateCompanionIssues: estimateCompanions.map((item) => ({
      id: item.id,
      createdAt: item.updatedAt,
      title: item.sourceLabel,
      statusLabel: item.status,
      statusTone: item.status === "failed" ? "danger" : "info",
      summary: `${item.customerEmail} · ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: item.currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(item.amountUsd)}`,
      details: [item.referenceCode, item.externalNumber, item.provider].filter((value): value is string => Boolean(value)),
      href: "/account",
    })),
    toolRunSignals: toolRuns.map((item) => {
      const metadata = asRecord(item.metadataJson);

      if (item.action === "tool.zokorp_validator_run") {
        const deliveryStatus = readString(metadata, "deliveryStatus");
        const quoteCompanionStatus = readString(metadata, "quoteCompanionStatus");
        const score = readNumber(metadata, "score");

        return {
          id: item.id,
          createdAt: item.createdAt,
          title: `Validator run · ${readString(metadata, "profile") ?? "FTR"}`,
          statusLabel: deliveryStatus ?? "logged",
          statusTone:
            deliveryStatus === "failed" || quoteCompanionStatus === "failed"
              ? "danger"
              : deliveryStatus === "not_configured"
                ? "info"
                : score !== null && score < 60
                  ? "warning"
                  : "secondary",
          summary: [
            readString(metadata, "targetLabel") ?? "Checklist target",
            score !== null ? `Score ${score}%` : null,
            quoteCompanionStatus ? `Quote ${quoteCompanionStatus}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          details: [
            readString(metadata, "quoteCompanionReference"),
            readString(metadata, "quoteCompanionError"),
            readString(metadata, "filename"),
          ].filter((value): value is string => Boolean(value)),
          href: "/software/zokorp-validator",
        } satisfies OperationsIssue;
      }

      return {
        id: item.id,
        createdAt: item.createdAt,
        title: "MLOps forecasting beta run",
        statusLabel: readNumber(metadata, "confidenceScore") !== null ? `${readNumber(metadata, "confidenceScore")}%` : "logged",
        statusTone:
          (readNumber(metadata, "confidenceScore") ?? 0) >= 75
            ? "success"
            : (readNumber(metadata, "confidenceScore") ?? 0) >= 50
              ? "info"
              : "warning",
        summary: [
          readString(metadata, "sourceName") ?? "Forecast input",
          readString(metadata, "sourceType")?.toUpperCase() ?? null,
          metadata?.demoRun === true ? "Demo run" : "Customer run",
        ]
          .filter(Boolean)
          .join(" · "),
        details: [readString(metadata, "cadenceLabel"), readString(metadata, "confidenceLabel")].filter(
          (value): value is string => Boolean(value),
        ),
        href: "/software/mlops-foundation-platform",
      } satisfies OperationsIssue;
    }),
  };
}
