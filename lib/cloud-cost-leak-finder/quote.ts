import { QUOTE_PRICING_DEFAULTS } from "@/lib/cloud-cost-leak-finder/config";
import type { ExtractedCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import type {
  CloudCostLeakFinderAnswers,
  CloudCostLeakFinderQuote,
  CloudCostLeakFinderScoreSet,
  QuoteConfidence,
  QuoteTier,
  VerdictClass,
  WasteCategory,
} from "@/lib/cloud-cost-leak-finder/types";

function roundQuote(value: number) {
  if (value < 1_000) {
    return Math.round(value / 25) * 25;
  }

  return Math.round(value / 50) * 50;
}

function pickQuoteTier(input: {
  answers: CloudCostLeakFinderAnswers;
  scores: CloudCostLeakFinderScoreSet;
  verdictClass: VerdictClass;
  likelyWasteCategories: WasteCategory[];
  extractedSignals: ExtractedCloudCostSignals;
}) {
  const spendBand = input.answers.adaptiveAnswers.monthlySpendBand ?? "under_5k";
  const architectureDriven =
    input.likelyWasteCategories.includes("OVERENGINEERED_ARCHITECTURE") ||
    input.likelyWasteCategories.includes("MANAGED_SERVICE_MISMATCH");
  const quickWinCount = input.likelyWasteCategories.filter((category) =>
    ["IDLE_NON_PROD", "OVERPROVISIONED_COMPUTE", "STORAGE_LIFECYCLE_GAPS", "BACKUP_SNAPSHOT_SPRAWL", "NO_BUDGET_ALERTS", "COMMITMENT_GAPS"].includes(category),
  ).length;

  if (
    input.scores.implementationComplexityScore >= 88 ||
    (input.answers.adaptiveAnswers.customerCriticality === "highly_sensitive" &&
      input.extractedSignals.providers.length > 1 &&
      input.likelyWasteCategories.length >= 5)
  ) {
    return "Custom Scope Required" as QuoteTier;
  }

  if (input.verdictClass === "BILLING_DATA_NEEDED" || input.scores.confidenceScore < 45) {
    return "Cost Triage Call" as QuoteTier;
  }

  if (
    spendBand === "50k_plus" &&
    (input.answers.adaptiveAnswers.workloadScope === "many_systems" ||
      input.scores.implementationComplexityScore >= 65 ||
      input.likelyWasteCategories.length >= 5)
  ) {
    return "Cost + Platform Rationalization Sprint" as QuoteTier;
  }

  if (
    architectureDriven &&
    (input.answers.adaptiveAnswers.architectureFlexibility === "major_redesign" ||
      input.answers.adaptiveAnswers.architectureFlexibility === "some_redesign")
  ) {
    return "Architecture Cost Review" as QuoteTier;
  }

  if (quickWinCount >= 3 && input.scores.wasteRiskScore >= 65 && input.scores.finopsMaturityScore < 55) {
    return "FinOps Cleanup Sprint" as QuoteTier;
  }

  if (input.scores.savingsConfidenceScore >= 55 && input.scores.confidenceScore >= 55) {
    return "Savings Opportunity Memo" as QuoteTier;
  }

  return "Cost Triage Call" as QuoteTier;
}

function quoteConfidenceFromScores(input: {
  tier: QuoteTier;
  scores: CloudCostLeakFinderScoreSet;
  extractedSignals: ExtractedCloudCostSignals;
}) {
  if (
    input.tier === "Custom Scope Required" ||
    input.scores.confidenceScore < 50 ||
    input.scores.implementationComplexityScore >= 75
  ) {
    return "low" as QuoteConfidence;
  }

  if (
    input.extractedSignals.providers.length > 1 ||
    input.scores.confidenceScore < 70 ||
    input.scores.implementationComplexityScore >= 55
  ) {
    return "medium" as QuoteConfidence;
  }

  return "high" as QuoteConfidence;
}

export function buildCloudCostLeakFinderQuote(input: {
  answers: CloudCostLeakFinderAnswers;
  scores: CloudCostLeakFinderScoreSet;
  verdictClass: VerdictClass;
  likelyWasteCategories: WasteCategory[];
  extractedSignals: ExtractedCloudCostSignals;
}): CloudCostLeakFinderQuote {
  const tier = pickQuoteTier(input);
  const defaults = QUOTE_PRICING_DEFAULTS[tier];
  let quoteLow = defaults.quoteLow;
  let quoteHigh = defaults.quoteHigh;

  const spendBand = input.answers.adaptiveAnswers.monthlySpendBand ?? "under_5k";
  if (spendBand === "15k_to_50k") {
    quoteLow *= 1.08;
    quoteHigh *= 1.08;
  }

  if (spendBand === "50k_plus") {
    quoteLow *= 1.18;
    quoteHigh *= 1.18;
  }

  if (input.answers.adaptiveAnswers.workloadScope === "many_systems") {
    quoteLow *= 1.12;
    quoteHigh *= 1.12;
  }

  if (input.extractedSignals.providers.length > 1) {
    quoteLow *= 1.08;
    quoteHigh *= 1.08;
  }

  if (input.answers.adaptiveAnswers.customerCriticality === "highly_sensitive") {
    quoteLow *= 1.12;
    quoteHigh *= 1.12;
  }

  if (input.likelyWasteCategories.length >= 5) {
    quoteLow *= 1.1;
    quoteHigh *= 1.1;
  }

  if (input.verdictClass === "BILLING_DATA_NEEDED") {
    quoteLow = defaults.quoteLow;
    quoteHigh = defaults.quoteHigh;
  }

  const confidence = quoteConfidenceFromScores({
    tier,
    scores: input.scores,
    extractedSignals: input.extractedSignals,
  });

  const rationaleLines = [
    tier === "Cost Triage Call"
      ? "A short triage call fits best because the inputs still need tighter billing context before a larger scope is sensible."
      : tier === "Savings Opportunity Memo"
        ? "A written savings memo fits because the likely leak pattern is clear enough without assuming a larger delivery sprint."
        : tier === "FinOps Cleanup Sprint"
          ? "A cleanup sprint fits because the likely waste is mostly governance, rightsizing, and environment hygiene."
          : tier === "Architecture Cost Review"
            ? "An architecture review fits because the cost problem appears tied to platform shape, not just obvious cleanup gaps."
            : tier === "Cost + Platform Rationalization Sprint"
              ? "A broader rationalization sprint fits because the likely waste spans multiple environments, systems, or teams."
              : "The environment looks broad enough that the final scope should be tightened after a deeper review.",
    `The quote is driven by ${input.likelyWasteCategories.length} likely waste categories, a ${input.answers.adaptiveAnswers.workloadScope?.replaceAll("_", " ") ?? "mixed"} scope, and a ${spendBand.replaceAll("_", " ")} spend band.`,
    "This range is deterministic and rounded on purpose. It is meant to scope solo consulting effort, not pretend invoice-level precision.",
  ];

  return {
    engagementType: tier,
    quoteLow: roundQuote(quoteLow),
    quoteHigh: roundQuote(Math.max(quoteHigh, quoteLow + (quoteLow < 1_000 ? 50 : 150))),
    confidence,
    rationaleLines: rationaleLines.slice(0, 3),
  };
}
