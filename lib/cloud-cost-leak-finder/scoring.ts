import type { ExtractedCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import type {
  CloudCostLeakFinderAnswers,
  CloudCostLeakFinderScoreSet,
} from "@/lib/cloud-cost-leak-finder/types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreMaturitySignal(state: "present" | "missing" | "unknown", positive: number, negative: number) {
  if (state === "present") {
    return positive;
  }

  if (state === "missing") {
    return negative;
  }

  return 0;
}

export function buildCloudCostScores(input: {
  answers: CloudCostLeakFinderAnswers;
  extractedSignals: ExtractedCloudCostSignals;
}): CloudCostLeakFinderScoreSet {
  const { answers, extractedSignals } = input;
  const adaptive = answers.adaptiveAnswers;

  let wasteRiskScore = 35;
  if (extractedSignals.costPainSignals.includes("rapid_growth")) wasteRiskScore += 8;
  if (extractedSignals.costPainSignals.includes("unknown_spend_drivers")) wasteRiskScore += 10;
  if (extractedSignals.costPainSignals.includes("idle_non_prod_waste")) wasteRiskScore += 12;
  if (extractedSignals.costPainSignals.includes("oversized_compute")) wasteRiskScore += 12;
  if (extractedSignals.costPainSignals.includes("storage_sprawl")) wasteRiskScore += 9;
  if (extractedSignals.costPainSignals.includes("egress_network_costs")) wasteRiskScore += 11;
  if (extractedSignals.costPainSignals.includes("database_cost_inflation")) wasteRiskScore += 9;
  if (extractedSignals.costPainSignals.includes("kubernetes_inefficiency")) wasteRiskScore += 12;
  if (extractedSignals.costPainSignals.includes("gpu_waste")) wasteRiskScore += 12;
  if (extractedSignals.costPainSignals.includes("duplicate_environments")) wasteRiskScore += 7;
  if (extractedSignals.costPainSignals.includes("overengineered_ha_dr")) wasteRiskScore += 6;
  if (extractedSignals.costPainSignals.includes("lack_resource_ownership_tagging")) wasteRiskScore += 7;
  if (extractedSignals.costPainSignals.includes("poor_budgeting_alerting")) wasteRiskScore += 8;
  if (extractedSignals.costPainSignals.includes("vendor_commitment_gaps")) wasteRiskScore += 7;
  if (adaptive.nonProdRuntime === "mixed") wasteRiskScore += 10;
  if (adaptive.nonProdRuntime === "always_on") wasteRiskScore += 18;
  if (adaptive.rightsizingCadence === "occasional") wasteRiskScore += 8;
  if (adaptive.rightsizingCadence === "rare") wasteRiskScore += 15;
  if (adaptive.storageLifecycle === "partial") wasteRiskScore += 9;
  if (adaptive.storageLifecycle === "no") wasteRiskScore += 14;
  if (adaptive.crossRegionTraffic === "some") wasteRiskScore += 5;
  if (adaptive.crossRegionTraffic === "high") wasteRiskScore += 10;
  if (adaptive.databaseRightSizing === "partial") wasteRiskScore += 6;
  if (adaptive.databaseRightSizing === "unknown") wasteRiskScore += 10;
  if (adaptive.commitmentCoverage === "partial") wasteRiskScore += 4;
  if (adaptive.commitmentCoverage === "none") wasteRiskScore += 8;
  if (adaptive.budgetsAlerts === "partial") wasteRiskScore += 5;
  if (adaptive.budgetsAlerts === "none") wasteRiskScore += 10;
  if (adaptive.ownershipClarity === "partial") wasteRiskScore += 5;
  if (adaptive.ownershipClarity === "unclear") wasteRiskScore += 10;
  if (adaptive.kubernetesUtilization === "partial") wasteRiskScore += 6;
  if (adaptive.kubernetesUtilization === "unknown") wasteRiskScore += 12;
  if (adaptive.costVisibility === "partial") wasteRiskScore += 4;
  if (adaptive.costVisibility === "weak") wasteRiskScore += 8;
  if (extractedSignals.spendSignals.dominantFamily === "compute") wasteRiskScore += 4;
  if (extractedSignals.spendSignals.dominantFamily === "networking") wasteRiskScore += 4;
  if (extractedSignals.spendSignals.dominantFamily === "database") wasteRiskScore += 3;
  wasteRiskScore += scoreMaturitySignal(extractedSignals.maturitySignals.budgets, -4, 6);
  wasteRiskScore += scoreMaturitySignal(extractedSignals.maturitySignals.autoscaling, -4, 4);
  wasteRiskScore += scoreMaturitySignal(extractedSignals.maturitySignals.scheduledShutdowns, -5, 6);
  wasteRiskScore += scoreMaturitySignal(extractedSignals.maturitySignals.cleanupProcess, -4, 5);

  let finopsMaturityScore = 50;
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.budgets, 8, -10);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.tagging, 8, -10);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.ownership, 7, -9);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.autoscaling, 6, -5);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.scheduledShutdowns, 7, -7);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.costReviews, 7, -6);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.commitments, 7, -5);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.environmentSeparation, 5, -4);
  finopsMaturityScore += scoreMaturitySignal(extractedSignals.maturitySignals.cleanupProcess, 6, -6);
  if (adaptive.budgetsAlerts === "strong") finopsMaturityScore += 14;
  if (adaptive.budgetsAlerts === "partial") finopsMaturityScore += 3;
  if (adaptive.budgetsAlerts === "none") finopsMaturityScore -= 13;
  if (adaptive.ownershipClarity === "clear") finopsMaturityScore += 11;
  if (adaptive.ownershipClarity === "partial") finopsMaturityScore += 2;
  if (adaptive.ownershipClarity === "unclear") finopsMaturityScore -= 10;
  if (adaptive.nonProdRuntime === "mostly_off") finopsMaturityScore += 8;
  if (adaptive.nonProdRuntime === "always_on") finopsMaturityScore -= 9;
  if (adaptive.rightsizingCadence === "regular") finopsMaturityScore += 10;
  if (adaptive.rightsizingCadence === "occasional") finopsMaturityScore += 2;
  if (adaptive.rightsizingCadence === "rare") finopsMaturityScore -= 10;
  if (adaptive.kubernetesUtilization === "understood") finopsMaturityScore += 7;
  if (adaptive.kubernetesUtilization === "unknown") finopsMaturityScore -= 8;
  if (adaptive.storageLifecycle === "yes") finopsMaturityScore += 9;
  if (adaptive.storageLifecycle === "partial") finopsMaturityScore += 2;
  if (adaptive.storageLifecycle === "no") finopsMaturityScore -= 10;
  if (adaptive.databaseRightSizing === "regular") finopsMaturityScore += 7;
  if (adaptive.databaseRightSizing === "unknown") finopsMaturityScore -= 7;
  if (adaptive.commitmentCoverage === "strong") finopsMaturityScore += 8;
  if (adaptive.commitmentCoverage === "partial") finopsMaturityScore += 2;
  if (adaptive.commitmentCoverage === "none") finopsMaturityScore -= 9;
  if (adaptive.costVisibility === "clear") finopsMaturityScore += 7;
  if (adaptive.costVisibility === "weak") finopsMaturityScore -= 8;

  let savingsConfidenceScore = 30;
  savingsConfidenceScore += 15;
  if (extractedSignals.spendSignals.billingSummaryProvided) savingsConfidenceScore += 10;
  if (extractedSignals.spendSignals.parsedAmountCount >= 1) savingsConfidenceScore += 12;
  if (extractedSignals.spendSignals.parsedAmountCount >= 2) savingsConfidenceScore += 6;
  if (extractedSignals.spendSignals.dominantFamily) savingsConfidenceScore += 7;
  if (extractedSignals.narrativeQuality.detailBand === "medium") savingsConfidenceScore += 6;
  if (extractedSignals.narrativeQuality.detailBand === "high") savingsConfidenceScore += 12;
  savingsConfidenceScore += Object.keys(adaptive).length >= 5 ? 10 : 0;
  if (extractedSignals.providers.length >= 1) savingsConfidenceScore += 4;
  if (adaptive.costVisibility === "weak") savingsConfidenceScore -= 7;
  if (!extractedSignals.spendSignals.billingSummaryProvided) savingsConfidenceScore -= 4;

  let implementationComplexityScore = 25;
  if (adaptive.workloadScope === "a_few_systems") implementationComplexityScore += 10;
  if (adaptive.workloadScope === "many_systems") implementationComplexityScore += 25;
  if (adaptive.customerCriticality === "customer_facing") implementationComplexityScore += 10;
  if (adaptive.customerCriticality === "highly_sensitive") implementationComplexityScore += 20;
  if (extractedSignals.complexitySignals.includes("multi_cloud")) implementationComplexityScore += 12;
  if (extractedSignals.complexitySignals.includes("production_critical")) implementationComplexityScore += 7;
  if (extractedSignals.complexitySignals.includes("regulated_or_sensitive")) implementationComplexityScore += 10;
  if (extractedSignals.complexitySignals.includes("high_availability_constraints")) implementationComplexityScore += 9;
  if (extractedSignals.complexitySignals.includes("multi_region")) implementationComplexityScore += 8;
  if (extractedSignals.complexitySignals.includes("high_data_transfer")) implementationComplexityScore += 7;
  if (extractedSignals.complexitySignals.includes("many_teams_or_unclear_owners")) implementationComplexityScore += 10;
  if (extractedSignals.workloadSignals.includes("kubernetes")) implementationComplexityScore += 10;
  if (extractedSignals.workloadSignals.includes("data_platform_analytics")) implementationComplexityScore += 8;
  if (extractedSignals.workloadSignals.includes("databases")) implementationComplexityScore += 6;
  if (extractedSignals.workloadSignals.includes("ai_ml_gpu")) implementationComplexityScore += 12;
  if (adaptive.crossRegionTraffic === "some") implementationComplexityScore += 5;
  if (adaptive.crossRegionTraffic === "high") implementationComplexityScore += 12;
  if (adaptive.architectureFlexibility === "some_redesign") implementationComplexityScore += 12;
  if (adaptive.architectureFlexibility === "major_redesign") implementationComplexityScore += 24;

  let roiPlausibilityScore = 40;
  if (adaptive.monthlySpendBand === "5k_to_15k") roiPlausibilityScore += 5;
  if (adaptive.monthlySpendBand === "15k_to_50k") roiPlausibilityScore += 10;
  if (adaptive.monthlySpendBand === "50k_plus") roiPlausibilityScore += 15;
  if (wasteRiskScore >= 70) roiPlausibilityScore += 10;
  else if (wasteRiskScore >= 55) roiPlausibilityScore += 6;
  const quickWins = [
    adaptive.nonProdRuntime === "always_on" || adaptive.nonProdRuntime === "mixed",
    adaptive.rightsizingCadence === "rare" || adaptive.rightsizingCadence === "occasional",
    adaptive.storageLifecycle === "no" || adaptive.storageLifecycle === "partial",
    adaptive.budgetsAlerts === "none" || adaptive.budgetsAlerts === "partial",
    adaptive.commitmentCoverage === "none" || adaptive.commitmentCoverage === "partial",
    adaptive.ownershipClarity === "unclear" || adaptive.ownershipClarity === "partial",
  ].filter(Boolean).length;
  roiPlausibilityScore += Math.min(quickWins * 4, 20);
  if (implementationComplexityScore > 75) roiPlausibilityScore -= 20;
  else if (implementationComplexityScore > 55) roiPlausibilityScore -= 10;
  if (adaptive.architectureFlexibility === "some_redesign") roiPlausibilityScore -= 6;
  if (adaptive.architectureFlexibility === "major_redesign") roiPlausibilityScore -= 15;
  if (finopsMaturityScore >= 75) roiPlausibilityScore -= 8;

  let confidenceScore = 25;
  if (extractedSignals.narrativeQuality.detailBand === "medium") confidenceScore += 8;
  if (extractedSignals.narrativeQuality.detailBand === "high") confidenceScore += 15;
  if (extractedSignals.spendSignals.billingSummaryProvided) confidenceScore += 8;
  if (extractedSignals.spendSignals.parsedAmountCount >= 1) confidenceScore += 10;
  if (extractedSignals.spendSignals.parsedAmountCount >= 2) confidenceScore += 6;
  if (Object.keys(adaptive).length >= 5) confidenceScore += 12;
  if (extractedSignals.providers.length >= 1) confidenceScore += 4;
  if (extractedSignals.spendSignals.dominantFamily) confidenceScore += 7;
  if (adaptive.costVisibility === "weak") confidenceScore -= 8;
  if (adaptive.costVisibility === "partial") confidenceScore -= 3;
  if (!extractedSignals.spendSignals.billingSummaryProvided) confidenceScore -= 4;

  return {
    wasteRiskScore: clamp(wasteRiskScore),
    finopsMaturityScore: clamp(finopsMaturityScore),
    savingsConfidenceScore: clamp(savingsConfidenceScore),
    implementationComplexityScore: clamp(implementationComplexityScore),
    roiPlausibilityScore: clamp(roiPlausibilityScore),
    confidenceScore: clamp(confidenceScore),
  };
}
