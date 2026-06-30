import type { ArchitectureCategory, ArchitectureEstimatePolicyBand } from "@/lib/architecture-review/types";
import type { ArchitectureReviewRule } from "@/lib/architecture-review/rule-types";

export type SnowflakeArchitectureLaunchV1Rule = ArchitectureReviewRule;

type RawRule = readonly [
  string,
  ArchitectureCategory,
  string,
  string,
  "critical" | "high" | "medium" | "low",
  "required" | "recommended" | "anti_pattern" | "contradiction_check",
  number,
  number,
  string,
  string,
  number,
  number,
  string,
  ArchitectureEstimatePolicyBand,
  string,
  readonly string[],
  string,
];

function labelForSnowflakeUrl(url: string) {
  if (url.includes("warehouses-overview")) return "Snowflake warehouse overview";
  if (url.includes("warehouses-considerations")) return "Snowflake warehouse considerations";
  if (url.includes("tables-storage-considerations")) return "Snowflake table storage considerations";
  if (url.includes("tables-clustering-micropartitions")) return "Snowflake clustering and micropartition guidance";
  if (url.includes("cost-controlling-controls")) return "Snowflake cost controls guidance";
  return "Snowflake documentation";
}

const RAW_SNOWFLAKE_ARCHITECTURE_LAUNCH_V1_RULES: RawRule[] = [
  ["workload_objective_and_constraints_stated", "clarity", "architecture-fit", "Warehouse objective and constraints are stated", "high", "required", 2, 1, "pass(obj+≥2 constraints)=2; partial(obj only)=1; else=0.", "State the analytics objective, concurrency/latency expectations, data retention scope, and cost sensitivity.", 0, 2, "Clarify Snowflake workload constraints", "remediation-estimate", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/warehouses-overview"], "Warehouse objective and constraints are stated."],
  ["warehouse_size_and_role_is_explicit", "clarity", "compute", "Warehouse roles and sizes are explicit", "medium", "recommended", 2, 1, "pass(size+role)=2; partial(one)=1; else=0.", "Label the purpose and size posture of each warehouse so compute intent is reviewable.", 1, 6, "Clarify warehouse sizes and roles", "remediation-estimate", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/warehouses-overview"], "Warehouse roles and sizes are explicit."],
  ["warehouse_auto_suspend_configured", "cost", "compute", "Warehouses auto-suspend when idle", "high", "recommended", 3, 1, "pass(auto-suspend)=3; partial(unclear)=1; fail(always-on)=0.", "Configure warehouse auto-suspend / auto-resume for workloads that do not need permanently running compute.", 1, 8, "Configure warehouse auto-suspend", "optional-polish", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/warehouses-considerations"], "Warehouses auto-suspend when idle."],
  ["warehouse_right_sizing_documented", "cost", "compute", "Warehouse right-sizing and concurrency posture are documented", "medium", "recommended", 2, 1, "pass(size/concurrency explicit)=2; partial(one)=1; else=0.", "Document expected concurrency and right-size warehouse classes instead of defaulting to oversized compute.", 1, 8, "Right-size Snowflake warehouses", "optional-polish", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/warehouses-considerations"], "Warehouse right-sizing and concurrency posture are documented."],
  ["storage_retention_controls_noted", "cost", "storage", "Storage retention and lifecycle controls are noted", "medium", "recommended", 2, 1, "pass(retention explicit)=2; partial(unclear)=1; else=0.", "Document retention expectations, fail-safe/time-travel implications, and the intended lifecycle for large tables.", 1, 8, "Clarify storage retention controls", "optional-polish", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/tables-storage-considerations"], "Storage retention and lifecycle controls are noted."],
  ["clustering_strategy_for_large_tables", "performance", "storage", "Large table clustering strategy is explicit when needed", "medium", "recommended", 2, 1, "N/A=2; pass(clustering explicit)=2; partial(unclear)=1; fail(large hot tables no strategy)=0.", "Document clustering only for tables that materially need it; avoid blanket clustering without evidence.", 2, 12, "Clarify clustering strategy for large tables", "optional-polish", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions"], "Large table clustering strategy is explicit when needed."],
  ["cost_controls_documented", "cost", "operations", "Snowflake cost controls are documented", "high", "recommended", 3, 1, "pass(cost controls explicit)=3; partial(unclear)=1; else=0.", "Document budget controls, warehouse scheduling posture, and the review path for runaway-cost scenarios.", 2, 12, "Document Snowflake cost controls", "remediation-estimate", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/cost-controlling-controls"], "Snowflake cost controls are documented."],
  ["data_retention_scope_noted", "clarity", "data", "Data retention and storage scope are stated", "medium", "recommended", 2, 1, "pass(retention+scope)=2; partial(one)=1; else=0.", "State what data lands in Snowflake, how long it must remain there, and whether rollback/history requirements exist.", 1, 6, "Clarify Snowflake data retention scope", "remediation-estimate", "Fail only if explicit.", ["https://docs.snowflake.com/en/user-guide/tables-storage-considerations"], "Data retention and storage scope are stated."],
];

export const SNOWFLAKE_ARCHITECTURE_LAUNCH_V1_RULES: SnowflakeArchitectureLaunchV1Rule[] =
  RAW_SNOWFLAKE_ARCHITECTURE_LAUNCH_V1_RULES.map(
    ([
      id,
      category,
      researchCategory,
      ruleName,
      launchPriority,
      ruleType,
      scoreWeight,
      maxPartialCredit,
      partialCreditLogic,
      remediationSummary,
      remediationHoursLow,
      remediationHoursHigh,
      estimateLineItemLabel,
      estimatePolicyBand,
      confidenceGuidance,
      urls,
      customerSummarySnippet,
    ]) => ({
      id: `snowflake:${id}`,
      provider: "snowflake",
      ruleVersion: "snowflake-launch-v1",
      category,
      researchCategory,
      ruleName,
      launchPriority,
      ruleType,
      scoreWeight,
      maxPartialCredit,
      partialCreditLogic,
      remediationSummary,
      remediationHoursLow,
      remediationHoursHigh,
      estimateLineItemLabel,
      estimatePolicyBand,
      confidenceGuidance,
      officialSourceLinks: urls.map((url) => ({ label: labelForSnowflakeUrl(url), url })),
      customerSummarySnippet,
    }),
  );

const snowflakeArchitectureLaunchV1RuleById = new Map(
  SNOWFLAKE_ARCHITECTURE_LAUNCH_V1_RULES.map((rule) => [rule.id, rule]),
);

export function getSnowflakeArchitectureLaunchV1Rule(ruleId: string) {
  const normalizedRuleId = ruleId.startsWith("snowflake:") ? ruleId : `snowflake:${ruleId}`;
  return snowflakeArchitectureLaunchV1RuleById.get(normalizedRuleId) ?? null;
}
