import { CATEGORY_ACTIONS, MAX_ACTIONS, MAX_FINDINGS } from "@/lib/cloud-cost-leak-finder/config";
import { selectCloudCostLeakFinderFollowUpQuestions } from "@/lib/cloud-cost-leak-finder/adaptive";
import { buildCloudCostLeakFinderQuote } from "@/lib/cloud-cost-leak-finder/quote";
import { buildCloudCostScores } from "@/lib/cloud-cost-leak-finder/scoring";
import { estimateCloudCostSavings } from "@/lib/cloud-cost-leak-finder/savings";
import { extractCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import { buildCloudCostVerdict } from "@/lib/cloud-cost-leak-finder/verdict";
import { cloudCostLeakFinderReportSchema } from "@/lib/cloud-cost-leak-finder/types";
import type {
  CloudCostLeakFinderAnswers,
  CloudCostLeakFinderFinding,
  WasteCategory,
} from "@/lib/cloud-cost-leak-finder/types";

type CategoryWeightMap = Record<WasteCategory, number>;

const ALL_CATEGORIES: WasteCategory[] = [
  "IDLE_NON_PROD",
  "OVERPROVISIONED_COMPUTE",
  "WEAK_AUTOSCALING",
  "KUBERNETES_INEFFICIENCY",
  "DATABASE_OVERSPEND",
  "STORAGE_LIFECYCLE_GAPS",
  "BACKUP_SNAPSHOT_SPRAWL",
  "LOG_RETENTION_SPRAWL",
  "NETWORK_EGRESS_WASTE",
  "UNCLEAR_RESOURCE_OWNERSHIP",
  "TAGGING_GAPS",
  "NO_BUDGET_ALERTS",
  "COMMITMENT_GAPS",
  "OVERENGINEERED_ARCHITECTURE",
  "GPU_WASTE",
  "MANAGED_SERVICE_MISMATCH",
  "TOO_MANY_ENVIRONMENTS",
  "NEEDS_REAL_BILLING_DATA",
];

const FINDING_TEMPLATES: Record<
  WasteCategory,
  {
    finding: string;
    fix: string;
  }
> = {
  IDLE_NON_PROD: {
    finding: "Non-prod likely runs longer than necessary.",
    fix: CATEGORY_ACTIONS.IDLE_NON_PROD,
  },
  OVERPROVISIONED_COMPUTE: {
    finding: "Compute capacity may be sized for peaks that rarely happen.",
    fix: CATEGORY_ACTIONS.OVERPROVISIONED_COMPUTE,
  },
  WEAK_AUTOSCALING: {
    finding: "Autoscaling appears too weak to keep compute spend tight.",
    fix: CATEGORY_ACTIONS.WEAK_AUTOSCALING,
  },
  KUBERNETES_INEFFICIENCY: {
    finding: "Kubernetes cost hygiene appears weaker than basic VM hygiene.",
    fix: CATEGORY_ACTIONS.KUBERNETES_INEFFICIENCY,
  },
  DATABASE_OVERSPEND: {
    finding: "Database spend may be carrying unnecessary HA, replica, or sizing overhead.",
    fix: CATEGORY_ACTIONS.DATABASE_OVERSPEND,
  },
  STORAGE_LIFECYCLE_GAPS: {
    finding: "You may be paying for storage retention you do not need.",
    fix: CATEGORY_ACTIONS.STORAGE_LIFECYCLE_GAPS,
  },
  BACKUP_SNAPSHOT_SPRAWL: {
    finding: "Backups, snapshots, or unattached storage likely need cleanup.",
    fix: CATEGORY_ACTIONS.BACKUP_SNAPSHOT_SPRAWL,
  },
  LOG_RETENTION_SPRAWL: {
    finding: "Logs may be retained longer than the business value justifies.",
    fix: CATEGORY_ACTIONS.LOG_RETENTION_SPRAWL,
  },
  NETWORK_EGRESS_WASTE: {
    finding: "Cross-region traffic or egress looks like a likely cost leak.",
    fix: CATEGORY_ACTIONS.NETWORK_EGRESS_WASTE,
  },
  UNCLEAR_RESOURCE_OWNERSHIP: {
    finding: "Cost ownership appears weak.",
    fix: CATEGORY_ACTIONS.UNCLEAR_RESOURCE_OWNERSHIP,
  },
  TAGGING_GAPS: {
    finding: "Tagging or labeling looks too weak for clean cost control.",
    fix: CATEGORY_ACTIONS.TAGGING_GAPS,
  },
  NO_BUDGET_ALERTS: {
    finding: "Your environment suggests weak budget guardrails.",
    fix: CATEGORY_ACTIONS.NO_BUDGET_ALERTS,
  },
  COMMITMENT_GAPS: {
    finding: "Commitment coverage may not match steady-state usage.",
    fix: CATEGORY_ACTIONS.COMMITMENT_GAPS,
  },
  OVERENGINEERED_ARCHITECTURE: {
    finding: "Architecture choices may be more expensive than the real risk requires.",
    fix: CATEGORY_ACTIONS.OVERENGINEERED_ARCHITECTURE,
  },
  GPU_WASTE: {
    finding: "GPU capacity may be paid for more often than it is truly busy.",
    fix: CATEGORY_ACTIONS.GPU_WASTE,
  },
  MANAGED_SERVICE_MISMATCH: {
    finding: "Some platform components may be more expensive to run than they are worth.",
    fix: CATEGORY_ACTIONS.MANAGED_SERVICE_MISMATCH,
  },
  TOO_MANY_ENVIRONMENTS: {
    finding: "Too many environments may be keeping duplicate cost alive.",
    fix: CATEGORY_ACTIONS.TOO_MANY_ENVIRONMENTS,
  },
  NEEDS_REAL_BILLING_DATA: {
    finding: "You do not have enough input detail for a confident savings estimate.",
    fix: CATEGORY_ACTIONS.NEEDS_REAL_BILLING_DATA,
  },
};

function buildInitialWeights() {
  return ALL_CATEGORIES.reduce(
    (weights, category) => {
      weights[category] = 0;
      return weights;
    },
    {} as CategoryWeightMap,
  );
}

function addWeight(weights: CategoryWeightMap, category: WasteCategory, points: number) {
  weights[category] += points;
}

function sortWeightedCategories(weights: CategoryWeightMap) {
  return [...ALL_CATEGORIES].sort((left, right) => {
    if (weights[right] !== weights[left]) {
      return weights[right] - weights[left];
    }

    return left.localeCompare(right);
  });
}

function buildLikelyWasteCategories(input: {
  answers: CloudCostLeakFinderAnswers;
  confidenceScore: number;
}) {
  const { answers, confidenceScore } = input;
  const extractedSignals = extractCloudCostSignals(answers);
  const weights = buildInitialWeights();
  const adaptive = answers.adaptiveAnswers;

  if (extractedSignals.costPainSignals.includes("idle_non_prod_waste")) addWeight(weights, "IDLE_NON_PROD", 20);
  if (extractedSignals.costPainSignals.includes("duplicate_environments")) addWeight(weights, "TOO_MANY_ENVIRONMENTS", 16);
  if (adaptive.nonProdRuntime === "mixed") {
    addWeight(weights, "IDLE_NON_PROD", 12);
    addWeight(weights, "TOO_MANY_ENVIRONMENTS", 8);
  }
  if (adaptive.nonProdRuntime === "always_on") {
    addWeight(weights, "IDLE_NON_PROD", 24);
    addWeight(weights, "TOO_MANY_ENVIRONMENTS", 10);
  }

  if (extractedSignals.workloadSignals.includes("vms") || extractedSignals.spendSignals.dominantFamily === "compute") {
    addWeight(weights, "OVERPROVISIONED_COMPUTE", 10);
  }
  if (extractedSignals.costPainSignals.includes("oversized_compute")) addWeight(weights, "OVERPROVISIONED_COMPUTE", 18);
  if (adaptive.rightsizingCadence === "occasional") addWeight(weights, "OVERPROVISIONED_COMPUTE", 12);
  if (adaptive.rightsizingCadence === "rare") {
    addWeight(weights, "OVERPROVISIONED_COMPUTE", 22);
    addWeight(weights, "WEAK_AUTOSCALING", 10);
  }

  if (extractedSignals.workloadSignals.includes("kubernetes")) addWeight(weights, "KUBERNETES_INEFFICIENCY", 20);
  if (extractedSignals.costPainSignals.includes("kubernetes_inefficiency")) addWeight(weights, "KUBERNETES_INEFFICIENCY", 14);
  if (adaptive.kubernetesUtilization === "partial") addWeight(weights, "KUBERNETES_INEFFICIENCY", 12);
  if (adaptive.kubernetesUtilization === "unknown") addWeight(weights, "KUBERNETES_INEFFICIENCY", 22);

  if (extractedSignals.workloadSignals.includes("databases")) addWeight(weights, "DATABASE_OVERSPEND", 12);
  if (extractedSignals.costPainSignals.includes("database_cost_inflation")) addWeight(weights, "DATABASE_OVERSPEND", 18);
  if (extractedSignals.spendSignals.dominantFamily === "database") addWeight(weights, "DATABASE_OVERSPEND", 12);
  if (adaptive.databaseRightSizing === "partial") addWeight(weights, "DATABASE_OVERSPEND", 10);
  if (adaptive.databaseRightSizing === "unknown") addWeight(weights, "DATABASE_OVERSPEND", 18);

  if (extractedSignals.workloadSignals.includes("storage_heavy")) addWeight(weights, "STORAGE_LIFECYCLE_GAPS", 10);
  if (extractedSignals.costPainSignals.includes("storage_sprawl")) {
    addWeight(weights, "STORAGE_LIFECYCLE_GAPS", 16);
    addWeight(weights, "BACKUP_SNAPSHOT_SPRAWL", 12);
    addWeight(weights, "LOG_RETENTION_SPRAWL", 10);
  }
  if (adaptive.storageLifecycle === "partial") {
    addWeight(weights, "STORAGE_LIFECYCLE_GAPS", 12);
    addWeight(weights, "BACKUP_SNAPSHOT_SPRAWL", 8);
    addWeight(weights, "LOG_RETENTION_SPRAWL", 8);
  }
  if (adaptive.storageLifecycle === "no") {
    addWeight(weights, "STORAGE_LIFECYCLE_GAPS", 18);
    addWeight(weights, "BACKUP_SNAPSHOT_SPRAWL", 12);
    addWeight(weights, "LOG_RETENTION_SPRAWL", 12);
  }

  if (extractedSignals.workloadSignals.includes("networking_heavy")) addWeight(weights, "NETWORK_EGRESS_WASTE", 12);
  if (extractedSignals.costPainSignals.includes("egress_network_costs")) addWeight(weights, "NETWORK_EGRESS_WASTE", 18);
  if (adaptive.crossRegionTraffic === "some") addWeight(weights, "NETWORK_EGRESS_WASTE", 12);
  if (adaptive.crossRegionTraffic === "high") addWeight(weights, "NETWORK_EGRESS_WASTE", 22);
  if (extractedSignals.spendSignals.dominantFamily === "networking") addWeight(weights, "NETWORK_EGRESS_WASTE", 12);

  if (extractedSignals.costPainSignals.includes("lack_resource_ownership_tagging")) {
    addWeight(weights, "UNCLEAR_RESOURCE_OWNERSHIP", 18);
    addWeight(weights, "TAGGING_GAPS", 16);
  }
  if (adaptive.ownershipClarity === "partial") {
    addWeight(weights, "UNCLEAR_RESOURCE_OWNERSHIP", 10);
    addWeight(weights, "TAGGING_GAPS", 8);
  }
  if (adaptive.ownershipClarity === "unclear") {
    addWeight(weights, "UNCLEAR_RESOURCE_OWNERSHIP", 20);
    addWeight(weights, "TAGGING_GAPS", 14);
  }

  if (extractedSignals.costPainSignals.includes("poor_budgeting_alerting")) addWeight(weights, "NO_BUDGET_ALERTS", 16);
  if (adaptive.budgetsAlerts === "partial") addWeight(weights, "NO_BUDGET_ALERTS", 10);
  if (adaptive.budgetsAlerts === "none") addWeight(weights, "NO_BUDGET_ALERTS", 20);

  if (extractedSignals.costPainSignals.includes("vendor_commitment_gaps")) addWeight(weights, "COMMITMENT_GAPS", 14);
  if (adaptive.commitmentCoverage === "partial") addWeight(weights, "COMMITMENT_GAPS", 12);
  if (adaptive.commitmentCoverage === "none") addWeight(weights, "COMMITMENT_GAPS", 20);

  if (extractedSignals.costPainSignals.includes("overengineered_ha_dr")) addWeight(weights, "OVERENGINEERED_ARCHITECTURE", 18);
  if (adaptive.architectureFlexibility === "some_redesign") {
    addWeight(weights, "OVERENGINEERED_ARCHITECTURE", 14);
    addWeight(weights, "MANAGED_SERVICE_MISMATCH", 10);
  }
  if (adaptive.architectureFlexibility === "major_redesign") {
    addWeight(weights, "OVERENGINEERED_ARCHITECTURE", 24);
    addWeight(weights, "MANAGED_SERVICE_MISMATCH", 14);
  }

  if (extractedSignals.workloadSignals.includes("ai_ml_gpu")) addWeight(weights, "GPU_WASTE", 18);
  if (extractedSignals.costPainSignals.includes("gpu_waste")) addWeight(weights, "GPU_WASTE", 16);

  if (!extractedSignals.spendSignals.billingSummaryProvided || confidenceScore < 50) {
    addWeight(weights, "NEEDS_REAL_BILLING_DATA", confidenceScore < 45 ? 22 : 12);
  }

  if (!ALL_CATEGORIES.some((category) => weights[category] > 0)) {
    addWeight(weights, "NEEDS_REAL_BILLING_DATA", 12);
  }

  const ranked = sortWeightedCategories(weights)
    .filter((category) => weights[category] >= 16)
    .slice(0, 6);

  if (ranked.length < 3) {
    for (const category of sortWeightedCategories(weights)) {
      if (!ranked.includes(category) && weights[category] > 0) {
        ranked.push(category);
      }

      if (ranked.length >= 3) {
        break;
      }
    }
  }

  return {
    likelyWasteCategories: ranked.slice(0, 6),
    categoryWeights: weights,
  };
}

function severityFromWeight(weight: number) {
  if (weight >= 30) {
    return "high" as const;
  }

  if (weight >= 22) {
    return "medium" as const;
  }

  return "low" as const;
}

function buildFindings(input: {
  likelyWasteCategories: WasteCategory[];
  categoryWeights: CategoryWeightMap;
}) {
  return input.likelyWasteCategories
    .map<CloudCostLeakFinderFinding>((category) => ({
      category,
      severity: severityFromWeight(input.categoryWeights[category]),
      finding: FINDING_TEMPLATES[category].finding,
      fix: FINDING_TEMPLATES[category].fix,
    }))
    .slice(0, MAX_FINDINGS);
}

function buildTopActions(categories: WasteCategory[]) {
  return [...new Set(categories.map((category) => CATEGORY_ACTIONS[category]))].slice(0, MAX_ACTIONS);
}

export function buildCloudCostLeakFinderReport(answers: CloudCostLeakFinderAnswers) {
  const extractedSignals = extractCloudCostSignals(answers);
  const adaptiveQuestions = selectCloudCostLeakFinderFollowUpQuestions(extractedSignals);
  const scores = buildCloudCostScores({ answers, extractedSignals });
  const { likelyWasteCategories, categoryWeights } = buildLikelyWasteCategories({
    answers,
    confidenceScore: scores.confidenceScore,
  });
  const savingsEstimate = estimateCloudCostSavings({
    answers,
    scores,
    likelyWasteCategories,
  });
  const topFindings = buildFindings({ likelyWasteCategories, categoryWeights });
  const topActions = buildTopActions(likelyWasteCategories);
  const verdict = buildCloudCostVerdict({
    scores,
    likelyWasteCategories,
    extractedSignals,
  });
  const quote = buildCloudCostLeakFinderQuote({
    answers,
    scores,
    verdictClass: verdict.verdictClass,
    likelyWasteCategories,
    extractedSignals,
  });

  return cloudCostLeakFinderReportSchema.parse({
    reportVersion: "1.0",
    generatedAtISO: new Date().toISOString(),
    scores,
    likelyWasteCategories,
    savingsEstimate,
    topFindings,
    topActions,
    quote,
    verdictClass: verdict.verdictClass,
    verdictHeadline: verdict.verdictHeadline,
    shortSummary: verdict.shortSummary,
    primaryCauseLine: verdict.primaryCauseLine,
    firstStepLine: verdict.firstStepLine,
    extractedSignals,
    adaptiveQuestionIds: adaptiveQuestions.map((question) => question.id),
  });
}
