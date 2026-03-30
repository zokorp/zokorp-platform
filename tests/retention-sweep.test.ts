import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  archivedDeleteMany: vi.fn(),
  fingerprintsDeleteMany: vi.fn(),
  leadLogUpdateMany: vi.fn(),
  jobsUpdateMany: vi.fn(),
  outboxUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
    archivedToolSubmission: {
      deleteMany: mocks.archivedDeleteMany,
    },
    submissionFingerprint: {
      deleteMany: mocks.fingerprintsDeleteMany,
    },
    leadLog: {
      updateMany: mocks.leadLogUpdateMany,
    },
    architectureReviewJob: {
      updateMany: mocks.jobsUpdateMany,
    },
    architectureReviewEmailOutbox: {
      updateMany: mocks.outboxUpdateMany,
    },
  },
}));

import { runRetentionSweep } from "@/lib/retention-sweep";

describe("retention sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archivedDeleteMany.mockReturnValue("archived-op");
    mocks.fingerprintsDeleteMany.mockReturnValue("fingerprints-op");
    mocks.leadLogUpdateMany.mockReturnValue("lead-op");
    mocks.jobsUpdateMany.mockReturnValue("jobs-op");
    mocks.outboxUpdateMany.mockReturnValue("outbox-op");
    mocks.transaction.mockResolvedValue([
      { count: 2 },
      { count: 5 },
      { count: 7 },
      { count: 8 },
      { count: 9 },
    ]);
  });

  it("purges expired archives and legacy sensitive records", async () => {
    const now = new Date("2026-03-24T15:00:00.000Z");
    const result = await runRetentionSweep(now);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.archivedDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          expiresAt: {
            lte: now,
          },
        },
      }),
    );
    expect(mocks.jobsUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ["sent", "fallback", "failed", "rejected"],
          },
        }),
        data: expect.objectContaining({
          reportJson: expect.anything(),
          submissionContextJson: expect.anything(),
          clientTimingJson: expect.anything(),
        }),
      }),
    );
    expect(mocks.outboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          textBody: expect.stringContaining("redacted after delivery"),
          htmlBody: null,
        }),
      }),
    );
    expect(result).toEqual({
      expiredArchivedSubmissionsDeleted: 2,
      expiredFingerprintsDeleted: 5,
      leadLogsScrubbed: 7,
      architectureJobsScrubbed: 8,
      architectureOutboxesRedacted: 9,
    });
  });
});
