import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { fetchZohoInvoiceEstimateSnapshot } from "@/lib/zoho-invoice";

export type EstimateCompanionSyncResult =
  | {
      status: "ok";
      scanned: number;
      updated: number;
      unchanged: number;
      failed: number;
    }
  | {
      status: "not_configured" | "schema_unavailable" | "timeout" | "request_failed";
      error: string;
    };

function normalizeEstimateStatus(value: string | null, isViewedByClient: boolean | null) {
  const normalized = value?.trim().toLowerCase() || "created";

  if (normalized === "sent" && isViewedByClient) {
    return "viewed";
  }

  return normalized;
}

function mergeMetadata(existing: unknown, input: Record<string, unknown>) {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};

  return ({
    ...base,
    ...input,
  }) as Prisma.InputJsonValue;
}

export async function runEstimateCompanionSync(limit = 50): Promise<EstimateCompanionSyncResult> {
  let companions: Array<{
    id: string;
    externalId: string | null;
    externalNumber: string | null;
    externalUrl: string | null;
    status: string;
    metadataJson: unknown;
  }> = [];

  try {
    companions = await db.estimateCompanion.findMany({
      where: {
        provider: "zoho-invoice",
        externalId: {
          not: null,
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: limit,
      select: {
        id: true,
        externalId: true,
        externalNumber: true,
        externalUrl: true,
        status: true,
        metadataJson: true,
      },
    });
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return {
        status: "schema_unavailable",
        error: "ESTIMATE_COMPANION_SCHEMA_UNAVAILABLE",
      };
    }

    return {
      status: "request_failed",
      error: error instanceof Error ? error.message : "ESTIMATE_COMPANION_QUERY_FAILED",
    };
  }

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const companion of companions) {
    const externalId = companion.externalId;
    if (!externalId) {
      unchanged += 1;
      continue;
    }

    const snapshot = await fetchZohoInvoiceEstimateSnapshot({ estimateId: externalId });
    if (!snapshot.ok) {
      if (snapshot.status === "not_configured") {
        return {
          status: "not_configured",
          error: snapshot.error,
        };
      }

      if (snapshot.status === "timeout") {
        return {
          status: "timeout",
          error: snapshot.error,
        };
      }

      failed += 1;
      continue;
    }

    const nextStatus = normalizeEstimateStatus(snapshot.estimateStatus, snapshot.isViewedByClient);
    const nextMetadata = mergeMetadata(companion.metadataJson, {
      zohoEstimateStatus: snapshot.estimateStatus,
      zohoViewedByClient: snapshot.isViewedByClient,
      zohoLastModifiedTime: snapshot.lastModifiedTime,
    });

    const changed =
      companion.status !== nextStatus ||
      companion.externalNumber !== snapshot.estimateNumber ||
      companion.externalUrl !== snapshot.externalUrl;

    if (!changed) {
      unchanged += 1;
      continue;
    }

    try {
      await db.estimateCompanion.update({
        where: { id: companion.id },
        data: {
          status: nextStatus,
          externalNumber: snapshot.estimateNumber ?? companion.externalNumber,
          externalUrl: snapshot.externalUrl ?? companion.externalUrl,
          metadataJson: nextMetadata,
        },
      });
      updated += 1;
    } catch (error) {
      if (isSchemaDriftError(error)) {
        return {
          status: "schema_unavailable",
          error: "ESTIMATE_COMPANION_SCHEMA_UNAVAILABLE",
        };
      }

      failed += 1;
    }
  }

  return {
    status: "ok",
    scanned: companions.length,
    updated,
    unchanged,
    failed,
  };
}
