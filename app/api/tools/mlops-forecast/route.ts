import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonNoStore } from "@/lib/internal-route";
import { requireEntitlement } from "@/lib/entitlements";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { maxUploadBytes } from "@/lib/security";
import { recordOperationalIssue } from "@/lib/operational-issues";
import {
  buildDemoRevenueSeries,
  buildRevenueForecastFromPoints,
  buildRevenueForecastFromRows,
  parseRevenueCsvRows,
} from "@/lib/mlops-forecast";
import { recordMlopsForecastToolRun } from "@/lib/tool-runs";
import { readXlsxWorkbookRows } from "@/lib/workbook";
import { EntitlementStatus } from "@prisma/client";

export const runtime = "nodejs";

const formSchema = z.object({
  runMode: z.enum(["upload", "demo"]).default("upload"),
});

function isForecastFileAllowed(filename: string, mimeType: string) {
  const lower = filename.toLowerCase();
  const csvName = lower.endsWith(".csv");
  const xlsxName = lower.endsWith(".xlsx");
  const csvMime = ["text/csv", "application/csv", "text/plain"].includes(mimeType);
  const xlsxMime = mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return (csvName && csvMime) || (xlsxName && xlsxMime) || (csvName && !mimeType) || (xlsxName && !mimeType);
}

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      crossSiteResponse.headers.set("Cache-Control", "no-store");
      return crossSiteResponse;
    }

    const user = await requireUser();
    const limiter = await consumeRateLimit({
      key: `mlops-forecast:${user.id}:${getRequestFingerprint(request)}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return jsonNoStore(
        { error: "Rate limit reached. Please wait before running another forecast." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const parsedForm = formSchema.safeParse({
      runMode: request.headers.get("x-mlops-run-mode") ?? undefined,
    });

    const formData = await request.formData();
    const formMode = typeof formData.get("runMode") === "string" ? formData.get("runMode") : null;
    const runMode = formSchema.parse({
      runMode: typeof formMode === "string" ? formMode : parsedForm.success ? parsedForm.data.runMode : "upload",
    }).runMode;

    const access = await requireEntitlement({
      userId: user.id,
      productSlug: "mlops-foundation-platform",
      minUses: 1,
    });

    const fileEntry = formData.get("file");
    let result;
    let sourceName = "Demo revenue series";
    let sourceType: "csv" | "xlsx" | "demo" = "demo";

    if (runMode === "demo") {
      result = buildRevenueForecastFromPoints(buildDemoRevenueSeries(), {
        sourceType: "demo",
        sourceName,
      });
    } else {
      if (!(fileEntry instanceof File)) {
        return jsonNoStore({ error: "Upload a CSV or XLSX file first." }, { status: 400 });
      }

      const maxBytes = maxUploadBytes(Number(process.env.UPLOAD_MAX_MB ?? "10"));
      if (fileEntry.size <= 0 || fileEntry.size > maxBytes) {
        return jsonNoStore(
          { error: `File too large. Max allowed is ${process.env.UPLOAD_MAX_MB ?? 10}MB.` },
          { status: 413 },
        );
      }

      if (!isForecastFileAllowed(fileEntry.name, fileEntry.type)) {
        return jsonNoStore(
          { error: "Unsupported file type. Upload a CSV or XLSX revenue series." },
          { status: 400 },
        );
      }

      sourceName = fileEntry.name;
      const bytes = new Uint8Array(await fileEntry.arrayBuffer());

      if (fileEntry.name.toLowerCase().endsWith(".xlsx")) {
        const workbookRows = await readXlsxWorkbookRows(Buffer.from(bytes));
        result = buildRevenueForecastFromRows(workbookRows, sourceName, "xlsx");
        sourceType = "xlsx";
      } else {
        const text = new TextDecoder().decode(bytes);
        const points = parseRevenueCsvRows(text);
        result = buildRevenueForecastFromPoints(points, {
          sourceType: "csv",
          sourceName,
        });
        sourceType = "csv";
      }
    }

    let auditId: string | null = null;
    try {
      const audit = await db.auditLog.create({
        data: {
          userId: user.id,
          action: "tool.mlops_forecast_run",
          metadataJson: {
            sourceType,
            sourceName,
            observations: result.observations,
            cadenceLabel: result.cadenceLabel,
            confidenceScore: result.confidenceScore,
            confidenceLabel: result.confidenceLabel,
            trendPerPeriod: result.trendPerPeriod,
            totalRevenue: result.totalRevenue,
            demoRun: runMode === "demo",
          },
        },
      });
      auditId = audit.id;
    } catch (error) {
      console.error("Failed to write MLOps forecast audit log", error);
    }

    try {
      await recordMlopsForecastToolRun({
        userId: user.id,
        summary: `${sourceName} · ${result.confidenceLabel} confidence`,
        inputFileName: runMode === "demo" ? null : sourceName,
        sourceType,
        sourceName,
        confidenceScore: result.confidenceScore,
        confidenceLabel: result.confidenceLabel,
        report: result,
        metadata: {
          observations: result.observations,
          cadenceLabel: result.cadenceLabel,
          trendPerPeriod: result.trendPerPeriod,
          totalRevenue: result.totalRevenue,
          demoRun: runMode === "demo",
        },
      });
    } catch (toolRunError) {
      console.error("Failed to persist MLOps forecast run", toolRunError);
    }

    return jsonNoStore({
      ...result,
      sourceName,
      sourceType,
      auditId,
      access: {
        productId: access.productId,
        adminBypass: access.adminBypass,
        entitlementActive: access.entitlement?.status === EntitlementStatus.ACTIVE,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") {
        return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
      }

      if (error.message === "ENTITLEMENT_REQUIRED" || error.message === "INSUFFICIENT_USES") {
        return jsonNoStore({ error: "Subscription required before running this workspace." }, { status: 402 });
      }

      if (error.message === "No revenue points were found.") {
        return jsonNoStore(
          {
            error:
              "No revenue points were found. Make sure the file has a date column and a revenue/value column with real numbers.",
          },
          { status: 400 },
        );
      }
    }

    await recordOperationalIssue({
      action: "tool.mlops_forecast_failed",
      area: "tool-run",
      error,
      metadata: {
        route: "/api/tools/mlops-forecast",
      },
    });
    return jsonNoStore({ error: "Forecast execution failed" }, { status: 500 });
  }
}
