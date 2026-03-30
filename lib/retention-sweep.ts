import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const TERMINAL_ARCHITECTURE_JOB_STATUSES = ["sent", "fallback", "failed", "rejected"] as const;
const RETENTION_SWEEP_GRACE_MS = 60 * 60 * 1000;
const REDACTED_EMAIL_TEXT = "Email body redacted after delivery. See the live inbox copy or an opt-in archive if one exists.";

export type RetentionSweepResult = {
  expiredArchivedSubmissionsDeleted: number;
  expiredFingerprintsDeleted: number;
  leadLogsScrubbed: number;
  architectureJobsScrubbed: number;
  architectureOutboxesRedacted: number;
};

export async function runRetentionSweep(now = new Date()): Promise<RetentionSweepResult> {
  const scrubBefore = new Date(now.getTime() - RETENTION_SWEEP_GRACE_MS);

  const [
    archivedToolSubmissions,
    submissionFingerprints,
    leadLogs,
    architectureReviewJobs,
    architectureReviewEmailOutboxes,
  ] = await db.$transaction([
    db.archivedToolSubmission.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    }),
    db.submissionFingerprint.deleteMany({
      where: {
        expiresAt: {
          lte: now,
        },
      },
    }),
    db.leadLog.updateMany({
      data: {
        inputParagraph: null,
        reportJson: Prisma.JsonNull,
      },
    }),
    db.architectureReviewJob.updateMany({
      where: {
        status: {
          in: [...TERMINAL_ARCHITECTURE_JOB_STATUSES],
        },
        updatedAt: {
          lte: scrubBefore,
        },
      },
      data: {
        metadataJson: {
          scrubbed: true,
          scrubbedAtISO: now.toISOString(),
        },
        submissionContextJson: Prisma.JsonNull,
        clientTimingJson: Prisma.JsonNull,
        reportJson: Prisma.JsonNull,
      },
    }),
    db.architectureReviewEmailOutbox.updateMany({
      where: {
        status: {
          in: ["sent", "fallback"],
        },
        updatedAt: {
          lte: scrubBefore,
        },
      },
      data: {
        textBody: REDACTED_EMAIL_TEXT,
        htmlBody: null,
      },
    }),
  ]);

  return {
    expiredArchivedSubmissionsDeleted: archivedToolSubmissions.count,
    expiredFingerprintsDeleted: submissionFingerprints.count,
    leadLogsScrubbed: leadLogs.count,
    architectureJobsScrubbed: architectureReviewJobs.count,
    architectureOutboxesRedacted: architectureReviewEmailOutboxes.count,
  };
}

export function redactedArchitectureEmailBody() {
  return REDACTED_EMAIL_TEXT;
}
