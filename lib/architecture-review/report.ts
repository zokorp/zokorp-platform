import {
  calculateAnalysisConfidence,
  buildArchitectureConsultationQuote,
  calculateFixCostUSD,
  calculateOverallScore,
  compareFindingsDeterministically,
  determineQuoteTier,
  intentGroupForRule,
  isCriticalFinding,
  mergedEvidenceText,
  type ArchitectureQuoteContext,
} from "@/lib/architecture-review/quote";
import { buildFallbackArchitectureEstimateSnapshot } from "@/lib/architecture-review/estimate-snapshot";
import { getArchitectureReviewRule } from "@/lib/architecture-review/rules";
import { resolveArchitectureReviewScope } from "@/lib/architecture-review/scope";
import {
  ARCHITECTURE_REVIEW_VERSION,
  architectureFindingDraftSchema,
  architectureReviewReportSchema,
  type ArchitectureFinding,
  type ArchitectureFindingDraft,
  type ArchitectureProvider,
  type ArchitectureReviewReport,
  type ArchitectureReviewScope,
} from "@/lib/architecture-review/types";

function truncate(input: string, maxLength: number) {
  const trimmed = input.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

type ArchitectureFindingInput = Pick<
  ArchitectureFindingDraft,
  "ruleId" | "category" | "pointsDeducted" | "message" | "fix" | "evidence"
> &
  Partial<
    Omit<
      ArchitectureFindingDraft,
      "ruleId" | "category" | "pointsDeducted" | "message" | "fix" | "evidence"
    >
  >;

function resolveRuleForFinding(ruleId: string, provider: ArchitectureProvider) {
  if (ruleId.includes(":")) {
    return getArchitectureReviewRule(ruleId);
  }

  if (ruleId === "diagram_narrative_core_component_mismatch") {
    return getArchitectureReviewRule(`shared:${ruleId}`);
  }

  if (provider !== "multi") {
    return getArchitectureReviewRule(`${provider}:${ruleId}`);
  }

  return getArchitectureReviewRule(ruleId);
}

function normalizeFindingDraft(
  input: ArchitectureFindingInput,
  provider: ArchitectureProvider,
): ArchitectureFindingDraft {
  const rule = resolveRuleForFinding(input.ruleId, provider);
  const ruleId = rule?.id ?? truncate(input.ruleId, 80);
  const pointsDeducted = Math.max(0, Math.min(100, Math.round(input.pointsDeducted)));
  const recommendationType =
    input.recommendationType ??
    (input.message.toLowerCase().startsWith("clarify:")
      ? "clarify"
      : input.message.toLowerCase().startsWith("optional:")
        ? "optional"
        : pointsDeducted > 0
          ? "fix"
          : "optional");
  const why = truncate(input.why ?? rule?.customerSummarySnippet ?? input.message.replace(/^[^:]+:\s*/, ""), 180);
  const evidenceSeen = truncate(input.evidenceSeen ?? input.evidence, 240);
  const howToFix = truncate(input.howToFix ?? rule?.remediationSummary ?? input.fix, 320);
  const officialSourceLinks =
    input.officialSourceLinks && input.officialSourceLinks.length > 0
      ? input.officialSourceLinks
      : rule?.officialSourceLinks ?? [
          {
            label: "Architecture guidance",
            url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html",
          },
        ];

  return {
    ruleId,
    category: input.category,
    pointsDeducted,
    recommendationType,
    why,
    evidenceSeen,
    howToFix,
    officialSourceLinks: officialSourceLinks.slice(0, 4),
    ruleVersion: truncate(input.ruleVersion ?? rule?.ruleVersion ?? "manual-v1", 40),
    message: truncate(input.message, 160),
    fix: truncate(input.fix || howToFix, 320),
    evidence: truncate(input.evidence || evidenceSeen, 240),
  };
}

function sortFindingDrafts(findings: ArchitectureFindingDraft[]) {
  return [...findings].sort(compareFindingsDeterministically);
}

function mergeByIntentGroup(findings: ArchitectureFindingDraft[]) {
  const grouped = new Map<string, ArchitectureFindingDraft[]>();

  for (const finding of findings) {
    const intentGroup = intentGroupForRule(finding.ruleId);
    const key = `${finding.category}:${intentGroup}`;
    const bucket = grouped.get(key);
    if (bucket) {
      bucket.push(finding);
    } else {
      grouped.set(key, [finding]);
    }
  }

  return [...grouped.values()].map((bucket) => {
    const sortedBucket = sortFindingDrafts(bucket);
    const winner = sortedBucket[0];
    const mergedEvidence = mergedEvidenceText(bucket.map((item) => item.evidence));
    return {
      ...winner,
      evidence: mergedEvidence || winner.evidence,
    };
  });
}

function limitFindings(findings: ArchitectureFindingDraft[]) {
  if (findings.length <= 20) {
    return findings;
  }

  const sorted = sortFindingDrafts(findings);
  const critical = sorted.filter((finding) => isCriticalFinding(finding));

  if (critical.length >= 20) {
    return critical.slice(0, 20);
  }

  const nonCritical = sorted.filter((finding) => !isCriticalFinding(finding));
  const selected = [...critical, ...nonCritical.slice(0, 20 - critical.length)];
  return sortFindingDrafts(selected);
}

export function finalizeFindings(
  inputFindings: ArchitectureFindingInput[],
  provider: ArchitectureProvider,
): ArchitectureFinding[] {
  const parsedFindings = inputFindings
    .map((finding) => architectureFindingDraftSchema.safeParse(normalizeFindingDraft(finding, provider)))
    .filter((result) => result.success)
    .map((result) => result.data);

  const dedupedByRuleId = new Map<string, ArchitectureFindingDraft>();
  for (const finding of parsedFindings) {
    if (!dedupedByRuleId.has(finding.ruleId)) {
      dedupedByRuleId.set(finding.ruleId, finding);
      continue;
    }

    const existing = dedupedByRuleId.get(finding.ruleId)!;
    if (finding.pointsDeducted > existing.pointsDeducted) {
      dedupedByRuleId.set(finding.ruleId, finding);
    }
  }

  const mergedByIntent = mergeByIntentGroup([...dedupedByRuleId.values()]);
  const sorted = sortFindingDrafts(mergedByIntent);
  const limited = limitFindings(sorted);

  return limited.map((finding) => ({
    ...finding,
    fixCostUSD: calculateFixCostUSD(finding.category, finding.pointsDeducted),
  }));
}

export function buildArchitectureReviewReport(input: {
  provider: ArchitectureProvider;
  reviewScope?: ArchitectureReviewScope;
  flowNarrative: string;
  findings: ArchitectureFindingInput[];
  userEmail: string;
  generatedAtISO?: string;
  quoteContext?: ArchitectureQuoteContext;
  analysisConfidenceOverride?: ArchitectureReviewReport["analysisConfidence"];
  quoteTierOverride?: ArchitectureReviewReport["quoteTier"];
}): ArchitectureReviewReport {
  const reviewScope =
    input.reviewScope ??
    resolveArchitectureReviewScope({
      provider: input.provider,
    });
  const findings = finalizeFindings(input.findings, input.provider);
  const overallScore = calculateOverallScore(findings);
  const analysisConfidence = input.analysisConfidenceOverride ?? calculateAnalysisConfidence(findings, input.quoteContext);
  const quoteTier =
    input.quoteTierOverride ??
    determineQuoteTier({
      overallScore,
      desiredEngagement: input.quoteContext?.desiredEngagement,
      analysisConfidence,
      regulatoryScope: input.quoteContext?.regulatoryScope,
    });
  // ARCH-Q02: store the SAME engine the customer sees. The email and Stripe checkout render
  // Formula B (buildArchitectureEstimateSnapshot.totalUsd); the legacy Formula A figure was
  // computed, stored, and never shown. Derive the stored headline from the canonical (no-override)
  // snapshot so the persisted consultationQuoteUSD equals the deterministic number the customer is
  // quoted, and there is no longer a second, divergent money formula in the report.
  const generatedAtISO = input.generatedAtISO ?? new Date().toISOString();
  const userEmail = input.userEmail.trim().toLowerCase();
  const baseReport: ArchitectureReviewReport = {
    reportVersion: ARCHITECTURE_REVIEW_VERSION,
    provider: input.provider,
    reviewScope,
    overallScore,
    analysisConfidence,
    quoteTier,
    flowNarrative: truncate(input.flowNarrative, 2000),
    findings,
    consultationQuoteUSD: 0,
    consultationQuote: {
      quoteLow: 0,
      quoteHigh: 0,
      lineItems: [
        {
          code: "architecture-advisory-baseline",
          label: "Advisory review baseline",
          amountLow: 0,
          amountHigh: 0,
          reason: "Placeholder used only to derive the canonical estimate snapshot.",
        },
      ],
      rationaleLines: ["Placeholder."],
    },
    generatedAtISO,
    userEmail,
  };

  const consultationQuoteUSD = buildFallbackArchitectureEstimateSnapshot(baseReport).snapshot.totalUsd;
  const consultationQuote = buildArchitectureConsultationQuote({
    findings,
    consultationQuoteUSD,
    quoteTier,
    analysisConfidence,
  });

  const report: ArchitectureReviewReport = {
    ...baseReport,
    consultationQuoteUSD,
    consultationQuote,
  };

  const parsed = architectureReviewReportSchema.parse(report);
  return {
    ...parsed,
    findings: sortFindingDrafts(parsed.findings).map((finding) => ({
      ...finding,
      fixCostUSD: calculateFixCostUSD(finding.category, finding.pointsDeducted),
    })),
  };
}

export function summarizeTopIssues(findings: ArchitectureFinding[], maxItems = 3) {
  return findings
    .filter((finding) => finding.pointsDeducted > 0)
    .slice(0, maxItems)
    .map((finding) => `${finding.ruleId}:${finding.pointsDeducted}`)
    .join(", ");
}
