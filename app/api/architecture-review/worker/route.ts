import { runArchitectureReviewWorkerBatch } from "@/lib/architecture-review/worker-run";
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

  const result = await runArchitectureReviewWorkerBatch(limit);
  if (result.status === "schema_unavailable") {
    return jsonNoStore(
      { error: result.error },
      { status: 503 },
    );
  }

  if (result.status === "failed") {
    return jsonNoStore({ error: result.error }, { status: 500 });
  }

  return jsonNoStore(result);
}

export async function POST(request: Request) {
  return runWorker(request);
}

export async function GET(_request: Request) {
  void _request;
  return methodNotAllowedJson("POST");
}
