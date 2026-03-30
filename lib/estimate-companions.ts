import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";

export type EstimateCompanionSource = "architecture-review" | "zokorp-validator";
export type EstimateCompanionStatus = "created" | "failed" | "not_configured";

function metadataInput(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export async function recordEstimateCompanion(input: {
  userId?: string | null;
  source: EstimateCompanionSource;
  sourceRecordKey?: string | null;
  sourceLabel: string;
  provider?: string | null;
  status: EstimateCompanionStatus;
  referenceCode: string;
  customerEmail: string;
  customerName?: string | null;
  companyName?: string | null;
  amountUsd: number;
  externalId?: string | null;
  externalNumber?: string | null;
  externalUrl?: string | null;
  externalPdfUrl?: string | null;
  summary?: string | null;
  metadata?: unknown;
}) {
  try {
    return await db.estimateCompanion.upsert({
      where: { referenceCode: input.referenceCode },
      create: {
        userId: input.userId ?? null,
        source: input.source,
        sourceRecordKey: input.sourceRecordKey ?? null,
        sourceLabel: input.sourceLabel,
        provider: input.provider ?? null,
        status: input.status,
        referenceCode: input.referenceCode,
        customerEmail: input.customerEmail,
        customerName: input.customerName ?? null,
        companyName: input.companyName ?? null,
        amountUsd: input.amountUsd,
        externalId: input.externalId ?? null,
        externalNumber: input.externalNumber ?? null,
        externalUrl: input.externalUrl ?? null,
        externalPdfUrl: input.externalPdfUrl ?? null,
        summary: input.summary ?? null,
        metadataJson: metadataInput(input.metadata),
      },
      update: {
        userId: input.userId ?? null,
        sourceRecordKey: input.sourceRecordKey ?? null,
        sourceLabel: input.sourceLabel,
        provider: input.provider ?? null,
        status: input.status,
        customerEmail: input.customerEmail,
        customerName: input.customerName ?? null,
        companyName: input.companyName ?? null,
        amountUsd: input.amountUsd,
        externalId: input.externalId ?? null,
        externalNumber: input.externalNumber ?? null,
        externalUrl: input.externalUrl ?? null,
        externalPdfUrl: input.externalPdfUrl ?? null,
        summary: input.summary ?? null,
        metadataJson: metadataInput(input.metadata),
      },
    });
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return null;
    }

    throw error;
  }
}
