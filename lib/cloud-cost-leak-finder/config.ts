import type {
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

export const QUOTE_PRICING_DEFAULTS: Record<
  QuoteTier,
  {
    quoteLow: number;
    quoteHigh: number;
  }
> = {
  "Cost Triage Call": {
    quoteLow: 149,
    quoteHigh: 299,
  },
  "Savings Opportunity Memo": {
    quoteLow: 350,
    quoteHigh: 900,
  },
  "FinOps Cleanup Sprint": {
    quoteLow: 900,
    quoteHigh: 2_200,
  },
  "Architecture Cost Review": {
    quoteLow: 1_250,
    quoteHigh: 3_000,
  },
  "Cost + Platform Rationalization Sprint": {
    quoteLow: 2_500,
    quoteHigh: 6_000,
  },
  "Custom Scope Required": {
    quoteLow: 3_500,
    quoteHigh: 7_500,
  },
};

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
