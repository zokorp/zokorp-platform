import { z } from "zod";

export const TOOL_EVENT_SOURCES = ["architecture-review", "zokorp-validator"] as const;

export type ToolEventSource = (typeof TOOL_EVENT_SOURCES)[number];

export const leadDeliveryStateSchema = z.enum([
  "unknown",
  "pending",
  "sent",
  "failed",
  "fallback",
]);
export type LeadDeliveryState = z.infer<typeof leadDeliveryStateSchema>;

export const leadCrmStateSchema = z.enum([
  "unknown",
  "pending",
  "synced",
  "failed",
  "not_configured",
  "skipped",
]);
export type LeadCrmState = z.infer<typeof leadCrmStateSchema>;

export const toolConsentSchema = z.object({
  saveForFollowUp: z.boolean().default(false),
  allowCrmFollowUp: z.boolean().default(false),
});
export type ToolConsent = z.infer<typeof toolConsentSchema>;

export type RetentionPolicy = {
  archiveRetentionDays: number;
  fingerprintTtlMinutes: number;
  defaultStoredLeadFields: string[];
  defaultStoredEventFields: string[];
  archiveStrategy: string;
};

export const retentionPolicy: RetentionPolicy = {
  archiveRetentionDays: 30,
  fingerprintTtlMinutes: 15,
  defaultStoredLeadFields: ["email", "name", "companyName", "lastSeenAt"],
  defaultStoredEventFields: [
    "source",
    "createdAt",
    "deliveryState",
    "crmSyncState",
    "saveForFollowUp",
    "allowCrmFollowUp",
    "scoreBand",
    "estimateBand",
    "recommendedEngagement",
  ],
  archiveStrategy: "encrypted_opt_in_only",
};

export type EstimateSummary = {
  recommendedEngagement?: string | null;
  scoreBand?: string | null;
  estimateBand?: string | null;
};

export type LeadEventAggregate = EstimateSummary & {
  source: ToolEventSource;
  deliveryState: LeadDeliveryState;
  crmSyncState: LeadCrmState;
  saveForFollowUp: boolean;
  allowCrmFollowUp: boolean;
  sourceRecordKey?: string | null;
  createdAt?: Date;
};

export type ArchiveRecord = {
  toolName: ToolEventSource;
  payloadCiphertext: string;
  payloadHash: string;
  expiresAt: Date;
};

export function normalizeToolConsent(input: Partial<ToolConsent> | null | undefined): ToolConsent {
  return toolConsentSchema.parse(input ?? {});
}

export function scoreBandForScore(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }

  const rounded = Math.max(0, Math.min(100, Math.round(score)));
  if (rounded >= 90) {
    return "90-100";
  }

  if (rounded >= 60) {
    return "60-89";
  }

  return "0-59";
}

export function estimateBandForRange(low: number | null | undefined, high: number | null | undefined) {
  if (typeof low !== "number" && typeof high !== "number") {
    return null;
  }

  const midpoint = Math.max(0, Math.round(((low ?? high ?? 0) + (high ?? low ?? 0)) / 2));
  if (midpoint < 500) {
    return "under-500";
  }

  if (midpoint < 1_500) {
    return "500-1499";
  }

  if (midpoint < 5_000) {
    return "1500-4999";
  }

  if (midpoint < 10_000) {
    return "5000-9999";
  }

  return "10000-plus";
}
