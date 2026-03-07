import {
  QUOTE_BASE_PACKAGES,
  QUOTE_CATEGORY_LINE_ITEMS,
  QUOTE_SCOPE_LINE_ITEMS,
  QUOTE_TIER_GUARDRAILS,
} from "@/lib/cloud-cost-leak-finder/config";
import type { ExtractedCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import type {
  CloudCostLeakFinderAnswers,
  CloudCostLeakFinderQuoteLineItem,
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

function roundQuoteHigh(value: number) {
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

function uniqueLineItems(items: CloudCostLeakFinderQuoteLineItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildLineItems(input: {
  tier: QuoteTier;
  answers: CloudCostLeakFinderAnswers;
  likelyWasteCategories: WasteCategory[];
  extractedSignals: ExtractedCloudCostSignals;
}) {
  const lineItems: CloudCostLeakFinderQuoteLineItem[] = [
    {
      ...QUOTE_BASE_PACKAGES[input.tier],
    },
  ];

  const categoryItems = input.likelyWasteCategories
    .filter((category) => category !== "NEEDS_REAL_BILLING_DATA" || input.tier === "Cost Triage Call")
    .slice(0, input.tier === "Cost Triage Call" ? 2 : 4)
    .map((category) => ({
      ...QUOTE_CATEGORY_LINE_ITEMS[category],
    }));
  lineItems.push(...categoryItems);

  if (input.answers.adaptiveAnswers.workloadScope === "many_systems") {
    lineItems.push({ ...QUOTE_SCOPE_LINE_ITEMS.manySystems });
  }

  if (input.extractedSignals.providers.length > 1) {
    lineItems.push({ ...QUOTE_SCOPE_LINE_ITEMS.multiCloud });
  }

  if (input.answers.adaptiveAnswers.architectureFlexibility === "some_redesign") {
    lineItems.push({ ...QUOTE_SCOPE_LINE_ITEMS.someRedesign });
  }

  if (input.answers.adaptiveAnswers.architectureFlexibility === "major_redesign") {
    lineItems.push({ ...QUOTE_SCOPE_LINE_ITEMS.majorRedesign });
  }

  if (input.answers.adaptiveAnswers.customerCriticality === "customer_facing") {
    lineItems.push({ ...QUOTE_SCOPE_LINE_ITEMS.customerFacing });
  }

  if (input.answers.adaptiveAnswers.customerCriticality === "highly_sensitive") {
    lineItems.push({ ...QUOTE_SCOPE_LINE_ITEMS.highlySensitive });
  }

  return uniqueLineItems(lineItems).slice(0, 8);
}

export function buildCloudCostLeakFinderQuote(input: {
  answers: CloudCostLeakFinderAnswers;
  scores: CloudCostLeakFinderScoreSet;
  verdictClass: VerdictClass;
  likelyWasteCategories: WasteCategory[];
  extractedSignals: ExtractedCloudCostSignals;
}): CloudCostLeakFinderQuote {
  const tier = pickQuoteTier(input);
  const spendBand = input.answers.adaptiveAnswers.monthlySpendBand ?? "under_5k";
  const lineItems = buildLineItems({
    tier,
    answers: input.answers,
    likelyWasteCategories: input.likelyWasteCategories,
    extractedSignals: input.extractedSignals,
  });
  let quoteLow = lineItems.reduce((sum, item) => sum + item.amountLow, 0);
  let quoteHigh = lineItems.reduce((sum, item) => sum + item.amountHigh, 0);

  if (spendBand === "5k_to_15k") {
    quoteHigh *= 1.03;
  }

  if (spendBand === "15k_to_50k") {
    quoteLow *= 1.05;
    quoteHigh *= 1.08;
  }

  if (spendBand === "50k_plus") {
    quoteLow *= 1.08;
    quoteHigh *= 1.12;
  }

  if (input.scores.implementationComplexityScore >= 80) {
    quoteHigh *= 1.06;
  }

  if (input.verdictClass === "BILLING_DATA_NEEDED") {
    quoteLow = Math.min(quoteLow, QUOTE_TIER_GUARDRAILS[tier].maximumHigh);
    quoteHigh = Math.min(quoteHigh, QUOTE_TIER_GUARDRAILS[tier].maximumHigh);
  }

  quoteLow = Math.max(quoteLow, QUOTE_TIER_GUARDRAILS[tier].minimumLow);
  quoteHigh = Math.min(Math.max(quoteHigh, quoteLow + 50), QUOTE_TIER_GUARDRAILS[tier].maximumHigh);

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
    `The quote is itemized from the strongest findings plus scope factors like ${input.answers.adaptiveAnswers.workloadScope?.replaceAll("_", " ") ?? "mixed"} scope and the ${spendBand.replaceAll("_", " ")} spend band.`,
    "This range stays intentionally competitive for a solo consulting engagement and is rounded on purpose instead of pretending invoice-level precision.",
  ];

  return {
    engagementType: tier,
    quoteLow: roundQuote(quoteLow),
    quoteHigh: roundQuoteHigh(Math.max(quoteHigh, quoteLow + (quoteLow < 1_000 ? 50 : 150))),
    confidence,
    lineItems,
    rationaleLines: rationaleLines.slice(0, 3),
  };
}
