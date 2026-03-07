import type { ExtractedCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import type {
  CloudCostLeakFinderAnswers,
  FollowUpQuestionDefinition,
  FollowUpQuestionId,
} from "@/lib/cloud-cost-leak-finder/types";

const FOLLOW_UP_QUESTIONS: Record<FollowUpQuestionId, FollowUpQuestionDefinition> = {
  monthlySpendBand: {
    id: "monthlySpendBand",
    label: "Rough monthly cloud spend",
    detail: "A band is enough. This keeps the savings estimate conservative instead of fake-precise.",
    options: [
      { value: "under_5k", label: "Under $5k", description: "Good fit for early-stage or tightly scoped environments." },
      { value: "5k_to_15k", label: "$5k to $15k", description: "Enough spend for real cleanup wins without enterprise complexity." },
      { value: "15k_to_50k", label: "$15k to $50k", description: "Usually enough spend for both hygiene and architecture savings." },
      { value: "50k_plus", label: "$50k+", description: "Higher spend where platform rationalization may matter." },
    ],
  },
  workloadScope: {
    id: "workloadScope",
    label: "How much is in scope?",
    detail: "This helps separate a single hotspot from a messier shared platform problem.",
    options: [
      { value: "one_workload", label: "One main workload", description: "Most of the spend sits in one application or system." },
      { value: "a_few_systems", label: "A few shared systems", description: "There are several meaningful services or environments involved." },
      { value: "many_systems", label: "Many systems and teams", description: "The bill is spread across multiple services, teams, or business units." },
    ],
  },
  ownershipClarity: {
    id: "ownershipClarity",
    label: "How clear is ownership?",
    detail: "Good cost cleanup usually starts with knowing who owns the expensive parts.",
    options: [
      { value: "clear", label: "Clear owners", description: "Owners and tags are mostly clear." },
      { value: "partial", label: "Partly clear", description: "Some owners are known, but not consistently." },
      { value: "unclear", label: "Unclear", description: "Cost ownership is fuzzy or mostly tribal knowledge." },
    ],
  },
  budgetsAlerts: {
    id: "budgetsAlerts",
    label: "Do budgets and alerts exist?",
    detail: "Guardrails matter because a surprising bill usually means feedback is late.",
    options: [
      { value: "strong", label: "Yes, in use", description: "Budgets or alerts are active and reviewed." },
      { value: "partial", label: "Partly", description: "Some alerts exist, but they are incomplete or noisy." },
      { value: "none", label: "No", description: "There are no meaningful cloud budget guardrails." },
    ],
  },
  customerCriticality: {
    id: "customerCriticality",
    label: "How sensitive is the workload?",
    detail: "This changes how aggressive the cleanup can be.",
    options: [
      { value: "internal", label: "Internal or low-risk", description: "More room for quick cleanup and schedule-based savings." },
      { value: "customer_facing", label: "Customer-facing", description: "Savings still matter, but changes need more care." },
      { value: "highly_sensitive", label: "Highly sensitive", description: "Regulated or mission-critical systems need tighter change control." },
    ],
  },
  nonProdRuntime: {
    id: "nonProdRuntime",
    label: "How often does non-prod stay running?",
    detail: "This is one of the fastest ways small and mid-sized teams leak spend.",
    options: [
      { value: "mostly_off", label: "Mostly off-hours", description: "Dev and test are usually shut down when not needed." },
      { value: "mixed", label: "Mixed", description: "Some environments stop, but many still run longer than they should." },
      { value: "always_on", label: "Mostly 24/7", description: "Non-prod usually stays on all the time." },
    ],
  },
  rightsizingCadence: {
    id: "rightsizingCadence",
    label: "How often do you rightsize compute?",
    detail: "This also covers whether capacity is left sized for rare peaks.",
    options: [
      { value: "regular", label: "Regularly", description: "Compute sizing is reviewed often enough to keep drift down." },
      { value: "occasional", label: "Occasionally", description: "Some reviews happen, but not on a reliable cadence." },
      { value: "rare", label: "Rarely", description: "Compute sizing mostly stays as-is unless there is a problem." },
    ],
  },
  kubernetesUtilization: {
    id: "kubernetesUtilization",
    label: "How well do you understand cluster utilization?",
    detail: "Kubernetes spend gets expensive fast when requests, limits, and nodes drift.",
    options: [
      { value: "understood", label: "Well understood", description: "Node and pod utilization are measured and acted on." },
      { value: "partial", label: "Partly understood", description: "Some utilization data exists, but it is incomplete." },
      { value: "unknown", label: "Not really", description: "Cluster cost is visible, but utilization is mostly unclear." },
    ],
  },
  storageLifecycle: {
    id: "storageLifecycle",
    label: "Are retention and cleanup policies in place?",
    detail: "Think storage lifecycle, snapshot cleanup, backup review, and log retention.",
    options: [
      { value: "yes", label: "Yes", description: "Retention rules are in place and reviewed." },
      { value: "partial", label: "Partly", description: "Some lifecycle controls exist, but not consistently." },
      { value: "no", label: "No", description: "Storage, backups, or logs mostly grow until someone notices." },
    ],
  },
  crossRegionTraffic: {
    id: "crossRegionTraffic",
    label: "How much cross-region traffic happens?",
    detail: "This helps separate normal networking from likely egress waste.",
    options: [
      { value: "low", label: "Low", description: "Cross-region traffic is limited or intentional." },
      { value: "some", label: "Some", description: "There is meaningful cross-region traffic, but not constantly." },
      { value: "high", label: "High", description: "A lot of data moves across regions or out to the internet." },
    ],
  },
  databaseRightSizing: {
    id: "databaseRightSizing",
    label: "How often do you review database sizing?",
    detail: "This includes replicas, HA settings, storage growth, and backup overhead.",
    options: [
      { value: "regular", label: "Regularly", description: "Database size and replicas are reviewed on purpose." },
      { value: "partial", label: "Partly", description: "Some review happens, but it is not disciplined." },
      { value: "unknown", label: "Not sure", description: "Database spend is mostly opaque or left alone." },
    ],
  },
  commitmentCoverage: {
    id: "commitmentCoverage",
    label: "How strong is commitment coverage?",
    detail: "Think Savings Plans, reservations, or committed-use discounts where they make sense.",
    options: [
      { value: "strong", label: "Strong", description: "Commitments are used intentionally and reviewed." },
      { value: "partial", label: "Partial", description: "Some commitments exist, but coverage is spotty." },
      { value: "none", label: "None", description: "Spend is mostly on-demand or unmanaged." },
    ],
  },
  architectureFlexibility: {
    id: "architectureFlexibility",
    label: "Can savings happen without redesign?",
    detail: "This separates cleanup work from deeper architecture cost decisions.",
    options: [
      { value: "cleanup_first", label: "Mostly cleanup", description: "The main gains should come from hygiene and tuning." },
      { value: "some_redesign", label: "Some redesign", description: "A few architectural choices likely need to change." },
      { value: "major_redesign", label: "Major redesign", description: "Savings probably depend on larger platform changes." },
    ],
  },
  costVisibility: {
    id: "costVisibility",
    label: "How clear are the top cost drivers today?",
    detail: "This is a sanity check when the narrative is strong but the billing data is thin.",
    options: [
      { value: "clear", label: "Clear", description: "The expensive services are mostly known." },
      { value: "partial", label: "Partly clear", description: "Some hotspots are known, but not enough to trust the full picture." },
      { value: "weak", label: "Weak", description: "The team mostly guesses where the spend is coming from." },
    ],
  },
};

const BASELINE_QUESTION_IDS: FollowUpQuestionId[] = [
  "monthlySpendBand",
  "workloadScope",
  "ownershipClarity",
  "budgetsAlerts",
  "customerCriticality",
];

function addCandidate(candidates: Map<FollowUpQuestionId, number>, id: FollowUpQuestionId, priority: number) {
  const current = candidates.get(id) ?? 0;
  if (priority > current) {
    candidates.set(id, priority);
  }
}

export function getCloudCostLeakFinderQuestion(id: FollowUpQuestionId) {
  return FOLLOW_UP_QUESTIONS[id];
}

export function selectCloudCostLeakFinderFollowUpQuestions(
  extractedSignals: ExtractedCloudCostSignals,
): FollowUpQuestionDefinition[] {
  const candidates = new Map<FollowUpQuestionId, number>();

  if (
    extractedSignals.costPainSignals.includes("idle_non_prod_waste") ||
    extractedSignals.costPainSignals.includes("duplicate_environments")
  ) {
    addCandidate(candidates, "nonProdRuntime", 100);
  }

  if (
    extractedSignals.workloadSignals.includes("kubernetes") ||
    extractedSignals.costPainSignals.includes("kubernetes_inefficiency")
  ) {
    addCandidate(candidates, "kubernetesUtilization", 96);
  }

  if (
    extractedSignals.workloadSignals.includes("vms") ||
    extractedSignals.workloadSignals.includes("serverless") ||
    extractedSignals.workloadSignals.includes("kubernetes") ||
    extractedSignals.costPainSignals.includes("oversized_compute")
  ) {
    addCandidate(candidates, "rightsizingCadence", 92);
  }

  if (
    extractedSignals.workloadSignals.includes("storage_heavy") ||
    extractedSignals.costPainSignals.includes("storage_sprawl") ||
    extractedSignals.spendSignals.familyBreakdown.some((entry) =>
      ["object_storage", "logging", "backups"].includes(entry.family),
    )
  ) {
    addCandidate(candidates, "storageLifecycle", 88);
  }

  if (
    extractedSignals.workloadSignals.includes("networking_heavy") ||
    extractedSignals.costPainSignals.includes("egress_network_costs") ||
    extractedSignals.spendSignals.dominantFamily === "networking"
  ) {
    addCandidate(candidates, "crossRegionTraffic", 86);
  }

  if (
    extractedSignals.workloadSignals.includes("databases") ||
    extractedSignals.costPainSignals.includes("database_cost_inflation") ||
    extractedSignals.spendSignals.dominantFamily === "database"
  ) {
    addCandidate(candidates, "databaseRightSizing", 84);
  }

  if (
    extractedSignals.costPainSignals.includes("vendor_commitment_gaps") ||
    extractedSignals.spendSignals.dominantFamily === "compute"
  ) {
    addCandidate(candidates, "commitmentCoverage", 78);
  }

  if (
    extractedSignals.costPainSignals.includes("overengineered_ha_dr") ||
    extractedSignals.complexitySignals.includes("multi_region") ||
    extractedSignals.complexitySignals.includes("high_availability_constraints")
  ) {
    addCandidate(candidates, "architectureFlexibility", 94);
  }

  if (
    !extractedSignals.spendSignals.billingSummaryProvided ||
    extractedSignals.spendSignals.spendClarity === "low" ||
    extractedSignals.costPainSignals.includes("unknown_spend_drivers")
  ) {
    addCandidate(candidates, "costVisibility", 82);
  }

  const targetedIds = [...candidates.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([id]) => id)
    .filter((id) => !BASELINE_QUESTION_IDS.includes(id))
    .slice(0, 2);

  const selected = [...BASELINE_QUESTION_IDS, ...targetedIds];
  return selected.map((id) => FOLLOW_UP_QUESTIONS[id]);
}

export function validateCloudCostLeakFinderFollowUpAnswers(
  questions: FollowUpQuestionDefinition[],
  answers: CloudCostLeakFinderAnswers["adaptiveAnswers"],
) {
  for (const question of questions) {
    const value = answers[question.id];
    if (!value) {
      return `Answer the follow-up question: ${question.label}.`;
    }

    if (!question.options.some((option) => option.value === value)) {
      return `Review the answer for: ${question.label}.`;
    }
  }

  return null;
}
