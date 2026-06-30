-- REL-01: make the architecture-review report-email outbox idempotent (exactly one row per job).
--
-- The unique index below cannot be created while duplicate jobId rows exist, and production may
-- already contain duplicates from the pre-fix double-send window. De-duplicate FIRST, keeping the
-- most-progressed / most-recent row per job (a delivered row wins over a pending one; ties break on
-- the newest sentAt, then createdAt, then id) so the index applies cleanly and we retain the row that
-- best reflects the real delivery outcome.
DELETE FROM "ArchitectureReviewEmailOutbox"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "jobId"
        ORDER BY
          CASE "status"
            WHEN 'sent' THEN 0
            WHEN 'fallback' THEN 1
            WHEN 'sending' THEN 2
            WHEN 'pending' THEN 3
            ELSE 4
          END ASC,
          "sentAt" DESC NULLS LAST,
          "createdAt" DESC,
          "id" DESC
      ) AS rn
    FROM "ArchitectureReviewEmailOutbox"
  ) ranked
  WHERE ranked."rn" > 1
);

-- DropIndex
DROP INDEX "ArchitectureReviewEmailOutbox_jobId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "ArchitectureReviewEmailOutbox_jobId_key" ON "ArchitectureReviewEmailOutbox"("jobId");
