import type {
  QuoteTier,
  ReadinessCategory,
} from "@/lib/landing-zone-readiness/types";

export const LANDING_ZONE_BLOCKED_EMAIL_DOMAINS = [
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

export const READINESS_CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  identity_access: "Identity and access",
  org_structure: "Organization and tenancy",
  network_foundation: "Network foundation",
  security_baseline: "Security baseline",
  logging_monitoring: "Logging and monitoring",
  backup_dr: "Backup and disaster recovery",
  iac_delivery: "IaC and delivery controls",
  cost_governance: "Cost governance",
  environment_separation: "Environment separation",
  operations_readiness: "Operations readiness",
};

export const READINESS_CATEGORY_WEIGHTS: Record<ReadinessCategory, number> = {
  identity_access: 15,
  org_structure: 10,
  network_foundation: 15,
  security_baseline: 15,
  logging_monitoring: 10,
  backup_dr: 10,
  iac_delivery: 10,
  cost_governance: 7,
  environment_separation: 5,
  operations_readiness: 3,
};

export type QuotePricingConfig = {
  tiers: Record<
    QuoteTier,
    {
      low: number;
      high: number;
    }
  >;
  adders: {
    perHighSeverityLow: number;
    perHighSeverityHigh: number;
    perMediumSeverityLow: number;
    perMediumSeverityHigh: number;
    multiCloudLow: number;
    multiCloudHigh: number;
    sensitiveDataLow: number;
    sensitiveDataHigh: number;
    missingCoreControlLow: number;
    missingCoreControlHigh: number;
  };
  customScopeThresholds: {
    minimumScore: number;
    minimumHighSeverityFindings: number;
    minimumCoreControlsMissing: number;
  };
};

export const DEFAULT_QUOTE_PRICING_CONFIG: QuotePricingConfig = {
  tiers: {
    "Advisory Review": { low: 750, high: 1500 },
    "Foundation Fix Sprint": { low: 3500, high: 7000 },
    "Landing Zone Hardening": { low: 8000, high: 18000 },
    "Custom Scope Required": { low: 15000, high: 30000 },
  },
  adders: {
    perHighSeverityLow: 250,
    perHighSeverityHigh: 500,
    perMediumSeverityLow: 100,
    perMediumSeverityHigh: 250,
    multiCloudLow: 500,
    multiCloudHigh: 1500,
    sensitiveDataLow: 500,
    sensitiveDataHigh: 1500,
    missingCoreControlLow: 350,
    missingCoreControlHigh: 750,
  },
  customScopeThresholds: {
    minimumScore: 40,
    minimumHighSeverityFindings: 6,
    minimumCoreControlsMissing: 4,
  },
};

export const CONSULTATION_CTA_PATH = "/services#service-request";
