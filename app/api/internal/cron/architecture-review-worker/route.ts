import {
  createInternalAuditLog,
  jsonNoStore,
  methodNotAllowedJson,
  safeSecretEqual,
} from "@/lib/internal-route";
import { runArchitectureReviewWorkerBatch } from "@/lib/architecture-review/worker-run";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 3;

function providedSecret(request: Request) {
  return (
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

async function handleCronWorkerRun(request: Request) {
  const configuredSecret = process.env.CRON_SECRET ?? "";
  const receivedSecret = providedSecret(request);

  if (!configuredSecret) {
    await createInternalAuditLog("internal.cron_architecture_review_worker.not_configured");
    return jsonNoStore(
      { error: "Cron secret is not configured." },
      { status: 503 },
    );
  }

  if (!receivedSecret || !safeSecretEqual(configuredSecret, receivedSecret)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runArchitectureReviewWorkerBatch(DEFAULT_LIMIT);
  if (result.status === "schema_unavailable") {
    return jsonNoStore({ error: result.error }, { status: 503 });
  }

  if (result.status === "failed") {
    return jsonNoStore({ error: result.error }, { status: 500 });
  }

  return jsonNoStore(result);
}

export async function GET(request: Request) {
  return handleCronWorkerRun(request);
}

export async function POST(_request: Request) {
  void _request;
  return methodNotAllowedJson("GET");
}
