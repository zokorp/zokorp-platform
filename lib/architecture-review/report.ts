import {
  calculateAnalysisConfidence,
  calculateConsultationQuoteUSD,
  calculateFixCostUSD,
  calculateOverallScore,
  compareFindingsDeterministically,
  determineQuoteTier,
  intentGroupForRule,
  isCriticalFinding,
  mergedEvidenceText,
  type ArchitectureQuoteContext,
} from "@/lib/architecture-review/quote";
import {
  ARCHITECTURE_REVIEW_VERSION,
  architectureFindingDraftSchema,
  architectureReviewReportSchema,
  type ArchitectureFinding,
  type ArchitectureFindingDraft,
  type ArchitectureProvider,
  type ArchitectureReviewReport,
} from "@/lib/architecture-review/types";

function truncate(input: string, maxLength: number) {
  const trimmed = input.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeFindingDraft(input: ArchitectureFindingDraft): ArchitectureFindingDraft {
  return {
    ruleId: truncate(input.ruleId, 80),
    category: input.category,
    pointsDeducted: Math.max(0, Math.min(100, Math.round(input.pointsDeducted))),
    message: truncate(input.message, 120),
    fix: truncate(input.fix, 160),
    evidence: truncate(input.evidence, 240),
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

export function finalizeFindings(inputFindings: ArchitectureFindingDraft[]): ArchitectureFinding[] {
  const parsedFindings = inputFindings
    .map((finding) => architectureFindingDraftSchema.safeParse(normalizeFindingDraft(finding)))
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
  flowNarrative: string;
  findings: ArchitectureFindingDraft[];
  userEmail: string;
  generatedAtISO?: string;
  quoteContext?: ArchitectureQuoteContext;
  analysisConfidenceOverride?: ArchitectureReviewReport["analysisConfidence"];
  quoteTierOverride?: ArchitectureReviewReport["quoteTier"];
}): ArchitectureReviewReport {
  const findings = finalizeFindings(input.findings);
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
  const consultationQuoteUSD = calculateConsultationQuoteUSD(findings, overallScore, input.quoteContext);

  const report: ArchitectureReviewReport = {
    reportVersion: ARCHITECTURE_REVIEW_VERSION,
    provider: input.provider,
    overallScore,
    analysisConfidence,
    quoteTier,
    flowNarrative: truncate(input.flowNarrative, 2000),
    findings,
    consultationQuoteUSD,
    generatedAtISO: input.generatedAtISO ?? new Date().toISOString(),
    userEmail: input.userEmail.trim().toLowerCase(),
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
