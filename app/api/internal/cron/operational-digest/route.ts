import {
  createInternalAuditLog,
  jsonNoStore,
  methodNotAllowedJson,
  safeSecretEqual,
} from "@/lib/internal-route";
import { runOperationalDigest } from "@/lib/operational-digest";

export const runtime = "nodejs";

function providedSecret(request: Request) {
  return (
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

async function handleOperationalDigest(request: Request) {
  const configuredSecret = process.env.CRON_SECRET ?? "";
  const receivedSecret = providedSecret(request);

  if (!configuredSecret) {
    await createInternalAuditLog("internal.operational_digest.not_configured");
    return jsonNoStore(
      { error: "Cron secret is not configured." },
      { status: 503 },
    );
  }

  if (!receivedSecret || !safeSecretEqual(configuredSecret, receivedSecret)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    // ?always=1 forces the email even when no issues are present (default skips
    // when there's nothing to report so we don't spam the inbox).
    const skipWhenAllClear = url.searchParams.get("always") !== "1";

    const result = await runOperationalDigest({ skipWhenAllClear });

    await createInternalAuditLog("internal.operational_digest.run", {
      status: result.status,
      hasIssues: result.digest.hasIssues,
      totalCriticalCount: result.digest.totalCriticalCount,
      sectionCount: result.digest.sections.length,
      emailProvider: result.email?.provider ?? null,
      emailError: result.email?.error ?? null,
    });

    return jsonNoStore({
      status: result.status,
      hasIssues: result.digest.hasIssues,
      totalCriticalCount: result.digest.totalCriticalCount,
      sectionLabels: result.digest.sections.map((section) => section.label),
    });
  } catch (error) {
    console.error("operational digest failed", error);

    await createInternalAuditLog("internal.operational_digest.failed", {
      errorName: error instanceof Error ? error.name : "unknown_error",
    });

    return jsonNoStore(
      { error: "Operational digest failed." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleOperationalDigest(request);
}

export async function GET(request: Request) {
  return handleOperationalDigest(request);
}

export async function PUT(_request: Request) {
  void _request;
  return methodNotAllowedJson("GET, POST");
}
