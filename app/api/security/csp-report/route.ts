import { NextResponse } from "next/server";

import { parseCspReportBody, summarizeCspReports } from "@/lib/csp-report";
import { db } from "@/lib/db";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";

export const runtime = "nodejs";

const CSP_REPORT_RATE_LIMIT = 20;
const CSP_REPORT_WINDOW_MS = 15 * 60 * 1000;

function noContent() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeUserAgent(userAgent: string | null) {
  const trimmed = userAgent?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 240);
}

export async function POST(request: Request) {
  try {
    const limiter = await consumeRateLimit({
      key: `csp-report:${getRequestFingerprint(request)}`,
      limit: CSP_REPORT_RATE_LIMIT,
      windowMs: CSP_REPORT_WINDOW_MS,
    });

    if (!limiter.allowed) {
      return noContent();
    }

    const reports = parseCspReportBody(await request.text());
    if (reports.length === 0) {
      return noContent();
    }

    await db.auditLog.create({
      data: {
        action: "security.csp_violation",
        metadataJson: {
          ...summarizeCspReports(reports),
          contentType: request.headers.get("content-type"),
          userAgent: normalizeUserAgent(request.headers.get("user-agent")),
        },
      },
    });
  } catch (error) {
    console.error("csp-report ingestion failed", error);
  }

  return noContent();
}
