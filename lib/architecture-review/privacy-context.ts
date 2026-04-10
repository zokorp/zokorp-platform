import {
  findRecentSubmissionFingerprint,
  rememberSubmissionFingerprint,
  upsertLead,
} from "@/lib/privacy-leads";

const ARCHITECTURE_REVIEW_TOOL_SOURCE = "architecture-review" as const;

export function buildArchitecturePrivacySourceRecordKey(fingerprintId: string) {
  return `${ARCHITECTURE_REVIEW_TOOL_SOURCE}:privacy:${fingerprintId}`;
}

export function buildArchitecturePrivacyDeliveryIdempotencyKey(input: {
  userId: string;
  fingerprintId: string;
}) {
  return `${ARCHITECTURE_REVIEW_TOOL_SOURCE}:privacy-email:${input.userId}:${input.fingerprintId}`;
}

export function buildArchitecturePrivacyInteractionEventId(input: {
  fingerprintId: string;
  action: "run_completed" | "delivery_requested" | "delivery_sent" | "delivery_fallback";
}) {
  return `${ARCHITECTURE_REVIEW_TOOL_SOURCE}:privacy:${input.fingerprintId}:${input.action}`;
}

export async function ensureArchitectureReviewLead(input: {
  userId: string;
  email: string;
  name?: string | null;
}) {
  return upsertLead({
    userId: input.userId,
    email: input.email,
    name: input.name,
  });
}

export async function findArchitecturePrivacyFingerprint(input: {
  fingerprintHash: string;
  userId: string;
}) {
  return findRecentSubmissionFingerprint({
    toolName: ARCHITECTURE_REVIEW_TOOL_SOURCE,
    fingerprintHash: input.fingerprintHash,
    userId: input.userId,
  });
}

export async function ensureArchitecturePrivacyFingerprint(input: {
  leadId: string;
  userId: string;
  fingerprintHash: string;
}) {
  const existingFingerprint = await findArchitecturePrivacyFingerprint({
    fingerprintHash: input.fingerprintHash,
    userId: input.userId,
  });

  if (existingFingerprint) {
    return {
      fingerprint: existingFingerprint,
      deduped: true,
    };
  }

  const fingerprint = await rememberSubmissionFingerprint({
    leadId: input.leadId,
    userId: input.userId,
    toolName: ARCHITECTURE_REVIEW_TOOL_SOURCE,
    fingerprintHash: input.fingerprintHash,
  });

  return {
    fingerprint,
    deduped: false,
  };
}
