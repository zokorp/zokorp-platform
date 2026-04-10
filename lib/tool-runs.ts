import { Prisma, type ToolRun, ToolRunStatus } from "@prisma/client";

import { db } from "@/lib/db";

export type ToolRunSlug =
  | "architecture-diagram-reviewer"
  | "zokorp-validator"
  | "mlops-foundation-platform";

export type ToolRunDeliveryStatus =
  | "local-only"
  | "local-email-pending"
  | "delivery-processing"
  | "sent"
  | "fallback"
  | "failed"
  | "not_configured"
  | "onscreen-only"
  | "local-email-reused";

type ToolRunDelegate = {
  create: (args: { data: Prisma.ToolRunUncheckedCreateInput }) => Promise<{ id: string }>;
  update?: (args: { where: { id: string }; data: Prisma.ToolRunUncheckedUpdateInput }) => Promise<{ id: string }>;
  updateMany?: (args: { where: Record<string, unknown>; data: Prisma.ToolRunUncheckedUpdateInput }) => Promise<{ count: number }>;
  findFirst?: (args: { where: Record<string, unknown> }) => Promise<ToolRun | null>;
};

type UpsertToolRunTelemetryInput = {
  toolRunId?: string | null;
  userId: string;
  toolSlug: ToolRunSlug;
  toolLabel: string;
  status?: ToolRunStatus;
  summary: string;
  inputFileName?: string | null;
  sourceType?: string | null;
  sourceName?: string | null;
  profile?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  score?: number | null;
  confidenceScore?: number | null;
  confidenceLabel?: string | null;
  deliveryStatus?: ToolRunDeliveryStatus | string | null;
  estimateAmountUsd?: number | null;
  estimateSla?: string | null;
  estimateReferenceCode?: string | null;
  remainingUses?: number | null;
  report?: unknown;
  metadata?: Record<string, unknown> | null;
};

function toolRunDelegate() {
  return (db as unknown as { toolRun?: ToolRunDelegate }).toolRun;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function upsertToolRunTelemetry(input: UpsertToolRunTelemetryInput) {
  const delegate = toolRunDelegate();
  if (!delegate?.create) {
    return null;
  }

  const data: Prisma.ToolRunUncheckedCreateInput = {
    userId: input.userId,
    toolSlug: input.toolSlug,
    toolLabel: input.toolLabel,
    status: input.status ?? ToolRunStatus.COMPLETED,
    summary: input.summary,
    inputFileName: input.inputFileName ?? null,
    sourceType: input.sourceType ?? null,
    sourceName: input.sourceName ?? null,
    profile: input.profile ?? null,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    score: input.score ?? null,
    confidenceScore: input.confidenceScore ?? null,
    confidenceLabel: input.confidenceLabel ?? null,
    deliveryStatus: input.deliveryStatus ?? null,
    estimateAmountUsd: input.estimateAmountUsd ?? null,
    estimateSla: input.estimateSla ?? null,
    estimateReferenceCode: input.estimateReferenceCode ?? null,
    remainingUses: input.remainingUses ?? null,
    reportJson: toJsonValue(input.report ?? null),
    metadataJson: toJsonValue(input.metadata ?? null),
  };

  if (input.toolRunId && delegate.update) {
    return delegate.update({
      where: { id: input.toolRunId },
      data,
    });
  }

  return delegate.create({ data });
}

export async function findToolRunById(input: {
  toolRunId: string;
  userId: string;
  toolSlug?: ToolRunSlug;
}) {
  const delegate = toolRunDelegate();
  if (!delegate?.findFirst) {
    return null;
  }

  return delegate.findFirst({
    where: {
      id: input.toolRunId,
      userId: input.userId,
      ...(input.toolSlug ? { toolSlug: input.toolSlug } : {}),
    },
  });
}

export async function claimToolRunDelivery(input: {
  toolRunId: string;
  userId: string;
  toolSlug: ToolRunSlug;
  from: string[];
  to: ToolRunDeliveryStatus | string;
}) {
  const delegate = toolRunDelegate();
  if (!delegate?.findFirst || !delegate.updateMany) {
    return { state: "missing" as const, toolRun: null };
  }

  const existing = await findToolRunById({
    toolRunId: input.toolRunId,
    userId: input.userId,
    toolSlug: input.toolSlug,
  });

  if (!existing) {
    return { state: "missing" as const, toolRun: null };
  }

  const currentDeliveryStatus = existing.deliveryStatus ?? null;
  if (!input.from.includes(currentDeliveryStatus ?? "")) {
    return {
      state:
        currentDeliveryStatus === "sent" ||
        currentDeliveryStatus === "fallback" ||
        currentDeliveryStatus === "failed" ||
        currentDeliveryStatus === "not_configured"
          ? ("already-final" as const)
          : ("already-processing" as const),
      toolRun: existing,
    };
  }

  const result = await delegate.updateMany({
    where: {
      id: input.toolRunId,
      userId: input.userId,
      toolSlug: input.toolSlug,
      deliveryStatus: {
        in: input.from,
      },
    },
    data: {
      deliveryStatus: input.to,
    },
  });

  if (result.count === 0) {
    const latest = await findToolRunById({
      toolRunId: input.toolRunId,
      userId: input.userId,
      toolSlug: input.toolSlug,
    });

    return {
      state:
        latest?.deliveryStatus === "sent" ||
        latest?.deliveryStatus === "fallback" ||
        latest?.deliveryStatus === "failed" ||
        latest?.deliveryStatus === "not_configured"
          ? ("already-final" as const)
          : ("already-processing" as const),
      toolRun: latest,
    };
  }

  const claimed = await findToolRunById({
    toolRunId: input.toolRunId,
    userId: input.userId,
    toolSlug: input.toolSlug,
  });

  return {
    state: "claimed" as const,
    toolRun: claimed,
  };
}

export async function recordValidatorToolRun(input: {
  userId: string;
  summary: string;
  fileName: string;
  mimeType: string;
  profile: string;
  targetId?: string | null;
  targetLabel?: string | null;
  score: number;
  deliveryStatus: string;
  estimateAmountUsd: number;
  estimateSla: string;
  estimateReferenceCode: string;
  remainingUses: number;
  report: unknown;
  metadata?: Record<string, unknown> | null;
  failed?: boolean;
}) {
  return upsertToolRunTelemetry({
    userId: input.userId,
    toolSlug: "zokorp-validator",
    toolLabel: "ZoKorpValidator",
    status: input.failed ? ToolRunStatus.FAILED : ToolRunStatus.COMPLETED,
    summary: input.summary,
    inputFileName: input.fileName,
    sourceType: input.mimeType,
    profile: input.profile,
    targetId: input.targetId ?? null,
    targetLabel: input.targetLabel ?? null,
    score: input.score,
    deliveryStatus: input.deliveryStatus,
    estimateAmountUsd: input.estimateAmountUsd,
    estimateSla: input.estimateSla,
    estimateReferenceCode: input.estimateReferenceCode,
    remainingUses: input.remainingUses,
    report: input.report,
    metadata: input.metadata ?? null,
  });
}

export async function recordArchitectureReviewToolRun(input: {
  toolRunId?: string | null;
  userId: string;
  summary: string;
  inputFileName?: string | null;
  sourceType?: string | null;
  sourceName?: string | null;
  score?: number | null;
  confidenceLabel?: string | null;
  deliveryStatus?: string | null;
  estimateAmountUsd?: number | null;
  estimateSla?: string | null;
  estimateReferenceCode?: string | null;
  report?: unknown;
  metadata?: Record<string, unknown> | null;
  failed?: boolean;
}) {
  return upsertToolRunTelemetry({
    toolRunId: input.toolRunId,
    userId: input.userId,
    toolSlug: "architecture-diagram-reviewer",
    toolLabel: "Architecture Diagram Reviewer",
    status: input.failed ? ToolRunStatus.FAILED : ToolRunStatus.COMPLETED,
    summary: input.summary,
    inputFileName: input.inputFileName ?? null,
    sourceType: input.sourceType ?? null,
    sourceName: input.sourceName ?? null,
    score: input.score ?? null,
    confidenceLabel: input.confidenceLabel ?? null,
    deliveryStatus: input.deliveryStatus ?? null,
    estimateAmountUsd: input.estimateAmountUsd ?? null,
    estimateSla: input.estimateSla ?? null,
    estimateReferenceCode: input.estimateReferenceCode ?? null,
    report: input.report ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function recordMlopsForecastToolRun(input: {
  userId: string;
  summary: string;
  inputFileName?: string | null;
  sourceType: string;
  sourceName: string;
  confidenceScore: number;
  confidenceLabel: string;
  report: unknown;
  metadata?: Record<string, unknown> | null;
  failed?: boolean;
}) {
  return upsertToolRunTelemetry({
    userId: input.userId,
    toolSlug: "mlops-foundation-platform",
    toolLabel: "ZoKorp Forecasting Beta",
    status: input.failed ? ToolRunStatus.FAILED : ToolRunStatus.COMPLETED,
    summary: input.summary,
    inputFileName: input.inputFileName ?? null,
    sourceType: input.sourceType,
    sourceName: input.sourceName,
    confidenceScore: input.confidenceScore,
    confidenceLabel: input.confidenceLabel,
    deliveryStatus: "onscreen-only",
    report: input.report,
    metadata: input.metadata ?? null,
  });
}
