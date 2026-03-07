import type {
  CloudCostLeakFinderQuoteLineItem,
  QuoteTier,
  SpendBand,
  WasteCategory,
} from "@/lib/cloud-cost-leak-finder/types";

export const CLOUD_COST_BLOCKED_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "msn.com",
  "yandex.com",
] as const;

export const CONSULTATION_CTA_PATH = "/services#service-request";
export const NARRATIVE_MIN_WORDS = 12;
export const NARRATIVE_MIN_CHARS = 80;
export const BILLING_SUMMARY_MAX_CHARS = 6000;
export const MAX_FINDINGS = 12;
export const MAX_ACTIONS = 5;

export const SPEND_BAND_RANGES: Record<SpendBand, { low: number; high: number }> = {
  under_5k: { low: 1_000, high: 5_000 },
  "5k_to_15k": { low: 5_000, high: 15_000 },
  "15k_to_50k": { low: 15_000, high: 50_000 },
  "50k_plus": { low: 50_000, high: 100_000 },
};

export const WASTE_CATEGORY_LABELS: Record<WasteCategory, string> = {
  IDLE_NON_PROD: "Idle non-prod runtime",
  OVERPROVISIONED_COMPUTE: "Overprovisioned compute",
  WEAK_AUTOSCALING: "Weak autoscaling",
  KUBERNETES_INEFFICIENCY: "Kubernetes inefficiency",
  DATABASE_OVERSPEND: "Database overspend",
  STORAGE_LIFECYCLE_GAPS: "Storage lifecycle gaps",
  BACKUP_SNAPSHOT_SPRAWL: "Backup and snapshot sprawl",
  LOG_RETENTION_SPRAWL: "Log retention sprawl",
  NETWORK_EGRESS_WASTE: "Network and egress waste",
  UNCLEAR_RESOURCE_OWNERSHIP: "Unclear ownership",
  TAGGING_GAPS: "Tagging gaps",
  NO_BUDGET_ALERTS: "Weak budget guardrails",
  COMMITMENT_GAPS: "Commitment gaps",
  OVERENGINEERED_ARCHITECTURE: "Overengineered architecture",
  GPU_WASTE: "GPU waste",
  MANAGED_SERVICE_MISMATCH: "Managed service mismatch",
  TOO_MANY_ENVIRONMENTS: "Too many environments",
  NEEDS_REAL_BILLING_DATA: "Needs real billing data",
};

export const CATEGORY_ACTIONS: Record<WasteCategory, string> = {
  IDLE_NON_PROD: "Set shutdown schedules for non-prod environments.",
  OVERPROVISIONED_COMPUTE: "Review the top 10 highest-cost compute resources for rightsizing.",
  WEAK_AUTOSCALING: "Check where autoscaling is missing or tuned for rare peaks.",
  KUBERNETES_INEFFICIENCY: "Audit cluster node utilization, requests, limits, and idle node pools.",
  DATABASE_OVERSPEND: "Review database sizing, replicas, HA settings, and backup overhead.",
  STORAGE_LIFECYCLE_GAPS: "Apply storage lifecycle and retention policies to cold data.",
  BACKUP_SNAPSHOT_SPRAWL: "Audit snapshots, old backups, unattached disks, and idle IPs.",
  LOG_RETENTION_SPRAWL: "Set log-retention limits before observability data keeps compounding.",
  NETWORK_EGRESS_WASTE: "Validate whether cross-region traffic and egress paths are actually necessary.",
  UNCLEAR_RESOURCE_OWNERSHIP: "Assign an owner to the top-cost resources before optimizing anything else.",
  TAGGING_GAPS: "Enforce tags for owner, environment, and application on new and existing resources.",
  NO_BUDGET_ALERTS: "Turn on budget alerts before the next billing cycle closes.",
  COMMITMENT_GAPS: "Review reservation or commitment coverage before buying more on-demand capacity.",
  OVERENGINEERED_ARCHITECTURE: "Check whether HA, DR, and service sprawl are more expensive than the real risk requires.",
  GPU_WASTE: "Measure GPU utilization before renewing or expanding GPU capacity.",
  MANAGED_SERVICE_MISMATCH: "Review whether self-hosted components are costing more than managed alternatives.",
  TOO_MANY_ENVIRONMENTS: "Collapse duplicate or rarely used environments before redesigning the platform.",
  NEEDS_REAL_BILLING_DATA: "Pull a cleaner top-services billing export so the next review is more precise.",
};

type QuoteLineItemPricing = Pick<CloudCostLeakFinderQuoteLineItem, "label" | "amountLow" | "amountHigh" | "reason">;

export const QUOTE_BASE_PACKAGES: Record<QuoteTier, QuoteLineItemPricing> = {
  "Cost Triage Call": {
    label: "Base triage call",
    amountLow: 95,
    amountHigh: 175,
    reason: "Best when the inputs still need a sharper billing and ownership read before a larger scope.",
  },
  "Savings Opportunity Memo": {
    label: "Base savings memo",
    amountLow: 195,
    amountHigh: 325,
    reason: "Fits a written advisory memo with prioritized savings actions and next steps.",
  },
  "FinOps Cleanup Sprint": {
    label: "Base FinOps cleanup sprint",
    amountLow: 550,
    amountHigh: 950,
    reason: "Fits rightsizing, environment hygiene, guardrails, and fast cleanup work.",
  },
  "Architecture Cost Review": {
    label: "Base architecture cost review",
    amountLow: 700,
    amountHigh: 1_200,
    reason: "Fits platform-shape decisions where cost is tied to architecture, not just hygiene.",
  },
  "Cost + Platform Rationalization Sprint": {
    label: "Base platform rationalization sprint",
    amountLow: 1_100,
    amountHigh: 1_850,
    reason: "Fits broader cleanup across multiple systems, environments, or teams.",
  },
  "Custom Scope Required": {
    label: "Base custom scoping block",
    amountLow: 1_400,
    amountHigh: 2_200,
    reason: "Fits higher-complexity environments that still need a tighter delivery scope.",
  },
};

export const QUOTE_TIER_GUARDRAILS: Record<
  QuoteTier,
  {
    minimumLow: number;
    maximumHigh: number;
  }
> = {
  "Cost Triage Call": {
    minimumLow: 95,
    maximumHigh: 225,
  },
  "Savings Opportunity Memo": {
    minimumLow: 195,
    maximumHigh: 650,
  },
  "FinOps Cleanup Sprint": {
    minimumLow: 550,
    maximumHigh: 1_800,
  },
  "Architecture Cost Review": {
    minimumLow: 700,
    maximumHigh: 2_400,
  },
  "Cost + Platform Rationalization Sprint": {
    minimumLow: 1_100,
    maximumHigh: 3_600,
  },
  "Custom Scope Required": {
    minimumLow: 1_750,
    maximumHigh: 4_500,
  },
};

export const QUOTE_CATEGORY_LINE_ITEMS: Record<WasteCategory, QuoteLineItemPricing> = {
  IDLE_NON_PROD: {
    label: "Non-prod runtime cleanup",
    amountLow: 75,
    amountHigh: 150,
    reason: "Used when dev, test, or staging likely run longer than they should.",
  },
  OVERPROVISIONED_COMPUTE: {
    label: "Compute rightsizing pass",
    amountLow: 100,
    amountHigh: 200,
    reason: "Used when the likely waste points to oversized or peak-shaped compute.",
  },
  WEAK_AUTOSCALING: {
    label: "Autoscaling review",
    amountLow: 75,
    amountHigh: 150,
    reason: "Used when scaling policy gaps are likely inflating steady-state spend.",
  },
  KUBERNETES_INEFFICIENCY: {
    label: "Kubernetes efficiency review",
    amountLow: 150,
    amountHigh: 300,
    reason: "Used when cluster shape, requests, limits, or idle nodes look expensive.",
  },
  DATABASE_OVERSPEND: {
    label: "Database sizing review",
    amountLow: 125,
    amountHigh: 250,
    reason: "Used when database sizing, HA, replicas, or storage overhead look heavy.",
  },
  STORAGE_LIFECYCLE_GAPS: {
    label: "Storage lifecycle cleanup",
    amountLow: 75,
    amountHigh: 150,
    reason: "Used when storage retention and tiering likely need tightening.",
  },
  BACKUP_SNAPSHOT_SPRAWL: {
    label: "Backup and snapshot cleanup",
    amountLow: 75,
    amountHigh: 150,
    reason: "Used when backups, snapshots, or unattached storage likely need cleanup.",
  },
  LOG_RETENTION_SPRAWL: {
    label: "Log retention tuning",
    amountLow: 50,
    amountHigh: 125,
    reason: "Used when observability retention is likely carrying avoidable storage cost.",
  },
  NETWORK_EGRESS_WASTE: {
    label: "Egress and topology review",
    amountLow: 125,
    amountHigh: 250,
    reason: "Used when cross-region traffic or internet egress look like real leak sources.",
  },
  UNCLEAR_RESOURCE_OWNERSHIP: {
    label: "Ownership mapping cleanup",
    amountLow: 75,
    amountHigh: 125,
    reason: "Used when resource ownership is too weak for clean cost control.",
  },
  TAGGING_GAPS: {
    label: "Tagging baseline setup",
    amountLow: 75,
    amountHigh: 125,
    reason: "Used when cost allocation and ownership tags are likely incomplete.",
  },
  NO_BUDGET_ALERTS: {
    label: "Budget and alert guardrails",
    amountLow: 50,
    amountHigh: 100,
    reason: "Used when the environment appears to lack basic spend guardrails.",
  },
  COMMITMENT_GAPS: {
    label: "Commitment coverage review",
    amountLow: 75,
    amountHigh: 150,
    reason: "Used when on-demand usage likely needs reservation or commitment review.",
  },
  OVERENGINEERED_ARCHITECTURE: {
    label: "Architecture simplification review",
    amountLow: 150,
    amountHigh: 300,
    reason: "Used when the cost problem likely sits in platform shape, redundancy, or service sprawl.",
  },
  GPU_WASTE: {
    label: "GPU utilization review",
    amountLow: 175,
    amountHigh: 350,
    reason: "Used when GPU or AI workloads look expensive relative to likely usage.",
  },
  MANAGED_SERVICE_MISMATCH: {
    label: "Managed-vs-self-hosted comparison",
    amountLow: 100,
    amountHigh: 225,
    reason: "Used when service choice itself may be driving unnecessary operating cost.",
  },
  TOO_MANY_ENVIRONMENTS: {
    label: "Environment consolidation review",
    amountLow: 75,
    amountHigh: 150,
    reason: "Used when duplicate or rarely used environments likely keep spend alive.",
  },
  NEEDS_REAL_BILLING_DATA: {
    label: "Billing data normalization pass",
    amountLow: 50,
    amountHigh: 100,
    reason: "Used when a cleaner billing export is needed before quoting a larger scope.",
  },
};

export const QUOTE_SCOPE_LINE_ITEMS = {
  manySystems: {
    label: "Multi-system coordination",
    amountLow: 125,
    amountHigh: 250,
    reason: "Used when the spend spans many systems or teams instead of one main hotspot.",
  },
  multiCloud: {
    label: "Multi-cloud coordination",
    amountLow: 100,
    amountHigh: 200,
    reason: "Used when the review needs to compare or coordinate across more than one cloud.",
  },
  customerFacing: {
    label: "Customer-facing change caution",
    amountLow: 50,
    amountHigh: 100,
    reason: "Used when savings work needs more production care than a low-risk internal system.",
  },
  highlySensitive: {
    label: "Sensitive workload controls",
    amountLow: 150,
    amountHigh: 300,
    reason: "Used when regulated or highly sensitive workloads tighten the delivery scope.",
  },
  someRedesign: {
    label: "Targeted redesign work",
    amountLow: 125,
    amountHigh: 250,
    reason: "Used when the cost problem likely needs some architecture change, not just cleanup.",
  },
  majorRedesign: {
    label: "Major redesign scope",
    amountLow: 250,
    amountHigh: 450,
    reason: "Used when meaningful savings likely depend on larger platform changes.",
  },
} as const;

export const SAVINGS_BAND_BY_CATEGORY: Record<
  WasteCategory,
  {
    low: number;
    high: number;
  }
> = {
  IDLE_NON_PROD: { low: 0.03, high: 0.08 },
  OVERPROVISIONED_COMPUTE: { low: 0.03, high: 0.08 },
  WEAK_AUTOSCALING: { low: 0.02, high: 0.05 },
  KUBERNETES_INEFFICIENCY: { low: 0.03, high: 0.09 },
  DATABASE_OVERSPEND: { low: 0.02, high: 0.06 },
  STORAGE_LIFECYCLE_GAPS: { low: 0.015, high: 0.04 },
  BACKUP_SNAPSHOT_SPRAWL: { low: 0.015, high: 0.04 },
  LOG_RETENTION_SPRAWL: { low: 0.01, high: 0.03 },
  NETWORK_EGRESS_WASTE: { low: 0.02, high: 0.06 },
  UNCLEAR_RESOURCE_OWNERSHIP: { low: 0.01, high: 0.03 },
  TAGGING_GAPS: { low: 0.01, high: 0.03 },
  NO_BUDGET_ALERTS: { low: 0.01, high: 0.03 },
  COMMITMENT_GAPS: { low: 0.02, high: 0.06 },
  OVERENGINEERED_ARCHITECTURE: { low: 0.02, high: 0.05 },
  GPU_WASTE: { low: 0.03, high: 0.1 },
  MANAGED_SERVICE_MISMATCH: { low: 0.015, high: 0.04 },
  TOO_MANY_ENVIRONMENTS: { low: 0.02, high: 0.05 },
  NEEDS_REAL_BILLING_DATA: { low: 0.005, high: 0.015 },
};
