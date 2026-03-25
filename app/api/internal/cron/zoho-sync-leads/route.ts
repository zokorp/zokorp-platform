import {
  createInternalAuditLog,
  jsonNoStore,
  methodNotAllowedJson,
  safeSecretEqual,
} from "@/lib/internal-route";
import { runZohoLeadSync } from "@/lib/zoho-sync-leads";

export const runtime = "nodejs";

function providedSecret(request: Request) {
  return (
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

async function handleCronZohoSync(request: Request) {
  const configuredSecret = process.env.CRON_SECRET ?? "";
  const receivedSecret = providedSecret(request);

  if (!configuredSecret) {
    await createInternalAuditLog("internal.cron_zoho_sync_leads.not_configured");
    return jsonNoStore(
      { error: "Cron secret is not configured." },
      { status: 503 },
    );
  }

  if (!receivedSecret || !safeSecretEqual(configuredSecret, receivedSecret)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runZohoLeadSync();
  if (result.status === "ok") {
    return jsonNoStore(result);
  }

  if (result.status === "not_configured" || result.status === "schema_unavailable") {
    return jsonNoStore({ error: result.error }, { status: 503 });
  }

  if (result.status === "timeout") {
    return jsonNoStore({ error: result.error }, { status: 504 });
  }

  if (result.status === "request_failed" || result.status === "upstream_failed") {
    return jsonNoStore({ error: result.error }, { status: 502 });
  }

  return jsonNoStore({ error: result.error }, { status: 500 });
}

export async function GET(request: Request) {
  return handleCronZohoSync(request);
}

export async function POST(_request: Request) {
  void _request;
  return methodNotAllowedJson("GET");
}
