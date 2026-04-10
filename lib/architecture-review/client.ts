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
const PDF_TEXT_TIMEOUT_MS = 120_000;
const PDF_TEXT_MAX_PAGES = 20;
const PDF_OCR_MAX_PAGES = 8;
const PDF_OCR_MAX_FILE_BYTES = 6 * 1024 * 1024;
const PDF_OCR_MAX_LONG_EDGE = 1_800;
const PDF_MIN_USABLE_TEXT_CHARS = 80;

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

type ExtractPdfTextOptions = {
  onProgress?: (progress: PngOcrProgress) => void;
  timeoutMs?: number;
  maxPages?: number;
  maxOcrPages?: number;
};

function normalizeExtractedText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasUsablePdfEvidence(text: string) {
  const normalized = normalizeExtractedText(text);
  if (normalized.length >= PDF_MIN_USABLE_TEXT_CHARS) {
    return true;
  }

  if (/\b(api gateway|cloudfront|lambda|dynamodb|kms|cloudwatch|vpc|subnet|load balancer|rds|s3)\b/i.test(normalized)) {
    return true;
  }

  return normalized.split(/\s+/).filter(Boolean).length >= 12;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

type RenderableCanvas = HTMLCanvasElement | OffscreenCanvas;

function createRenderableCanvas(width: number, height: number): RenderableCanvas {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  return new OffscreenCanvas(width, height);
}

async function canvasToBlob(canvas: RenderableCanvas) {
  if ("convertToBlob" in canvas) {
    return canvas.convertToBlob({ type: "image/png" });
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Browser PDF OCR could not convert the rendered page to an image."));
    }, "image/png");
  });
}

function releaseCanvas(canvas: RenderableCanvas) {
  if ("width" in canvas) {
    canvas.width = 1;
  }

  if ("height" in canvas) {
    canvas.height = 1;
  }
}

async function renderPdfPageBlob(page: any) {
  const baseViewport = page.getViewport({ scale: 1 });
  const longestEdge = Math.max(baseViewport.width, baseViewport.height, 1);
  const scale = Math.max(1.25, Math.min(2, PDF_OCR_MAX_LONG_EDGE / longestEdge));
  const viewport = page.getViewport({ scale });
  const canvas = createRenderableCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
  const canvasContext = canvas.getContext("2d", { alpha: false });

  if (!canvasContext) {
    releaseCanvas(canvas);
    throw new Error("Browser PDF OCR could not allocate a canvas context.");
  }

  try {
    await page.render({
      canvasContext,
      viewport,
    }).promise;

    return await canvasToBlob(canvas);
  } finally {
    releaseCanvas(canvas);
  }
}

export async function extractPdfTextEvidence(file: File, options?: ExtractPdfTextOptions) {
  const timeoutMs = Math.max(5_000, Math.round(options?.timeoutMs ?? PDF_TEXT_TIMEOUT_MS));
  const maxPages = Math.max(1, Math.round(options?.maxPages ?? PDF_TEXT_MAX_PAGES));
  const maxOcrPages = Math.max(1, Math.round(options?.maxOcrPages ?? PDF_OCR_MAX_PAGES));
  const pdfBytes = new Uint8Array(await file.arrayBuffer());
  const pdfjs = await import("pdfjs-dist/legacy/webpack.mjs");
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });

  const extractPromise = (async () => {
    const pdf = await loadingTask.promise;
    const totalPages = Math.min(pdf.numPages, maxPages);
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = (textContent.items as Array<{ str?: string }>)
        .map((item) => item.str?.trim() ?? "")
        .filter(Boolean)
        .join(" ");

      if (pageText.trim()) {
        pageTexts.push(pageText.trim());
      }

      options?.onProgress?.({
        percent: clampPercent((pageNumber / totalPages) * 45),
        status: `text-page-${pageNumber}`,
      });
      page.cleanup();
    }

    const extractedText = normalizeExtractedText(pageTexts.join(" "));
    if (hasUsablePdfEvidence(extractedText)) {
      return extractedText;
    }

    if (file.size > PDF_OCR_MAX_FILE_BYTES) {
      throw new Error(
        `Scanned PDF OCR is limited to files up to ${Math.round(PDF_OCR_MAX_FILE_BYTES / 1024 / 1024)}MB in privacy mode. Compress the PDF or use standard mode.`,
      );
    }

    if (pdf.numPages > maxOcrPages) {
      throw new Error(
        `Scanned PDF OCR is limited to ${maxOcrPages} pages in privacy mode. Split the PDF or use standard mode.`,
      );
    }

    const { createWorker } = await import("tesseract.js");
    let currentPage = 1;
    const worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (typeof message.progress !== "number") {
          return;
        }

        options?.onProgress?.({
          percent: clampPercent(45 + (((currentPage - 1) + message.progress) / totalPages) * 55),
          status: typeof message.status === "string" ? `ocr-${message.status}` : `ocr-page-${currentPage}`,
        });
      },
    });

    try {
      const ocrTexts: string[] = [];

      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        currentPage = pageNumber;
        options?.onProgress?.({
          percent: clampPercent(45 + ((pageNumber - 1) / totalPages) * 55),
          status: `ocr-page-${pageNumber}`,
        });

        const page = await pdf.getPage(pageNumber);

        try {
          const imageBlob = await renderPdfPageBlob(page);
          const ocrResult = await worker.recognize(imageBlob);
          const pageText = normalizeExtractedText(ocrResult.data.text || "");

          if (pageText) {
            ocrTexts.push(pageText);
          }
        } finally {
          page.cleanup();
        }
      }

      const ocrText = normalizeExtractedText(ocrTexts.join(" "));
      if (!hasUsablePdfEvidence(ocrText)) {
        throw new Error(
          "Browser PDF OCR could not find enough architecture evidence. Try a cleaner export, fewer pages, or standard mode.",
        );
      }

      return ocrText;
    } finally {
      await worker.terminate();
    }
  })();

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Browser PDF OCR timed out while processing the PDF."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([extractPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    await loadingTask.destroy();
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
