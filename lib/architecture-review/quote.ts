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

type ArchitectureFindingLike = Pick<
  ArchitectureFinding,
  "ruleId" | "category" | "pointsDeducted" | "fixCostUSD"
> &
  Partial<Pick<ArchitectureFinding, "message" | "fix">>;

export const DEFAULT_REMEDIATION_RATE_USD_PER_HOUR = 225;

const CATEGORY_DEDUCTION_CAPS: Record<ArchitectureCategory, number> = {
  security: 100,
  reliability: 100,
  operations: 100,
  performance: 100,
  cost: 100,
  sustainability: 100,
  clarity: 100,
};

const HIGH_FALSE_POSITIVE_RULE_IDS = new Set([
  "workload_objective_and_constraints_stated",
  "data_classification_and_compliance_noted",
  "rto_rpo_defined",
  "region_and_environment_boundaries_identified",
  "waf_on_public_endpoints",
  "vpc_flow_logs_enabled",
  "infrastructure_as_code_indicated",
]);

function stripRuleNamespace(ruleId: string) {
  const parts = ruleId.split(":");
  return parts.length > 1 ? parts.slice(1).join(":") : ruleId;
}

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
  // ARCH-Q05: the legacy "webllm" mode is gone (the local-model dependency was removed). Only the
  // deterministic "rules-only" path remains.
  mode?: "rules-only";
  workloadCriticality?: ArchitectureWorkloadCriticality;
  regulatoryScope?: ArchitectureRegulatoryScope;
  desiredEngagement?: ArchitectureEngagementPreference;
  remediationRateUsdPerHour?: number;
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

function hasHighFalsePositiveRiskFinding(
  finding: Pick<ArchitectureFindingLike, "ruleId" | "category" | "pointsDeducted">,
) {
  if (HIGH_FALSE_POSITIVE_RULE_IDS.has(stripRuleNamespace(finding.ruleId))) {
    return true;
  }

  return finding.category === "clarity" && finding.pointsDeducted > 0 && finding.pointsDeducted <= 6;
}

function estimateConfidence(findings: ArchitectureFindingLike[]) {
  let confidence = 1;
  const highFalsePositiveCount = findings.filter(
    (finding) => finding.pointsDeducted > 0 && hasHighFalsePositiveRiskFinding(finding),
  ).length;
  confidence -= highFalsePositiveCount * 0.1;

  return clamp(confidence, 0.7, 1.05);
}

// ARCH-Q05: confidence is now purely a function of the findings — the quote context no longer
// influences it after the webllm mode was removed.
export function calculateConfidenceScore(findings: ArchitectureFindingLike[]) {
  return estimateConfidence(findings);
}

export function calculateAnalysisConfidence(
  findings: ArchitectureFindingLike[],
): ArchitectureAnalysisConfidence {
  const confidence = calculateConfidenceScore(findings);

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

export function configuredArchitectureRemediationRateUsdPerHour() {
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

export type PillarScoreTone = "ok" | "watch" | "weak" | "critical";

export type PillarScore = {
  category: ArchitectureCategory;
  label: string;
  score: number;
  pointsDeducted: number;
  findingsCount: number;
  tone: PillarScoreTone;
};

const PILLAR_CATEGORY_LABELS: Record<ArchitectureCategory, string> = {
  security: "Security",
  reliability: "Reliability",
  operations: "Operations",
  performance: "Performance",
  cost: "Cost",
  sustainability: "Sustainability",
  clarity: "Diagram clarity",
};

const PILLAR_DISPLAY_ORDER: ArchitectureCategory[] = [
  "security",
  "reliability",
  "operations",
  "performance",
  "cost",
  "clarity",
];

function pillarToneForScore(score: number, findingsCount: number, hasCriticalSeverity: boolean): PillarScoreTone {
  if (findingsCount === 0) {
    return "ok";
  }

  // A single CRITICAL-severity finding (>=12 points deducted) gets the pillar
  // tagged "critical" regardless of average score — a 15-point "public database
  // exposure" should not visually feel like a "watch" item just because the
  // rest of the pillar is fine.
  if (hasCriticalSeverity) {
    return "critical";
  }

  if (score < 50) {
    return "critical";
  }

  if (score < 70) {
    return "weak";
  }

  if (score < 90) {
    return "watch";
  }

  return "ok";
}

export function calculatePillarScores(
  findings: Array<Pick<ArchitectureFindingDraft, "category" | "pointsDeducted">>,
): PillarScore[] {
  const totals = new Map<ArchitectureCategory, { deducted: number; count: number; hasCritical: boolean }>();

  for (const finding of findings) {
    const pointsDeducted = Math.max(0, finding.pointsDeducted);
    const running = totals.get(finding.category) ?? { deducted: 0, count: 0, hasCritical: false };
    running.deducted += pointsDeducted;
    if (pointsDeducted > 0) {
      running.count += 1;
    }
    if (pointsDeducted >= 12) {
      running.hasCritical = true;
    }
    totals.set(finding.category, running);
  }

  return PILLAR_DISPLAY_ORDER.map((category) => {
    const aggregated = totals.get(category) ?? { deducted: 0, count: 0, hasCritical: false };
    const cap = CATEGORY_DEDUCTION_CAPS[category];
    const cappedDeducted = Math.min(cap, aggregated.deducted);
    const score = clamp(100 - cappedDeducted, 0, 100);
    return {
      category,
      label: PILLAR_CATEGORY_LABELS[category],
      score,
      pointsDeducted: cappedDeducted,
      findingsCount: aggregated.count,
      tone: pillarToneForScore(score, aggregated.count, aggregated.hasCritical),
    };
  });
}

export type FindingSeverityLabel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export function getFindingSeverityLabel(pointsDeducted: number): FindingSeverityLabel {
  if (pointsDeducted >= 12) {
    return "CRITICAL";
  }

  if (pointsDeducted >= 8) {
    return "HIGH";
  }

  if (pointsDeducted >= 4) {
    return "MEDIUM";
  }

  return "LOW";
}

export type QuickWin = {
  ruleId: string;
  category: ArchitectureCategory;
  why: string;
  howToFix: string;
  estimatedHoursLow: number;
  estimatedHoursHigh: number;
  pointsDeducted: number;
};

const PILLAR_NAME_FOR_CATEGORY: Record<ArchitectureCategory, string> = {
  security: "security",
  reliability: "reliability",
  operations: "operations",
  performance: "performance",
  cost: "cost",
  sustainability: "sustainability",
  clarity: "diagram clarity",
};

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export type ReviewerSynthesisInput = {
  findings: Array<{
    ruleId: string;
    category: ArchitectureCategory;
    pointsDeducted: number;
    why?: string;
  }>;
  pillarScores: PillarScore[];
  overallScore: number;
  analysisConfidence: ArchitectureAnalysisConfidence;
};

// A 1–3 sentence plain-language synthesis the email leads with. Sounds like a
// human reviewer made a judgment call, not a robot listed rules. Fully
// deterministic — same input always produces the same text.
function computeSequencingText(input: ReviewerSynthesisInput): string {
  const positiveFindings = input.findings
    .filter((finding) => finding.pointsDeducted > 0)
    .slice()
    .sort((a, b) => b.pointsDeducted - a.pointsDeducted);

  const criticalFindings = positiveFindings.filter((finding) => finding.pointsDeducted >= 12);

  if (input.analysisConfidence === "low") {
    return "If this were my workload: I'd book the review call before committing any remediation hours. The visible evidence is too thin to give the work a confident estimate from a diagram alone.";
  }

  if (positiveFindings.length === 0) {
    return "If this were my workload: I'd still book the review call to validate hidden dependencies that don't show on the diagram. The remediation sprint is the wrong starting point when nothing's broken on paper.";
  }

  if (criticalFindings.length >= 3) {
    const topCategory = PILLAR_NAME_FOR_CATEGORY[criticalFindings[0].category];
    return `If this were my workload: I'd ship the top ${topCategory} fix this sprint to close the immediate exposure. The second critical right after. Everything else fits into the Remediation Sprint once those two are done — they unlock the rest.`;
  }

  if (criticalFindings.length >= 1) {
    const topCategory = PILLAR_NAME_FOR_CATEGORY[criticalFindings[0].category];
    return `If this were my workload: I'd handle the ${topCategory} critical this week, then walk through the remaining items in the Advisory Review to confirm sequencing before committing remediation hours.`;
  }

  if (positiveFindings.length >= 3) {
    const affectedPillars = input.pillarScores
      .filter((pillar) => pillar.findingsCount > 0)
      .slice()
      .sort((a, b) => b.pointsDeducted - a.pointsDeducted)
      .map((pillar) => PILLAR_NAME_FOR_CATEGORY[pillar.category]);
    const firstPillar = affectedPillars[0];
    const secondPillar = affectedPillars[1];

    if (firstPillar && secondPillar) {
      return `If this were my workload: I'd clear the Quick Wins below this week, then sequence the Remediation Sprint to fix ${firstPillar} first — ${secondPillar} gets easier once ${firstPillar} is clean. Most of the work compounds.`;
    }

    return "If this were my workload: I'd clear the Quick Wins below this week, then handle the Remediation Sprint in one focused sprint. Most of the work compounds — fixing the first pillar usually makes the next easier.";
  }

  if (input.overallScore >= 90) {
    return "If this were my workload: I'd defer these to the next planned release. The polish items aren't worth the cycle-time hit today, and the architecture is in good enough shape to ship.";
  }

  return "If this were my workload: I'd start with the fixed Advisory Review — fastest way to lock in sequencing before paying for remediation. The visible scope is small enough that a full sprint isn't justified yet.";
}

export function buildReviewerSynthesis(input: ReviewerSynthesisInput): string {
  return buildReviewerSynthesisLines(input).synthesis;
}

// Second-paragraph sequencing recommendation that opens with
// "If this were my workload" — adds the senior-consultant voice
// after the main synthesis. Also deterministic.
export function buildSequencingNote(input: ReviewerSynthesisInput): string {
  return buildReviewerSynthesisLines(input).sequencing;
}

export type ReviewerSynthesisLines = {
  synthesis: string;
  sequencing: string;
};

export function buildReviewerSynthesisLines(input: ReviewerSynthesisInput): ReviewerSynthesisLines {
  const synthesis = computeSynthesisText(input);
  const sequencing = computeSequencingText(input);
  return { synthesis, sequencing };
}

function computeSynthesisText(input: ReviewerSynthesisInput): string {
  const positiveFindings = input.findings
    .filter((finding) => finding.pointsDeducted > 0)
    .slice()
    .sort((a, b) => b.pointsDeducted - a.pointsDeducted);

  const criticalFindings = positiveFindings.filter((finding) => finding.pointsDeducted >= 12);

  if (input.analysisConfidence === "low") {
    return "I can't draw a strong conclusion from the evidence in the submission. The estimate below covers only what's clearly visible — book the review call so we can confirm hidden scope before committing to remediation work.";
  }

  if (positiveFindings.length === 0) {
    return "No mandatory deductions surfaced from the submitted material. If there are hidden dependencies or operational gaps not on the diagram, the consultation call is the cheapest way to surface them before they cost you in production.";
  }

  // 3+ critical findings — focus on the first one
  if (criticalFindings.length >= 3) {
    const topWhy = criticalFindings[0].why?.replace(/\.$/, "") ?? criticalFindings[0].ruleId;
    return `Three or more critical risks are visible in this design. Fix this one first: ${topWhy}. The rest fit a single Remediation Sprint once that's done.`;
  }

  if (criticalFindings.length >= 1) {
    const topWhy = criticalFindings[0].why?.replace(/\.$/, "") ?? criticalFindings[0].ruleId;
    const noun = criticalFindings.length === 1 ? "issue" : "issues";
    return `${criticalFindings.length} critical ${noun} ${criticalFindings.length === 1 ? "needs" : "need"} to be handled before anything else. Start with: ${topWhy}. Everything else below is sequenced behind that.`;
  }

  // No critical but enough non-critical findings to matter
  if (positiveFindings.length >= 3) {
    const affectedPillars = input.pillarScores
      .filter((pillar) => pillar.findingsCount > 0)
      .slice()
      .sort((a, b) => b.pointsDeducted - a.pointsDeducted)
      .map((pillar) => PILLAR_NAME_FOR_CATEGORY[pillar.category]);
    const pillarLabel = affectedPillars.length > 0 ? joinWithAnd(affectedPillars.slice(0, 3)) : "multiple areas";
    return `No single fire, but ${positiveFindings.length} cumulative findings across ${pillarLabel} push this below the score I'd ship to production. The Quick Wins below clear the easy ones; the Remediation Sprint handles the rest.`;
  }

  if (input.overallScore >= 90) {
    return "Solid architecture overall. The remaining items are polish — useful but not urgent. The fixed Advisory Review is the cheapest way to validate the polish path before spending on remediation.";
  }

  return "A small number of issues are visible in the design. The fixed Advisory Review is the cleanest first step — we'll validate findings, sequence the fixes, and agree on the right scope from there.";
}

// A "quick win" is a mandatory finding whose fix is bounded enough that the
// customer could realistically tackle it within their next sprint. We want the
// email to call out the top 3 so the customer feels they can act today, not
// wait for the implementation engagement.
export function selectQuickWins(
  findings: Array<{
    ruleId: string;
    category: ArchitectureCategory;
    pointsDeducted: number;
    why?: string;
    howToFix?: string;
  }>,
  options: {
    ruleHoursLookup?: (ruleId: string) => { low: number; high: number } | null;
    maxItems?: number;
  } = {},
): QuickWin[] {
  const maxItems = options.maxItems ?? 3;
  const lookup = options.ruleHoursLookup ?? (() => null);
  const candidates: QuickWin[] = [];

  for (const finding of findings) {
    if (finding.pointsDeducted <= 0) {
      continue;
    }

    const hours = lookup(finding.ruleId) ?? { low: 0, high: 0 };
    if (hours.high <= 0 || hours.high > 8) {
      // Skip items that have no hours estimate or that exceed a single
      // working day — those belong in the implementation sprint, not a
      // quick win.
      continue;
    }

    candidates.push({
      ruleId: finding.ruleId,
      category: finding.category,
      pointsDeducted: finding.pointsDeducted,
      why: finding.why ?? "",
      howToFix: finding.howToFix ?? "",
      estimatedHoursLow: hours.low,
      estimatedHoursHigh: hours.high,
    });
  }

  return candidates
    .slice()
    .sort((a, b) => {
      // Highest impact-per-hour first.
      const impactA = a.pointsDeducted / Math.max(0.5, a.estimatedHoursHigh);
      const impactB = b.pointsDeducted / Math.max(0.5, b.estimatedHoursHigh);
      return impactB - impactA;
    })
    .slice(0, maxItems);
}

/**
 * @deprecated Legacy "Formula A" consultation quote. The customer-facing number is now the single
 * source of truth in `estimate-snapshot.ts` (`buildArchitectureEstimateSnapshot.totalUsd`, "Formula
 * B"), which the email, Stripe checkout, and the stored `report.consultationQuoteUSD` all derive
 * from (see report.ts, ARCH-Q02). This function is retained only for its unit tests; do NOT wire it
 * back into report generation, the email, or checkout without retiring Formula B first.
 */
export function calculateConsultationQuoteUSD(
  findings: ArchitectureFindingLike[],
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
  const confidence = estimateConfidence(positiveFindings);
  const rate = context?.remediationRateUsdPerHour ?? DEFAULT_REMEDIATION_RATE_USD_PER_HOUR;
  const estimatedRemediationUsd = baseHours * rate * complexity * criticality * confidence;

  if (confidence < 0.85) {
    return 249;
  }

  const baseline = roundToNearest(249 + estimatedRemediationUsd, 25);
  const withMinimum = Math.max(499, baseline);
  return withMinimum;
}

export function buildArchitectureConsultationQuote(input: {
  findings: ArchitectureFindingLike[];
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
        reason: truncateReason(`${finding.message ?? "Architecture issue"} Fix focus: ${finding.fix ?? "Clarify remediation scope."}`),
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
  const falsePositiveRiskWeight = hasHighFalsePositiveRiskFinding(finding) ? 1 : 0;

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
  const normalized = stripRuleNamespace(ruleId).toUpperCase();

  if (normalized.includes("DIAGRAM_NARRATIVE") || normalized.startsWith("STATED_")) {
    return "architecture_contradictions";
  }

  if (normalized.includes("TLS") || normalized.includes("PUBLIC_") || normalized.includes("SSH") || normalized.includes("RDP")) {
    return "internet_exposure";
  }

  if (normalized.includes("DATABASE") || normalized.includes("RDS")) {
    return "database_resilience";
  }

  if (normalized.includes("CLOUDWATCH") || normalized.includes("CLOUDTRAIL") || normalized.includes("LOGGING")) {
    return "observability_controls";
  }

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

  return normalized.split(/[_-]/).slice(0, 2).join("_") || normalized;
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

export function applyCategoryScoreCaps(findings: ArchitectureFindingLike[]) {
  return calculateOverallScoreByCategoryCaps(findings);
}

export function calculateLegacyConsultationQuoteUSD(findings: ArchitectureFindingLike[], overallScore: number) {
  const repairTotal = findings.reduce((total, finding) => {
    if (finding.pointsDeducted <= 0) {
      return total;
    }

    return total + finding.fixCostUSD;
  }, 0);

  const baseline = 249 + repairTotal;

  return Math.min(scoreCapByBand(overallScore), baseline);
}
