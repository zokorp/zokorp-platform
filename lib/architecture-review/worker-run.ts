import { drainArchitectureReviewQueue } from "@/lib/architecture-review/jobs";
import { isSchemaDriftError } from "@/lib/db-errors";
import { createInternalAuditLog } from "@/lib/internal-route";

export async function runArchitectureReviewWorkerBatch(limit: number) {
  try {
    const result = await drainArchitectureReviewQueue({ limit });

    await createInternalAuditLog("internal.architecture_review_worker.run", {
      limit,
      scanned: result.scanned,
      processed: result.processed,
      sent: result.sent,
      fallback: result.fallback,
      rejected: result.rejected,
      failed: result.failed,
      runningOrQueued: result.runningOrQueued,
    });

    return {
      status: "ok" as const,
      ...result,
    };
  } catch (error) {
    if (isSchemaDriftError(error)) {
      await createInternalAuditLog("internal.architecture_review_worker.schema_unavailable", {
        limit,
      });

      return {
        status: "schema_unavailable" as const,
        error: "Architecture review queue schema is unavailable.",
      };
    }

    console.error("architecture review worker run failed", error);
    await createInternalAuditLog("internal.architecture_review_worker.failed", {
      limit,
      errorName: error instanceof Error ? error.name : "unknown_error",
    });

    return {
      status: "failed" as const,
      error: "Architecture review worker run failed.",
    };
  }
}
