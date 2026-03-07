import { SAVINGS_BAND_BY_CATEGORY, SPEND_BAND_RANGES } from "@/lib/cloud-cost-leak-finder/config";
import type {
  CloudCostLeakFinderAnswers,
  CloudCostLeakFinderSavingsEstimate,
  CloudCostLeakFinderScoreSet,
  WasteCategory,
} from "@/lib/cloud-cost-leak-finder/types";

function roundMoney(value: number) {
  if (value < 1_000) {
    return Math.round(value / 50) * 50;
  }

  return Math.round(value / 100) * 100;
}

export function formatUsdRange(low: number, high: number) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return `${formatter.format(low)} - ${formatter.format(high)}`;
}

export function estimateCloudCostSavings(input: {
  answers: CloudCostLeakFinderAnswers;
  scores: CloudCostLeakFinderScoreSet;
  likelyWasteCategories: WasteCategory[];
}): CloudCostLeakFinderSavingsEstimate {
  const spendBand = (input.answers.adaptiveAnswers.monthlySpendBand ?? "under_5k") as keyof typeof SPEND_BAND_RANGES;
  const spendRange = SPEND_BAND_RANGES[spendBand];
  const rawOpportunity = input.likelyWasteCategories.reduce(
    (totals, category) => {
      const band = SAVINGS_BAND_BY_CATEGORY[category];
      totals.low += band.low;
      totals.high += band.high;
      return totals;
    },
    { low: 0, high: 0 },
  );

  let lowFactor = Math.min(rawOpportunity.low, 0.22);
  let highFactor = Math.min(rawOpportunity.high, 0.34);
  const confidenceMultiplier = 0.55 + input.scores.confidenceScore / 200;
  const savingsMultiplier = 0.6 + input.scores.savingsConfidenceScore / 170;

  lowFactor *= confidenceMultiplier;
  highFactor *= savingsMultiplier;

  if (input.scores.implementationComplexityScore >= 75) {
    highFactor *= 0.85;
  }

  if (input.scores.finopsMaturityScore >= 75) {
    lowFactor *= 0.85;
    highFactor *= 0.9;
  }

  if (input.likelyWasteCategories.includes("NEEDS_REAL_BILLING_DATA")) {
    lowFactor = Math.min(lowFactor, 0.05);
    highFactor = Math.min(highFactor, 0.12);
  }

  const monthlyLow = Math.max(100, roundMoney(spendRange.low * Math.max(lowFactor, 0.01)));
  const monthlyHigh = Math.max(monthlyLow + 100, roundMoney(spendRange.high * Math.max(highFactor, lowFactor + 0.02)));
  const annualLow = roundMoney(monthlyLow * 12);
  const annualHigh = roundMoney(monthlyHigh * 12);

  return {
    likelyMonthlySavingsLow: monthlyLow,
    likelyMonthlySavingsHigh: monthlyHigh,
    likelyAnnualSavingsLow: annualLow,
    likelyAnnualSavingsHigh: annualHigh,
    estimatedMonthlySavingsRange: formatUsdRange(monthlyLow, monthlyHigh),
    estimatedAnnualSavingsRange: formatUsdRange(annualLow, annualHigh),
  };
}
