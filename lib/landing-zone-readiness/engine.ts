import { READINESS_CATEGORY_LABELS, READINESS_CATEGORY_WEIGHTS } from "@/lib/landing-zone-readiness/config";
import { buildLandingZoneQuote } from "@/lib/landing-zone-readiness/quote";
import { evaluateLandingZoneRules } from "@/lib/landing-zone-readiness/rules";
import type {
  LandingZoneReadinessAnswers,
  LandingZoneReadinessFinding,
  LandingZoneReadinessReport,
  MaturityBand,
  ReadinessCategory,
} from "@/lib/landing-zone-readiness/types";

const CATEGORY_ORDER: ReadinessCategory[] = [
  "identity_access",
  "org_structure",
  "network_foundation",
  "security_baseline",
  "logging_monitoring",
  "backup_dr",
  "iac_delivery",
  "cost_governance",
  "environment_separation",
  "operations_readiness",
];

const severityWeight = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function maturityBandFromScore(overallScore: number): MaturityBand {
  if (overallScore >= 90) {
    return "Strong Foundation";
  }

  if (overallScore >= 75) {
    return "Usable but Gapped";
  }

  if (overallScore >= 55) {
    return "At Risk";
  }

  return "Fragile Foundation";
}

export function sortLandingZoneFindings(findings: LandingZoneReadinessFinding[]) {
  return [...findings].sort((left, right) => {
    if (right.pointsDeducted !== left.pointsDeducted) {
      return right.pointsDeducted - left.pointsDeducted;
    }

    if (severityWeight[right.severity] !== severityWeight[left.severity]) {
      return severityWeight[right.severity] - severityWeight[left.severity];
    }

    const categoryCompare = CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return left.finding.localeCompare(right.finding);
  });
}

function mergeDuplicateFindings(findings: LandingZoneReadinessFinding[]) {
  const byKey = new Map<string, LandingZoneReadinessFinding>();

  for (const finding of findings) {
    const key = `${finding.category}:${finding.finding.trim().toLowerCase()}`;
    const existing = byKey.get(key);

    if (!existing || finding.pointsDeducted > existing.pointsDeducted) {
      byKey.set(key, finding);
    }
  }

  return [...byKey.values()];
}

export function buildCategoryScores(
  deductionsByCategory: Record<ReadinessCategory, number>,
): Record<ReadinessCategory, number> {
  return CATEGORY_ORDER.reduce(
    (scores, category) => {
      const maxWeight = READINESS_CATEGORY_WEIGHTS[category];
      const deducted = clamp(deductionsByCategory[category] ?? 0, 0, maxWeight);
      scores[category] = clamp(100 - Math.round((deducted / maxWeight) * 100), 0, 100);
      return scores;
    },
    {} as Record<ReadinessCategory, number>,
  );
}

function buildSummaryLine(input: {
  maturityBand: MaturityBand;
  categoryScores: Record<ReadinessCategory, number>;
  findings: LandingZoneReadinessFinding[];
}) {
  const weakestCategories = CATEGORY_ORDER.map((category) => ({
    category,
    score: input.categoryScores[category],
  }))
    .sort((left, right) => left.score - right.score)
    .slice(0, 2)
    .map((entry) => READINESS_CATEGORY_LABELS[entry.category].toLowerCase());

  const leadFinding = input.findings[0]?.finding ?? "no major gaps were detected";

  if (input.maturityBand === "Strong Foundation") {
    return `Your cloud foundation is strong. The main follow-up item is ${leadFinding.toLowerCase()}.`;
  }

  return `Your cloud foundation is ${input.maturityBand.toLowerCase()}. The biggest gaps are in ${weakestCategories.join(" and ")}.`;
}

export function buildLandingZoneReadinessReport(
  answers: LandingZoneReadinessAnswers,
): LandingZoneReadinessReport {
  const evaluatedRules = evaluateLandingZoneRules(answers);

  const deductionsByCategory = CATEGORY_ORDER.reduce(
    (accumulator, category) => {
      accumulator[category] = 0;
      return accumulator;
    },
    {} as Record<ReadinessCategory, number>,
  );

  for (const rule of evaluatedRules) {
    deductionsByCategory[rule.category] += rule.pointsDeducted;
  }

  const categoryScores = buildCategoryScores(deductionsByCategory);
  const totalDeduction = CATEGORY_ORDER.reduce((sum, category) => sum + deductionsByCategory[category], 0);
  const overallScore = clamp(100 - totalDeduction, 0, 100);
  const maturityBand = maturityBandFromScore(overallScore);

  const allFindings = mergeDuplicateFindings(
    evaluatedRules.map((rule) => ({
      ruleId: rule.ruleId,
      category: rule.category,
      pointsDeducted: rule.pointsDeducted,
      severity: rule.severity,
      finding: rule.finding,
      fix: rule.fix,
    })),
  );

  const sortedFindings = sortLandingZoneFindings(allFindings);
  const quote = buildLandingZoneQuote({
    answers,
    overallScore,
    findings: sortedFindings,
  });
  const findings = sortedFindings.slice(0, 12);

  return {
    reportVersion: "1.0",
    generatedAtISO: new Date().toISOString(),
    overallScore,
    categoryScores,
    maturityBand,
    findings,
    quote,
    summaryLine: buildSummaryLine({
      maturityBand,
      categoryScores,
      findings,
    }),
  };
}
