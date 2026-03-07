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
const MAX_DIAGRAM_FILE_BYTES = 8 * 1024 * 1024;

function isPngBytes(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
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

export async function isStrictDiagramFile(file: File): Promise<
  | { ok: true; format: ArchitectureDiagramFormat; mimeType: "image/png" | "image/svg+xml" }
  | { ok: false; error: string }
> {
  const lowerName = file.name.toLowerCase();
  const isPngName = lowerName.endsWith(".png");
  const isSvgName = lowerName.endsWith(".svg");

  if (!isPngName && !isSvgName) {
    return {
      ok: false,
      error: "File name must end with .png or .svg.",
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

  if (isPngName) {
    const bytes = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer());
    if (bytes.length < PNG_SIGNATURE.length || !isPngBytes(bytes)) {
      return {
        ok: false,
        error: "Invalid PNG signature.",
      };
    }

    return {
      ok: true,
      format: "png",
      mimeType: "image/png",
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
