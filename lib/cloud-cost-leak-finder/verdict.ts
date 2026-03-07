import { CATEGORY_ACTIONS, WASTE_CATEGORY_LABELS } from "@/lib/cloud-cost-leak-finder/config";
import type { ExtractedCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import type {
  CloudCostLeakFinderScoreSet,
  VerdictClass,
  WasteCategory,
} from "@/lib/cloud-cost-leak-finder/types";

const QUICK_WIN_CATEGORIES = new Set<WasteCategory>([
  "IDLE_NON_PROD",
  "OVERPROVISIONED_COMPUTE",
  "WEAK_AUTOSCALING",
  "STORAGE_LIFECYCLE_GAPS",
  "BACKUP_SNAPSHOT_SPRAWL",
  "LOG_RETENTION_SPRAWL",
  "UNCLEAR_RESOURCE_OWNERSHIP",
  "TAGGING_GAPS",
  "NO_BUDGET_ALERTS",
  "COMMITMENT_GAPS",
]);

function joinCategoryLabels(categories: WasteCategory[]) {
  return categories
    .map((category) => WASTE_CATEGORY_LABELS[category].toLowerCase())
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1");
}

function dominantFamilySummary(extractedSignals: ExtractedCloudCostSignals) {
  switch (extractedSignals.spendSignals.dominantFamily) {
    case "compute":
      return "oversized or always-on compute";
    case "database":
      return "database footprint and HA overhead";
    case "networking":
      return "network transfer and egress";
    case "kubernetes":
      return "cluster shape and idle node cost";
    case "object_storage":
    case "logging":
    case "backups":
      return "retention-heavy storage and log growth";
    case "ai_ml":
      return "GPU and AI platform spend";
    default:
      return null;
  }
}

function pickVerdictClass(input: {
  scores: CloudCostLeakFinderScoreSet;
  likelyWasteCategories: WasteCategory[];
}) {
  const architectureDriven =
    input.likelyWasteCategories.includes("OVERENGINEERED_ARCHITECTURE") ||
    input.likelyWasteCategories.includes("MANAGED_SERVICE_MISMATCH");
  const quickWinCount = input.likelyWasteCategories.filter((category) => QUICK_WIN_CATEGORIES.has(category)).length;

  if (input.scores.confidenceScore < 45 || input.likelyWasteCategories.includes("NEEDS_REAL_BILLING_DATA")) {
    return "BILLING_DATA_NEEDED" as VerdictClass;
  }

  if (input.scores.implementationComplexityScore >= 78) {
    return "HIGH_COMPLEXITY_REVIEW_RECOMMENDED" as VerdictClass;
  }

  if (architectureDriven && input.scores.implementationComplexityScore >= 60) {
    return "SAVINGS_REQUIRE_ARCHITECTURE_CHANGES" as VerdictClass;
  }

  if (quickWinCount >= 2 && input.scores.wasteRiskScore >= 62 && input.scores.implementationComplexityScore < 58) {
    return "QUICK_WINS_LIKELY" as VerdictClass;
  }

  if (input.scores.wasteRiskScore < 45 && input.scores.finopsMaturityScore >= 70) {
    return "ALREADY_FAIRLY_DISCIPLINED" as VerdictClass;
  }

  return "MODERATE_SAVINGS_WITH_DISCIPLINE_GAPS" as VerdictClass;
}

export function buildCloudCostVerdict(input: {
  scores: CloudCostLeakFinderScoreSet;
  likelyWasteCategories: WasteCategory[];
  extractedSignals: ExtractedCloudCostSignals;
}) {
  const verdictClass = pickVerdictClass(input);
  const leadingCategories = input.likelyWasteCategories.filter((category) => category !== "NEEDS_REAL_BILLING_DATA").slice(0, 3);
  const categorySummary = joinCategoryLabels(leadingCategories);
  const dominantFamily = dominantFamilySummary(input.extractedSignals);
  const firstAction = CATEGORY_ACTIONS[input.likelyWasteCategories[0]] ?? "Start with the highest-cost resources first.";

  const verdictHeadline = {
    QUICK_WINS_LIKELY: "Quick savings are likely without a major redesign.",
    MODERATE_SAVINGS_WITH_DISCIPLINE_GAPS: "Savings look real, but discipline gaps are likely feeding the bill.",
    SAVINGS_REQUIRE_ARCHITECTURE_CHANGES: "Meaningful savings probably depend on architecture changes, not just cleanup.",
    BILLING_DATA_NEEDED: "There are waste signals here, but cleaner billing data is still needed.",
    ALREADY_FAIRLY_DISCIPLINED: "This environment already looks fairly disciplined; the remaining savings are more selective.",
    HIGH_COMPLEXITY_REVIEW_RECOMMENDED: "This environment looks expensive to untangle and deserves a deeper expert review.",
  } satisfies Record<VerdictClass, string>;

  const shortSummary = {
    QUICK_WINS_LIKELY: `The strongest signals point to ${categorySummary}. This looks more like cleanup drift than a full platform rebuild.`,
    MODERATE_SAVINGS_WITH_DISCIPLINE_GAPS: `The biggest leak signals point to ${categorySummary}. The spend likely needs better ownership and tighter cost hygiene before anything fancier.`,
    SAVINGS_REQUIRE_ARCHITECTURE_CHANGES: `There are real leak signals around ${categorySummary}, but the harder savings likely sit in platform shape and service choices.`,
    BILLING_DATA_NEEDED: `The narrative points to ${categorySummary || "real cost hygiene gaps"}, but the current inputs are still too thin for a stronger estimate.`,
    ALREADY_FAIRLY_DISCIPLINED: `The main remaining opportunities point to ${categorySummary}. This looks like selective tuning work rather than broad cleanup.`,
    HIGH_COMPLEXITY_REVIEW_RECOMMENDED: `The likely waste sits around ${categorySummary}. The environment also looks complex enough that rushed changes would be risky.`,
  } satisfies Record<VerdictClass, string>;

  const primaryCauseLine =
    dominantFamily && leadingCategories.length > 0
      ? `The bill is most likely being pushed by ${dominantFamily}, with secondary leakage around ${joinCategoryLabels(leadingCategories.slice(0, 2))}.`
      : `The strongest spend leak signals point to ${categorySummary || "weak cost visibility and hygiene gaps"}.`;

  return {
    verdictClass,
    verdictHeadline: verdictHeadline[verdictClass],
    shortSummary: shortSummary[verdictClass],
    primaryCauseLine,
    firstStepLine: firstAction,
  };
}
