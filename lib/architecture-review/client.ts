import {
  buildDeterministicNarrative,
  buildDeterministicReviewFindings,
  extractServiceTokens,
} from "@/lib/architecture-review/engine";
import { createEvidenceBundle } from "@/lib/architecture-review/evidence";
import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";
import type { ArchitectureQuoteContext } from "@/lib/architecture-review/quote";
import {
  architectureFindingDraftSchema,
  llmRefinementSchema,
  type ArchitectureDiagramFormat,
  type ArchitectureEvidenceBundle,
  type ArchitectureProvider,
  type ArchitectureReviewReport,
  type ArchitectureAnalysisConfidence,
  type ArchitectureQuoteTier,
  type LlmRefinement,
} from "@/lib/architecture-review/types";
import { extractSvgLabelText, parseSvgDimensions, validateSvgMarkup } from "@/lib/architecture-review/svg-safety";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];
const MAX_DIAGRAM_FILE_BYTES = 8 * 1024 * 1024;
const PNG_OCR_TIMEOUT_MS = 90_000;

function isPngBytes(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function isJpegBytes(bytes: Uint8Array) {
  return JPEG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function isPdfBytes(bytes: Uint8Array) {
  return PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

export async function extractSvgEvidence(file: File) {
  const rawSvg = await file.text();
  const validation = validateSvgMarkup(rawSvg);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const text = extractSvgLabelText(rawSvg);
  const dimensions = parseSvgDimensions(rawSvg);
  return {
    text,
    dimensions,
  };
}

type PngOcrProgress = {
  percent: number;
  status?: string;
};

type ExtractPngTextOptions = {
  onProgress?: (progress: PngOcrProgress) => void;
  timeoutMs?: number;
};

export async function extractPngTextEvidence(file: File, options?: ExtractPngTextOptions) {
  const timeoutMs = Math.max(5_000, Math.round(options?.timeoutMs ?? PNG_OCR_TIMEOUT_MS));
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (typeof message.progress !== "number") {
        return;
      }

      options?.onProgress?.({
        percent: Math.max(0, Math.min(100, Math.round(message.progress * 100))),
        status: typeof message.status === "string" ? message.status : undefined,
      });
    },
  });

  const recognizePromise = worker.recognize(file);
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Browser OCR timed out while processing the PNG."));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([recognizePromise, timeoutPromise]);
    return (result.data.text || "").replace(/\s+/g, " ").trim();
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    await worker.terminate();
  }
}

export async function isStrictDiagramFile(file: File): Promise<
  | {
      ok: true;
      format: ArchitectureDiagramFormat;
      mimeType: "image/png" | "image/jpeg" | "application/pdf" | "image/svg+xml";
    }
  | { ok: false; error: string }
> {
  const lowerName = file.name.toLowerCase();
  const isPngName = lowerName.endsWith(".png");
  const isJpgName = lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");
  const isPdfName = lowerName.endsWith(".pdf");
  const isSvgName = lowerName.endsWith(".svg");

  if (!isPngName && !isJpgName && !isPdfName && !isSvgName) {
    return {
      ok: false,
      error: "File name must end with .png, .jpg, .jpeg, .pdf, or .svg.",
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: "Uploaded file is empty.",
    };
  }

  if (file.size > MAX_DIAGRAM_FILE_BYTES) {
    return {
      ok: false,
      error: "File is too large. Upload a file up to 8MB.",
    };
  }

  if (isPngName || isJpgName || isPdfName) {
    const signatureLength = isPngName ? PNG_SIGNATURE.length : isJpgName ? JPEG_SIGNATURE.length : PDF_SIGNATURE.length;
    const bytes = new Uint8Array(await file.slice(0, signatureLength).arrayBuffer());
    const signatureValid = isPngName
      ? bytes.length >= PNG_SIGNATURE.length && isPngBytes(bytes)
      : isJpgName
        ? bytes.length >= JPEG_SIGNATURE.length && isJpegBytes(bytes)
        : bytes.length >= PDF_SIGNATURE.length && isPdfBytes(bytes);

    if (!signatureValid) {
      return {
        ok: false,
        error: isPngName ? "Invalid PNG signature." : isJpgName ? "Invalid JPEG signature." : "Invalid PDF signature.",
      };
    }

    return {
      ok: true,
      format: isPngName ? "png" : isJpgName ? "jpg" : "pdf",
      mimeType: isPngName ? "image/png" : isJpgName ? "image/jpeg" : "application/pdf",
    };
  }

  const rawSvg = await file.text();
  const svgValidation = validateSvgMarkup(rawSvg);
  if (!svgValidation.ok) {
    return svgValidation;
  }

  if (file.type && !["image/svg+xml", "application/xml", "text/xml"].includes(file.type)) {
    return {
      ok: false,
      error: "SVG file type is invalid.",
    };
  }

  return {
    ok: true,
    format: "svg",
    mimeType: "image/svg+xml",
  };
}

export async function isStrictPngFile(file: File) {
  const result = await isStrictDiagramFile(file);
  if (!result.ok) {
    return result;
  }

  if (result.format !== "png") {
    return {
      ok: false,
      error: "Only PNG files are allowed.",
    } as const;
  }

  return {
    ok: true,
  } as const;
}

export { createEvidenceBundle };

function dedupeMergeFindings(
  deterministicFindings: ReturnType<typeof buildDeterministicReviewFindings>,
  refinement: LlmRefinement | null,
) {
  if (!refinement || refinement.findings.length === 0) {
    return deterministicFindings;
  }

  const byRuleId = new Map(deterministicFindings.map((finding) => [finding.ruleId, finding]));

  for (const rawFinding of refinement.findings) {
    const parsed = architectureFindingDraftSchema.safeParse(rawFinding);
    if (!parsed.success) {
      continue;
    }

    const finding = parsed.data;
    const existing = byRuleId.get(finding.ruleId);

    if (!existing) {
      byRuleId.set(finding.ruleId, finding);
      continue;
    }

    byRuleId.set(finding.ruleId, {
      ...existing,
      pointsDeducted: finding.pointsDeducted,
      message: finding.message,
      fix: finding.fix,
      evidence: finding.evidence,
      category: finding.category,
    });
  }

  return [...byRuleId.values()];
}

export function parseLlmRefinement(raw: unknown): LlmRefinement | null {
  const parsed = llmRefinementSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export function buildReviewReportFromEvidence(input: {
  bundle: ArchitectureEvidenceBundle;
  userEmail: string;
  llmRefinement?: LlmRefinement | null;
  quoteContext?: ArchitectureQuoteContext;
  analysisConfidenceOverride?: ArchitectureAnalysisConfidence;
  quoteTierOverride?: ArchitectureQuoteTier;
}): ArchitectureReviewReport {
  const deterministicFindings = buildDeterministicReviewFindings(input.bundle);
  const mergedFindings = dedupeMergeFindings(deterministicFindings, input.llmRefinement ?? null);

  const narrative = input.llmRefinement?.flowNarrative?.trim() || buildDeterministicNarrative(input.bundle);

  return buildArchitectureReviewReport({
    provider: input.bundle.provider,
    flowNarrative: narrative,
    findings: mergedFindings,
    userEmail: input.userEmail,
    quoteContext: input.quoteContext,
    analysisConfidenceOverride: input.analysisConfidenceOverride,
    quoteTierOverride: input.quoteTierOverride,
  });
}

export function buildServiceTokensFromText(provider: ArchitectureProvider, text: string) {
  return extractServiceTokens(provider, text);
}
