import { CASE_STUDIES, type CaseStudy } from "@/lib/case-studies";
import type { ArchitectureCategory } from "@/lib/architecture-review/types";

// Maps a finding's category to the most thematically relevant case study so
// the email can show "this is the exact pattern I caught at [client] — here's
// what happened." Pattern-matching makes the review feel like the reviewer
// has lived through this problem before, which is what closes consulting
// deals.
const CATEGORY_TO_SLUG: Partial<Record<ArchitectureCategory, string>> = {
  security: "nordic-ai-ivr",
  cost: "series-b-ai-cost-audit",
  reliability: "aws-partner-sa",
  operations: "azure-nhl-llmops",
  performance: "azure-nhl-llmops",
  // clarity and sustainability findings get no case-study link — there's
  // no representative engagement that maps cleanly to those buckets.
};

// Rule-id-specific overrides for situations where the category mapping is
// the wrong match. For example, an HIPAA-encryption finding belongs with
// the Nordic HIPAA IVR engagement regardless of category, and a GPU-cost
// finding belongs with the Series B audit even if it's tagged as
// performance.
const RULE_ID_TO_SLUG: Record<string, string> = {
  // Anything tied to encryption, secrets, or PHI handling → HIPAA case study
  "aws:rds_encryption_at_rest": "nordic-ai-ivr",
  "aws:secrets_management_centralized": "nordic-ai-ivr",
  "aws:public_database_exposure": "nordic-ai-ivr",
  "azure:key_vault_secrets_management": "nordic-ai-ivr",

  // Cost / right-sizing / lifecycle → Series B AI cost audit
  "aws:public_s3_bucket_access": "series-b-ai-cost-audit",
  "azure:blob_versioning_enabled": "series-b-ai-cost-audit",
  "azure:blob_lifecycle_management_configured": "series-b-ai-cost-audit",

  // HA / DR / multi-AZ / backups → AWS Partner SA enterprise patterns
  "aws:single_instance_production_compute": "aws-partner-sa",
  "aws:compute_multi_az_deployment": "aws-partner-sa",
  "aws:single_az_database_for_production": "aws-partner-sa",
  "aws:no_backup_strategy_for_stateful_data": "aws-partner-sa",
  "aws:nat_gateway_per_az_for_private_egress": "aws-partner-sa",
  "aws:alb_in_at_least_two_azs": "aws-partner-sa",
  "azure:zone_redundant_compute": "aws-partner-sa",
  "azure:zone_redundant_database": "aws-partner-sa",

  // Large-platform observability / IaC → NHL LLMOps
  "aws:centralized_application_logging": "azure-nhl-llmops",
  "aws:cloudwatch_alarms_for_key_metrics": "azure-nhl-llmops",
  "aws:cloudtrail_multi_region_enabled": "azure-nhl-llmops",
  "aws:infrastructure_as_code_indicated": "azure-nhl-llmops",
  "azure:centralized_application_logging": "azure-nhl-llmops",
  "azure:monitor_alerts_for_key_metrics": "azure-nhl-llmops",
};

export type RelatedCaseStudy = {
  slug: string;
  title: string;
  outcomeStat: string;
  outcomeHeadline: string;
  href: string;
};

function findCaseStudyBySlug(slug: string): CaseStudy | null {
  return CASE_STUDIES.find((entry) => entry.slug === slug) ?? null;
}

export function getRelatedCaseStudy(input: {
  ruleId: string;
  category: ArchitectureCategory;
}): RelatedCaseStudy | null {
  const ruleOverride = RULE_ID_TO_SLUG[input.ruleId];
  const slug = ruleOverride ?? CATEGORY_TO_SLUG[input.category];
  if (!slug) {
    return null;
  }

  const caseStudy = findCaseStudyBySlug(slug);
  if (!caseStudy) {
    return null;
  }

  return {
    slug: caseStudy.slug,
    title: caseStudy.title,
    outcomeStat: caseStudy.outcomeStat,
    outcomeHeadline: caseStudy.outcomeHeadline,
    href: `/case-studies/${caseStudy.slug}`,
  };
}

export function getCaseStudyForCategory(category: ArchitectureCategory): RelatedCaseStudy | null {
  const slug = CATEGORY_TO_SLUG[category];
  if (!slug) {
    return null;
  }
  const caseStudy = findCaseStudyBySlug(slug);
  if (!caseStudy) {
    return null;
  }
  return {
    slug: caseStudy.slug,
    title: caseStudy.title,
    outcomeStat: caseStudy.outcomeStat,
    outcomeHeadline: caseStudy.outcomeHeadline,
    href: `/case-studies/${caseStudy.slug}`,
  };
}
