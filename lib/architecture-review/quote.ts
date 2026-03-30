import type {
  ArchitectureAnalysisConfidence,
  ArchitectureCategory,
  ArchitectureEngagementPreference,
  ArchitectureFinding,
  ArchitectureFindingDraft,
  ArchitectureRegulatoryScope,
  ArchitectureQuoteTier,
  ArchitectureWorkloadCriticality,
} from "@/lib/architecture-review/types";
import { scaleQuoteLineItems, type QuoteLineItem } from "@/lib/quote-line-items";

const DEFAULT_REMEDIATION_RATE_USD_PER_HOUR = 225;

const CATEGORY_DEDUCTION_CAPS: Record<ArchitectureCategory, number> = {
  security: 25,
  reliability: 20,
  operations: 15,
  performance: 10,
  cost: 10,
  sustainability: 5,
  clarity: 15,
};

const HIGH_FALSE_POSITIVE_RULE_IDS = new Set([
  "MSFT-COMPONENT-LABEL-COVERAGE",
  "CLAR-REL-LABELS-MISSING",
  "CLAR-ACRONYMS-UNEXPLAINED",
  "CLAR-OFFICIAL-ICONS-REC",
  "CLAR-NOTATION-STANDARD",
  "CLAR-BOUNDARY-EXPLICIT",
  "CLAR-VERSION-CONTROL",
]);

type SeverityBand = "low" | "med" | "high" | "critical";

const EFFORT_HOURS: Record<ArchitectureCategory, Record<SeverityBand, number>> = {
  clarity: { low: 0.25, med: 0.5, high: 1, critical: 1.5 },
  security: { low: 0.5, med: 1.5, high: 3, critical: 6 },
  reliability: { low: 0.5, med: 1.5, high: 3, critical: 6 },
  operations: { low: 0.5, med: 1.5, high: 2.5, critical: 4 },
  performance: { low: 0.5, med: 1, high: 2, critical: 3 },
  cost: { low: 0.5, med: 1, high: 2, critical: 3 },
  sustainability: { low: 0, med: 0.5, high: 1, critical: 2 },
};

export type ArchitectureQuoteContext = {
  tokenCount?: number;
  ocrCharacterCount?: number;
  mode?: "rules-only" | "webllm";
  workloadCriticality?: ArchitectureWorkloadCriticality;
  regulatoryScope?: ArchitectureRegulatoryScope;
  desiredEngagement?: ArchitectureEngagementPreference;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function scoreCapByBand(overallScore: number) {
  if (overallScore >= 90) {
    return 750;
  }

  if (overallScore >= 60) {
    return 1500;
  }

  return 2500;
}

function severityFromPoints(pointsDeducted: number): SeverityBand {
  if (pointsDeducted >= 12) {
    return "critical";
  }

  if (pointsDeducted >= 8) {
    return "high";
  }

  if (pointsDeducted >= 4) {
    return "med";
  }

  return "low";
}

function criticalityMultiplier(level: ArchitectureWorkloadCriticality | undefined) {
  switch (level) {
    case "low":
      return 0.9;
    case "mission-critical":
      return 1.2;
    case "standard":
    default:
      return 1;
  }
}

function requiresCustomScope(context: ArchitectureQuoteContext | undefined) {
  if (!context) {
    return false;
  }

  if (context.regulatoryScope && context.regulatoryScope !== "none") {
    return true;
  }

  return (
    context.desiredEngagement === "ongoing-quarterly-reviews" ||
    context.desiredEngagement === "architect-on-call"
  );
}

function hasHighFalsePositiveRiskFinding(finding: ArchitectureFinding) {
  if (HIGH_FALSE_POSITIVE_RULE_IDS.has(finding.ruleId)) {
    return true;
  }

  return finding.category === "clarity" && finding.pointsDeducted > 0 && finding.pointsDeducted <= 6;
}

function estimateConfidence(findings: ArchitectureFinding[], context: ArchitectureQuoteContext | undefined) {
  let confidence = 1;
  const highFalsePositiveCount = findings.filter(
    (finding) => finding.pointsDeducted > 0 && hasHighFalsePositiveRiskFinding(finding),
  ).length;
  confidence -= highFalsePositiveCount * 0.1;

  if (context?.mode === "webllm" && (context.ocrCharacterCount ?? 0) >= 300) {
    confidence += 0.05;
  }

  return clamp(confidence, 0.7, 1.05);
}

export function calculateConfidenceScore(findings: ArchitectureFinding[], context: ArchitectureQuoteContext | undefined) {
  return estimateConfidence(findings, context);
}

export function calculateAnalysisConfidence(
  findings: ArchitectureFinding[],
  context: ArchitectureQuoteContext | undefined,
): ArchitectureAnalysisConfidence {
  const confidence = calculateConfidenceScore(findings, context);

  if (confidence >= 0.95) {
    return "high";
  }

  if (confidence >= 0.82) {
    return "medium";
  }

  return "low";
}

export function determineQuoteTier(
  input: {
    overallScore: number;
    desiredEngagement?: ArchitectureEngagementPreference;
    analysisConfidence?: ArchitectureAnalysisConfidence;
    regulatoryScope?: ArchitectureRegulatoryScope;
  },
): ArchitectureQuoteTier {
  if (input.desiredEngagement === "review-call-only") {
    return "advisory-review";
  }

  if (
    input.desiredEngagement === "ongoing-quarterly-reviews" ||
    input.desiredEngagement === "architect-on-call" ||
    (input.regulatoryScope && input.regulatoryScope !== "none")
  ) {
    return "implementation-partner";
  }

  if (input.analysisConfidence === "low") {
    return "advisory-review";
  }

  if (input.overallScore >= 90) {
    return "advisory-review";
  }

  if (input.overallScore >= 60) {
    return "remediation-sprint";
  }

  return "implementation-partner";
}

function remediationRateUsdPerHour() {
  const configured = Number.parseInt(process.env.ARCH_REVIEW_RATE_USD_PER_HOUR ?? "", 10);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_REMEDIATION_RATE_USD_PER_HOUR;
}

function architectureServiceLineLabel(category: ArchitectureCategory) {
  switch (category) {
    case "clarity":
      return "Diagram clarity cleanup";
    case "security":
      return "Security control hardening";
    case "reliability":
      return "Reliability and recovery planning";
    case "operations":
      return "Observability and runbook hardening";
    case "performance":
      return "Performance and scaling review";
    case "cost":
      return "Cost guardrail review";
    case "sustainability":
      return "Sustainability posture review";
  }
}

function architectureQuoteBaseItem(consultationQuoteUSD: number): QuoteLineItem {
  return {
    code: "architecture-advisory-baseline",
    label: "Advisory review baseline",
    amountLow: consultationQuoteUSD,
    amountHigh: consultationQuoteUSD,
    reason: "Covers the fixed first-step review call used to validate findings, sequence fixes, and tighten next-step scope.",
  };
}

function truncateReason(value: string, maxLength = 220) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function scoreToCost(points: number, low: number, high: number) {
  if (points <= 0) {
    return 0;
  }

  if (low === high) {
    return low;
  }

  const clamped = Math.max(1, Math.min(20, points));
  const ratio = (clamped - 1) / 19;
  return Math.round(low + (high - low) * ratio);
}

export function calculateFixCostUSD(category: ArchitectureCategory, pointsDeducted: number) {
  if (pointsDeducted <= 0) {
    return 0;
  }

  switch (category) {
    case "clarity":
      return scoreToCost(pointsDeducted, 25, 75);
    case "security":
      return scoreToCost(pointsDeducted, 150, 300);
    case "reliability":
      return scoreToCost(pointsDeducted, 200, 350);
    case "operations":
      return scoreToCost(pointsDeducted, 150, 200);
    case "performance":
      return 150;
    case "cost":
      return scoreToCost(pointsDeducted, 100, 150);
    case "sustainability":
      return scoreToCost(pointsDeducted, 0, 100);
    default:
      return 0;
  }
}

export function calculateOverallScore(findings: Array<Pick<ArchitectureFindingDraft, "category" | "pointsDeducted">>) {
  return calculateOverallScoreByCategoryCaps(findings);
}

export function calculateOverallScoreByCategoryCaps(findings: Array<Pick<ArchitectureFindingDraft, "category" | "pointsDeducted">>) {
  const totals = new Map<ArchitectureCategory, number>();

  for (const finding of findings) {
    const runningTotal = totals.get(finding.category) ?? 0;
    totals.set(finding.category, runningTotal + Math.max(0, finding.pointsDeducted));
  }

  const cappedDeduction = [...totals.entries()].reduce((sum, [category, total]) => {
    return sum + Math.min(CATEGORY_DEDUCTION_CAPS[category], total);
  }, 0);

  return clamp(100 - cappedDeduction, 0, 100);
}

export function calculateConsultationQuoteUSD(
  findings: ArchitectureFinding[],
  overallScore: number,
  context?: ArchitectureQuoteContext,
) {
  const positiveFindings = findings.filter((finding) => finding.pointsDeducted > 0);

  if (context?.desiredEngagement === "review-call-only") {
    return 249;
  }

  if (requiresCustomScope(context)) {
    return 249;
  }

  if (positiveFindings.length === 0) {
    return 249;
  }

  if (!context) {
    const capByBand = scoreCapByBand(overallScore);
    const repairTotal = findings.reduce((total, finding) => {
      if (finding.pointsDeducted <= 0) {
        return total;
      }

      return total + finding.fixCostUSD;
    }, 0);

    const baseline = 249 + repairTotal;
    return Math.min(capByBand, baseline);
  }

  const baseHours = positiveFindings.reduce((total, finding) => {
    const severity = severityFromPoints(finding.pointsDeducted);
    return total + EFFORT_HOURS[finding.category][severity];
  }, 0);

  const tokenCount = Math.max(0, context.tokenCount ?? 0);
  const complexity = 1 + clamp((tokenCount - 10) / 40, 0, 0.5);
  const criticality = criticalityMultiplier(context.workloadCriticality);
  const confidence = estimateConfidence(positiveFindings, context);
  const rate = remediationRateUsdPerHour();
  const estimatedRemediationUsd = baseHours * rate * complexity * criticality * confidence;

  if (confidence < 0.85) {
    return 249;
  }

  const baseline = roundToNearest(249 + estimatedRemediationUsd, 25);
  const withMinimum = Math.max(499, baseline);
  return withMinimum;
}

export function buildArchitectureConsultationQuote(input: {
  findings: ArchitectureFinding[];
  consultationQuoteUSD: number;
  quoteTier: ArchitectureQuoteTier;
  analysisConfidence: ArchitectureAnalysisConfidence;
}) {
  if (
    input.consultationQuoteUSD <= 249 ||
    input.quoteTier !== "remediation-sprint" ||
    input.analysisConfidence === "low"
  ) {
    return {
      quoteLow: input.consultationQuoteUSD,
      quoteHigh: input.consultationQuoteUSD,
      lineItems: [architectureQuoteBaseItem(input.consultationQuoteUSD)],
      rationaleLines:
        input.analysisConfidence === "low"
          ? [
              "The fixed advisory review stays first because the current evidence bundle is not strong enough to pre-approve delivery work.",
            ]
          : input.quoteTier === "implementation-partner"
            ? [
                "The fixed advisory review stays first because broader delivery should move to custom scoping after the live call.",
              ]
            : [
                "The fixed advisory review stays first because the remaining issues fit a lighter diagnostic follow-up, not a larger sprint.",
              ],
    };
  }

  const additionalBudget = Math.max(0, input.consultationQuoteUSD - 249);
  const driverItems = scaleQuoteLineItems(
    input.findings
      .filter((finding) => finding.pointsDeducted > 0)
      .slice(0, 4)
      .map((finding) => ({
        code: `architecture-driver-${finding.ruleId.toLowerCase()}`,
        label: architectureServiceLineLabel(finding.category),
        amountLow: Math.max(1, finding.fixCostUSD),
        amountHigh: Math.max(1, finding.fixCostUSD),
        reason: truncateReason(`${finding.message} Fix focus: ${finding.fix}`),
      })),
    additionalBudget,
    additionalBudget,
  );

  return {
    quoteLow: input.consultationQuoteUSD,
    quoteHigh: input.consultationQuoteUSD,
    lineItems: [
      {
        ...architectureQuoteBaseItem(249),
      },
      ...driverItems,
    ],
    rationaleLines: [
      "The fixed advisory review stays first, then the strongest deduction clusters add bounded scope drivers for the suggested remediation sprint.",
      "These line items are scope drivers for the core quote, not separate invoice promises from the free upload alone.",
    ],
  };
}

export function categoryDeductionCaps() {
  return CATEGORY_DEDUCTION_CAPS;
}

export function sortWeightForFinding(finding: Pick<ArchitectureFinding, "pointsDeducted" | "ruleId" | "category">) {
  const severityBand = severityFromPoints(finding.pointsDeducted);
  const severityWeight = severityBand === "critical" ? 4 : severityBand === "high" ? 3 : severityBand === "med" ? 2 : 1;
  const falsePositiveRiskWeight = hasHighFalsePositiveRiskFinding({
    ...finding,
    message: "",
    fix: "",
    evidence: "",
    fixCostUSD: 0,
  })
    ? 1
    : 0;

  return {
    severityWeight,
    falsePositiveRiskWeight,
  };
}

export function isCriticalFinding(finding: Pick<ArchitectureFindingDraft, "pointsDeducted">) {
  return severityFromPoints(finding.pointsDeducted) === "critical" && finding.pointsDeducted > 0;
}

export function mergedEvidenceText(values: string[]) {
  const merged = values
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" | ");
  return merged.length <= 240 ? merged : `${merged.slice(0, 239).trimEnd()}…`;
}

export function intentGroupForRule(ruleId: string) {
  const normalized = ruleId.toUpperCase();

  if (normalized.startsWith("MSFT-META-") || normalized.startsWith("CLAR-META-")) {
    return "clar_meta";
  }

  if (normalized.includes("LEGEND")) {
    return "clar_legend";
  }

  if (normalized.includes("LAYERING")) {
    return "clar_layering";
  }

  if (normalized.startsWith("PILLAR-SECURITY") || normalized.startsWith("SEC-")) {
    return "security_controls";
  }

  if (normalized.startsWith("PILLAR-RELIABILITY") || normalized.startsWith("REL-")) {
    return "reliability_controls";
  }

  if (normalized.startsWith("PILLAR-OPERATIONS") || normalized.startsWith("OPS-")) {
    return "operations_controls";
  }

  if (normalized.startsWith("PILLAR-PERFORMANCE") || normalized.startsWith("PERF-")) {
    return "performance_controls";
  }

  if (normalized.startsWith("PILLAR-COST") || normalized.startsWith("COST-")) {
    return "cost_controls";
  }

  if (normalized.startsWith("PILLAR-SUSTAINABILITY") || normalized.startsWith("SUST-")) {
    return "sustainability_controls";
  }

  if (normalized.includes("FLOW")) {
    return "clar_flow";
  }

  if (normalized.includes("LABEL")) {
    return "clar_labels";
  }

  return normalized.split("-").slice(0, 2).join("_") || normalized;
}

export function compareFindingsDeterministically(
  a: Pick<ArchitectureFinding, "pointsDeducted" | "ruleId" | "category">,
  b: Pick<ArchitectureFinding, "pointsDeducted" | "ruleId" | "category">,
) {
  if (b.pointsDeducted !== a.pointsDeducted) {
    return b.pointsDeducted - a.pointsDeducted;
  }

  const aWeight = sortWeightForFinding(a);
  const bWeight = sortWeightForFinding(b);
  if (bWeight.severityWeight !== aWeight.severityWeight) {
    return bWeight.severityWeight - aWeight.severityWeight;
  }

  if (aWeight.falsePositiveRiskWeight !== bWeight.falsePositiveRiskWeight) {
    return aWeight.falsePositiveRiskWeight - bWeight.falsePositiveRiskWeight;
  }

  return a.ruleId.localeCompare(b.ruleId);
}

export function applyCategoryScoreCaps(findings: ArchitectureFinding[]) {
  return calculateOverallScoreByCategoryCaps(findings);
}

export function calculateLegacyConsultationQuoteUSD(findings: ArchitectureFinding[], overallScore: number) {
  const repairTotal = findings.reduce((total, finding) => {
    if (finding.pointsDeducted <= 0) {
      return total;
    }

    return total + finding.fixCostUSD;
  }, 0);

  const baseline = 249 + repairTotal;

  return Math.min(scoreCapByBand(overallScore), baseline);
}
