import { createHash, createCipheriv, randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import {
  retentionPolicy,
  type ArchiveRecord,
  type LeadEventAggregate,
  type ToolEventSource,
} from "@/lib/tool-consent";

export const LEAD_INTERACTION_ACTIONS = ["cta_clicked", "call_booked"] as const;
export type LeadInteractionAction = (typeof LEAD_INTERACTION_ACTIONS)[number];

const ESTIMATE_REFERENCE_PREFIXES: Record<ToolEventSource, string> = {
  "architecture-review": "ARCH",
  "zokorp-validator": "VAL",
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function archiveSecret() {
  return (
    process.env.ARCHIVE_ENCRYPTION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "local-dev-archive-secret-not-for-production"
  );
}

function deriveArchiveKey() {
  return createHash("sha256").update(archiveSecret()).digest();
}

export function buildEstimateReferenceCode(input: {
  source: ToolEventSource;
  email: string;
  generatedAtISO?: string;
}) {
  const prefix = ESTIMATE_REFERENCE_PREFIXES[input.source];
  const dateStamp = (input.generatedAtISO ?? new Date().toISOString()).slice(0, 10).replaceAll("-", "");
  const checksum = createHash("sha1")
    .update(`${input.source}:${normalizeEmail(input.email)}:${input.generatedAtISO ?? ""}`)
    .digest("hex")
    .slice(0, 6)
    .toUpperCase();

  return `ZK-${prefix}-${dateStamp}-${checksum}`;
}

export function buildUniqueEstimateReferenceCode(input: {
  source: ToolEventSource;
  email: string;
  generatedAtISO?: string;
  runKey?: string;
}) {
  const baseCode = buildEstimateReferenceCode({
    source: input.source,
    email: input.email,
    generatedAtISO: input.generatedAtISO,
  });

  const entropySource = input.runKey?.trim();
  const suffix = entropySource
    ? createHash("sha1")
        .update(`${input.source}:${normalizeEmail(input.email)}:${input.generatedAtISO ?? ""}:${entropySource}`)
        .digest("hex")
        .slice(0, 4)
        .toUpperCase()
    : randomBytes(2).toString("hex").toUpperCase();

  return `${baseCode}-${suffix}`;
}

export function hashSubmissionFingerprint(input: {
  toolName: ToolEventSource;
  email: string;
  payload: unknown;
}) {
  return createHash("sha256")
    .update(`${input.toolName}:${normalizeEmail(input.email)}:${stableStringify(input.payload)}`)
    .digest("hex");
}

export async function upsertLead(input: {
  userId?: string | null;
  email: string;
  name?: string | null;
  companyName?: string | null;
}) {
  const email = normalizeEmail(input.email);
  const now = new Date();

  return db.lead.upsert({
    where: { email },
    update: {
      lastSeenAt: now,
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.companyName ? { companyName: input.companyName.trim() } : {}),
    },
    create: {
      userId: input.userId ?? null,
      email,
      name: input.name?.trim() || null,
      companyName: input.companyName?.trim() || null,
      lastSeenAt: now,
    },
  });
}

export async function recordLeadEvent(input: {
  leadId: string;
  userId?: string | null;
  aggregate: LeadEventAggregate;
}) {
  const payload = {
    leadId: input.leadId,
    userId: input.userId ?? null,
    source: input.aggregate.source,
    deliveryState: input.aggregate.deliveryState,
    crmSyncState: input.aggregate.crmSyncState,
    saveForFollowUp: input.aggregate.saveForFollowUp,
    allowCrmFollowUp: input.aggregate.allowCrmFollowUp,
    scoreBand: input.aggregate.scoreBand ?? null,
    estimateBand: input.aggregate.estimateBand ?? null,
    recommendedEngagement: input.aggregate.recommendedEngagement ?? null,
    sourceRecordKey: input.aggregate.sourceRecordKey ?? null,
    createdAt: input.aggregate.createdAt ?? new Date(),
  };

  if (payload.sourceRecordKey) {
    return db.leadEvent.upsert({
      where: {
        sourceRecordKey: payload.sourceRecordKey,
      },
      create: payload,
      update: {
        leadId: payload.leadId,
        userId: payload.userId,
        source: payload.source,
        deliveryState: payload.deliveryState,
        crmSyncState: payload.crmSyncState,
        saveForFollowUp: payload.saveForFollowUp,
        allowCrmFollowUp: payload.allowCrmFollowUp,
        scoreBand: payload.scoreBand,
        estimateBand: payload.estimateBand,
        recommendedEngagement: payload.recommendedEngagement,
      },
    });
  }

  return db.leadEvent.create({
    data: payload,
  });
}

export async function recordLeadInteraction(input: {
  leadId: string;
  userId?: string | null;
  serviceRequestId?: string | null;
  source: ToolEventSource;
  action: LeadInteractionAction;
  provider?: string | null;
  externalEventId?: string | null;
  estimateReferenceCode?: string | null;
  createdAt?: Date;
}) {
  return db.leadInteraction.create({
    data: {
      leadId: input.leadId,
      userId: input.userId ?? null,
      serviceRequestId: input.serviceRequestId ?? null,
      source: input.source,
      action: input.action,
      provider: input.provider ?? null,
      externalEventId: input.externalEventId ?? null,
      estimateReferenceCode: input.estimateReferenceCode ?? null,
      createdAt: input.createdAt ?? new Date(),
    },
  });
}

export async function createLeadEventForTool(input: {
  userId?: string | null;
  email: string;
  name?: string | null;
  companyName?: string | null;
  aggregate: LeadEventAggregate;
}) {
  const lead = await upsertLead({
    userId: input.userId,
    email: input.email,
    name: input.name,
    companyName: input.companyName,
  });
  const event = await recordLeadEvent({
    leadId: lead.id,
    userId: input.userId,
    aggregate: input.aggregate,
  });

  return { lead, event };
}

export function encryptArchivePayload(payload: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveArchiveKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export async function archiveToolSubmission(input: {
  leadId: string;
  userId?: string | null;
  toolName: ToolEventSource;
  payload: unknown;
  expiresAt?: Date;
}) {
  const serialized = stableStringify(input.payload);
  const payloadCiphertext = encryptArchivePayload(input.payload);
  const payloadHash = createHash("sha256").update(serialized).digest("hex");
  const expiresAt =
    input.expiresAt ??
    new Date(Date.now() + retentionPolicy.archiveRetentionDays * 24 * 60 * 60 * 1000);

  const record = await db.archivedToolSubmission.create({
    data: {
      leadId: input.leadId,
      userId: input.userId ?? null,
      toolName: input.toolName,
      payloadCiphertext,
      payloadHash,
      expiresAt,
    },
  });

  return {
    record,
    toolName: input.toolName,
    payloadCiphertext,
    payloadHash,
    expiresAt,
  } satisfies { record: typeof record } & ArchiveRecord;
}

export async function findRecentSubmissionFingerprint(input: {
  toolName: ToolEventSource;
  fingerprintHash: string;
}) {
  return db.submissionFingerprint.findFirst({
    where: {
      toolName: input.toolName,
      fingerprintHash: input.fingerprintHash,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function rememberSubmissionFingerprint(input: {
  leadId?: string | null;
  userId?: string | null;
  toolName: ToolEventSource;
  fingerprintHash: string;
  ttlMinutes?: number;
}) {
  const ttlMinutes = input.ttlMinutes ?? retentionPolicy.fingerprintTtlMinutes;
  return db.submissionFingerprint.create({
    data: {
      leadId: input.leadId ?? null,
      userId: input.userId ?? null,
      toolName: input.toolName,
      fingerprintHash: input.fingerprintHash,
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
}
