import { z } from "zod";

const MAX_BODY_CHARS = 16_384;
const MAX_REPORTS_PER_REQUEST = 5;
const MAX_TEXT_CHARS = 240;

const legacyCspReportSchema = z
  .object({
    "document-uri": z.string().optional(),
    referrer: z.string().optional(),
    "violated-directive": z.string().optional(),
    "effective-directive": z.string().optional(),
    "blocked-uri": z.string().optional(),
    disposition: z.string().optional(),
    "status-code": z.number().int().optional(),
    "source-file": z.string().optional(),
    "line-number": z.number().int().optional(),
    "column-number": z.number().int().optional(),
    "script-sample": z.string().optional(),
  })
  .passthrough();

const legacyPayloadSchema = z
  .object({
    "csp-report": legacyCspReportSchema,
  })
  .passthrough();

const reportingApiCspBodySchema = z
  .object({
    documentURL: z.string().optional(),
    referrer: z.string().optional(),
    effectiveDirective: z.string().optional(),
    blockedURL: z.string().optional(),
    disposition: z.string().optional(),
    statusCode: z.number().int().optional(),
    sourceFile: z.string().optional(),
    lineNumber: z.number().int().optional(),
    columnNumber: z.number().int().optional(),
    sample: z.string().optional(),
  })
  .passthrough();

const reportingApiEnvelopeSchema = z
  .object({
    type: z.string(),
    url: z.string().optional(),
    body: z.unknown().optional(),
  })
  .passthrough();

export type NormalizedCspViolationReport = {
  blockedUri: string | null;
  columnNumber: number | null;
  disposition: string | null;
  documentUri: string | null;
  effectiveDirective: string | null;
  lineNumber: number | null;
  referrer: string | null;
  sourceFile: string | null;
  sample: string | null;
  statusCode: number | null;
  violatedDirective: string | null;
};

function normalizeText(value: string | undefined, options?: { collapseWhitespace?: boolean }) {
  if (!value) {
    return null;
  }

  const normalized = options?.collapseWhitespace ? value.replace(/\s+/g, " ") : value;
  const trimmed = normalized.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, MAX_TEXT_CHARS);
}

function sanitizeUri(value: string | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (
    lower === "inline" ||
    lower === "eval" ||
    lower === "self" ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("about:") ||
    lower.startsWith("chrome-extension:")
  ) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return normalized;
  }
}

function normalizeLegacyReport(
  report: z.infer<typeof legacyCspReportSchema>,
): NormalizedCspViolationReport {
  return {
    blockedUri: sanitizeUri(report["blocked-uri"]),
    columnNumber: report["column-number"] ?? null,
    disposition: normalizeText(report.disposition),
    documentUri: sanitizeUri(report["document-uri"]),
    effectiveDirective: normalizeText(report["effective-directive"]),
    lineNumber: report["line-number"] ?? null,
    referrer: sanitizeUri(report.referrer),
    sourceFile: sanitizeUri(report["source-file"]),
    sample: normalizeText(report["script-sample"], { collapseWhitespace: true }),
    statusCode: report["status-code"] ?? null,
    violatedDirective: normalizeText(report["violated-directive"]),
  };
}

function normalizeReportingApiReport(
  body: z.infer<typeof reportingApiCspBodySchema>,
  fallbackDocumentUri?: string,
): NormalizedCspViolationReport {
  return {
    blockedUri: sanitizeUri(body.blockedURL),
    columnNumber: body.columnNumber ?? null,
    disposition: normalizeText(body.disposition),
    documentUri: sanitizeUri(body.documentURL ?? fallbackDocumentUri),
    effectiveDirective: normalizeText(body.effectiveDirective),
    lineNumber: body.lineNumber ?? null,
    referrer: sanitizeUri(body.referrer),
    sourceFile: sanitizeUri(body.sourceFile),
    sample: normalizeText(body.sample, { collapseWhitespace: true }),
    statusCode: body.statusCode ?? null,
    violatedDirective: normalizeText(body.effectiveDirective),
  };
}

export function extractCspViolationReports(payload: unknown): NormalizedCspViolationReport[] {
  const legacy = legacyPayloadSchema.safeParse(payload);
  if (legacy.success) {
    return [normalizeLegacyReport(legacy.data["csp-report"])];
  }

  const reportItems = Array.isArray(payload) ? payload : [payload];
  const parsedItems = z.array(reportingApiEnvelopeSchema).safeParse(reportItems);
  if (!parsedItems.success) {
    return [];
  }

  return parsedItems.data
    .filter((item) => item.type === "csp-violation")
    .map((item) => {
      const body = reportingApiCspBodySchema.safeParse(item.body);
      if (!body.success) {
        return null;
      }

      return normalizeReportingApiReport(body.data, item.url);
    })
    .filter((item): item is NormalizedCspViolationReport => item !== null)
    .slice(0, MAX_REPORTS_PER_REQUEST);
}

export function parseCspReportBody(bodyText: string) {
  const trimmed = bodyText.trim();
  if (!trimmed || trimmed.length > MAX_BODY_CHARS) {
    return [];
  }

  try {
    return extractCspViolationReports(JSON.parse(trimmed));
  } catch {
    return [];
  }
}

export function summarizeCspReports(reports: NormalizedCspViolationReport[]) {
  return {
    reportCount: reports.length,
    reports,
  };
}
