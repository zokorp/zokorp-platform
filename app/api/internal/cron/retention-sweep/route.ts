import {
  createInternalAuditLog,
  jsonNoStore,
  methodNotAllowedJson,
  safeSecretEqual,
} from "@/lib/internal-route";
import { runRetentionSweep } from "@/lib/retention-sweep";

export const runtime = "nodejs";

function providedSecret(request: Request) {
  return (
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

async function handleRetentionSweep(request: Request) {
  const configuredSecret = process.env.CRON_SECRET ?? "";
  const receivedSecret = providedSecret(request);

  if (!configuredSecret) {
    await createInternalAuditLog("internal.retention_sweep.not_configured");
    return jsonNoStore(
      { error: "Cron secret is not configured." },
      { status: 503 },
    );
  }

  if (!receivedSecret || !safeSecretEqual(configuredSecret, receivedSecret)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runRetentionSweep();

    await createInternalAuditLog("internal.retention_sweep.completed", {
      ...result,
    });

    return jsonNoStore({
      status: "ok",
      ...result,
    });
  } catch (error) {
    console.error("retention sweep failed", error);

    await createInternalAuditLog("internal.retention_sweep.failed", {
      errorName: error instanceof Error ? error.name : "unknown_error",
    });

    return jsonNoStore(
      { error: "Retention sweep failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleRetentionSweep(request);
}

export async function GET(request: Request) {
  return handleRetentionSweep(request);
}

export async function PUT(_request: Request) {
  void _request;
  return methodNotAllowedJson("GET, POST");
}
