import { drainArchitectureReviewQueue } from "@/lib/architecture-review/jobs";
import { isSchemaDriftError } from "@/lib/db-errors";
import {
  createInternalAuditLog,
  jsonNoStore,
  methodNotAllowedJson,
  safeSecretEqual,
} from "@/lib/internal-route";

export const runtime = "nodejs";
function providedSecret(request: Request) {
  return (
    request.headers.get("x-arch-review-worker-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

function parseLimit(request: Request) {
  const raw = new URL(request.url).searchParams.get("limit");
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.min(10, parsed));
}

async function runWorker(request: Request) {
  const limit = parseLimit(request);
  const configuredSecret = process.env.ARCH_REVIEW_WORKER_SECRET ?? "";
  const receivedSecret = providedSecret(request);

  if (!configuredSecret) {
    await createInternalAuditLog("internal.architecture_review_worker.not_configured");
    return jsonNoStore(
      { error: "Architecture review worker secret is not configured." },
      { status: 503 },
    );
  }

  if (!receivedSecret || !safeSecretEqual(configuredSecret, receivedSecret)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await drainArchitectureReviewQueue({
      limit,
    });

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

    return jsonNoStore({
      status: "ok",
      ...result,
    });
  } catch (error) {
    if (isSchemaDriftError(error)) {
      await createInternalAuditLog("internal.architecture_review_worker.schema_unavailable", {
        limit,
      });
      return jsonNoStore(
        { error: "Architecture review queue schema is unavailable." },
        { status: 503 },
      );
    }

    console.error("architecture review worker run failed", error);
    await createInternalAuditLog("internal.architecture_review_worker.failed", {
      limit,
      errorName: error instanceof Error ? error.name : "unknown_error",
    });

    return jsonNoStore(
      {
        error: "Architecture review worker run failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return runWorker(request);
}

export async function GET(_request: Request) {
  void _request;
  return methodNotAllowedJson("POST");
}
