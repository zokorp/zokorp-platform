import rawRewrites from "@/data/validator/ftr-launch-v1/rewrites.json";
import rawRules from "@/data/validator/ftr-launch-v1/rules.json";

export type FtrEstimatePolicyBand = "consultation_only" | "remediation_estimate" | "optional_polish";

export type FtrLaunchV1RuleCatalogEntry = {
  id: string;
  control_family:
    | "security"
    | "reliability"
    | "operations"
    | "support"
    | "documentation_quality"
    | "architecture_fit"
    | "evidence_completeness";
  control_name: string;
  launch_priority: "critical" | "high" | "medium" | "low";
  rule_type: "required" | "recommended" | "anti_pattern" | "document_quality" | "contradiction_check";
  aws_program_scope: "FTR";
  artifact_types: string[];
  applies_to: string;
  description: string;
  why_it_matters: string;
  required_evidence: string[];
  pass_signals: string[];
  fail_signals: string[];
  partial_credit_logic: string;
  score_weight: number;
  max_partial_credit: number;
  rewrite_allowed: boolean;
  rewrite_policy: string;
  rewrite_template: string;
  missing_evidence_placeholder: string;
  remediation_summary: string;
  remediation_hours_low: number;
  remediation_hours_high: number;
  estimate_line_item_label: string;
  estimate_policy_band: FtrEstimatePolicyBand;
  official_source_links: string[];
  reviewer_explanation_template: string;
  customer_summary_snippet: string;
  evidence_strength: "strong" | "moderate" | "limited";
  notes: string;
};

export type FtrLaunchV1SafeRewriteEntry = {
  id: string;
  applies_to_rule_ids: string[];
  scenario: string;
  rewrite_allowed: boolean;
  allowed_transformations: string[];
  forbidden_transformations: string[];
  placeholder_policy: string;
  example_bad_input: string;
  example_safe_output: string;
  reviewer_warning: string;
};

function normalizePdfUrl(url: string) {
  return url.replace(/\s+/g, "");
}

export const FTR_LAUNCH_V1_RULES: FtrLaunchV1RuleCatalogEntry[] = (
  rawRules as FtrLaunchV1RuleCatalogEntry[]
).map((rule) => ({
  ...rule,
  official_source_links: rule.official_source_links.map((link) => normalizePdfUrl(link)),
}));

export const FTR_LAUNCH_V1_SAFE_REWRITES = rawRewrites as FtrLaunchV1SafeRewriteEntry[];

export const FTR_LAUNCH_V1_CORE_RULE_IDS = FTR_LAUNCH_V1_RULES.filter(
  (rule) => !rule.id.startsWith("ph_") && !rule.id.startsWith("cd_"),
).map((rule) => rule.id);

export const FTR_LAUNCH_V1_PARTNER_HOSTED_RULE_IDS = FTR_LAUNCH_V1_RULES.filter((rule) =>
  rule.id.startsWith("ph_"),
).map((rule) => rule.id);

export const FTR_LAUNCH_V1_CUSTOMER_DEPLOYED_RULE_IDS = FTR_LAUNCH_V1_RULES.filter((rule) =>
  rule.id.startsWith("cd_"),
).map((rule) => rule.id);

export const FTR_LAUNCH_V1_RULES_BY_ID = new Map(FTR_LAUNCH_V1_RULES.map((rule) => [rule.id, rule]));

export const FTR_LAUNCH_V1_SAFE_REWRITES_BY_ID = new Map(
  FTR_LAUNCH_V1_SAFE_REWRITES.map((entry) => [entry.id, entry]),
);

export const FTR_LAUNCH_V1_CHECKLIST_WINDOW = "Feb 2026 to Aug 2026 public checklist window";

export function getFtrLaunchV1Rule(ruleId: string) {
  return FTR_LAUNCH_V1_RULES_BY_ID.get(ruleId) ?? null;
}

export function getFtrLaunchV1SafeRewrite(rewriteId: string) {
  return FTR_LAUNCH_V1_SAFE_REWRITES_BY_ID.get(rewriteId) ?? null;
}

export function isFtrConsultationOnlyRule(ruleId: string) {
  return getFtrLaunchV1Rule(ruleId)?.estimate_policy_band === "consultation_only";
}
