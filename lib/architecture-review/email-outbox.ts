import { db } from "@/lib/db";
import { isUniqueConstraintError } from "@/lib/db-errors";
import type { SendEmailResult } from "@/lib/architecture-review/sender";

// REL-01: idempotency primitives for the architecture-review report email. Extracted from
// jobs.ts (a >1000 LOC worker) so the double-send guard is small, focused, and unit-testable.
//
// The outbox carries one row per job (enforced by @@unique([jobId])). Delivery is gated on the row's
// status so a worker re-run after a crash cannot send the report email a second time — critical
// because ZeptoMail has no send-time idempotency, leaving the DB status as the only guard on that
// provider path.

export type ArchitectureEmailOutboxRow = {
  id: string;
  status: string;
  provider: string | null;
  errorMessage: string | null;
};

// Ensure exactly one outbox row per job. The @@unique([jobId]) makes this idempotent across worker
// re-runs — a re-run returns the existing row instead of inserting a second one.
export async function ensureEmailOutbox(input: {
  jobId: string;
  leadLogId: string | null;
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string | null;
}): Promise<ArchitectureEmailOutboxRow> {
  const existing = await db.architectureReviewEmailOutbox.findUnique({ where: { jobId: input.jobId } });
  if (existing) {
    return existing;
  }

  try {
    return await db.architectureReviewEmailOutbox.create({
      data: {
        jobId: input.jobId,
        leadLogId: input.leadLogId,
        toEmail: input.toEmail,
        subject: input.subject,
        textBody: input.textBody,
        htmlBody: input.htmlBody,
        status: "pending",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const row = await db.architectureReviewEmailOutbox.findUnique({ where: { jobId: input.jobId } });
      if (row) {
        return row;
      }
    }
    throw error;
  }
}

// Atomically transition the outbox "pending" -> "sending" immediately before the provider call. Only
// the invocation that wins this compare-and-set (count === 1) may call the provider; any re-run sees
// a non-"pending" row and must NOT send again.
export async function claimEmailOutboxForSending(jobId: string): Promise<boolean> {
  const claim = await db.architectureReviewEmailOutbox.updateMany({
    where: { jobId, status: "pending" },
    data: { status: "sending", attemptCount: { increment: 1 } },
  });
  return claim.count > 0;
}

// When a re-run is not allowed to call the provider, derive the effective send result from the outbox
// state the prior run recorded. "sending"/"sent" => already delivered; anything else => resume the
// fallback path.
export function resumeSendResultFromOutbox(row: ArchitectureEmailOutboxRow): SendEmailResult {
  if (row.status === "sent" || row.status === "sending") {
    return {
      ok: true,
      provider: (row.provider as SendEmailResult["provider"]) ?? null,
    };
  }
  return {
    ok: false,
    provider: (row.provider as SendEmailResult["provider"]) ?? null,
    error: row.errorMessage ?? "EMAIL_DELIVERY_FAILED",
  };
}
