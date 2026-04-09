import { jsonNoStore } from "@/lib/internal-route";
import { buildPublicHealthReport } from "@/lib/public-health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function buildResponse(request: Request) {
  const report = await buildPublicHealthReport({
    observedHost: new URL(request.url).host,
  });

  return {
    report,
    status: report.status === "ok" ? 200 : 503,
  };
}

export async function GET(request: Request) {
  const { report, status } = await buildResponse(request);
  return jsonNoStore(report, { status });
}

export async function HEAD(request: Request) {
  const { status } = await buildResponse(request);
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
