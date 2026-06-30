import type { ArchitectureCategory, ArchitectureEstimatePolicyBand } from "@/lib/architecture-review/types";
import type { ArchitectureReviewRule } from "@/lib/architecture-review/rule-types";

export type AzureArchitectureLaunchV1Rule = ArchitectureReviewRule;

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

function labelForAzureUrl(url: string) {
  if (url.includes("well-architected")) return "Azure Well-Architected guidance";
  if (url.includes("lifecycle-management-policy-structure")) return "Azure Blob lifecycle policy guidance";
  if (url.includes("versioning-overview")) return "Azure Blob versioning guidance";
  if (url.includes("managed-identity-best-practice-recommendations")) return "Azure managed identity guidance";
  if (url.includes("key-vault")) return "Azure Key Vault documentation";
  if (url.includes("azure-monitor/alerts")) return "Azure Monitor alerts documentation";
  if (url.includes("azure-monitor/fundamentals")) return "Azure Monitor documentation";
  return "Azure documentation";
}

const RAW_AZURE_ARCHITECTURE_LAUNCH_V1_RULES: RawRule[] = [
  ["workload_objective_and_constraints_stated", "clarity", "architecture-fit", "Workload objective and measurable constraints are stated", "high", "required", 2, 1, "pass(obj+≥2 constraints)=2; partial(obj only)=1; else=0.", "Collect a 5–10 line requirements blurb (objective, users, load, data sensitivity, uptime/RTO/RPO).", 0, 2, "Clarify requirements for a credible review", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Workload objective and measurable constraints are stated."],
  ["data_classification_and_compliance_noted", "security", "data", "Data sensitivity and compliance scope are stated", "high", "recommended", 3, 1, "pass(types+sens+compliance)=3; partial(partial)=1; else=0.", "Add a short data inventory: types, sensitivity, compliance scope, retention/deletion needs.", 0, 4, "Clarify data classification/compliance scope", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Data sensitivity and compliance scope are stated."],
  ["rto_rpo_defined", "reliability", "resiliency", "RTO/RPO (or clear equivalents) are defined for stateful workloads", "high", "recommended", 2, 1, "N/A=2; pass(RTO+RPO)=2; partial(one)=1; else=0.", "Define RTO/RPO; use them to choose backups, zone redundancy, and geo-redundancy.", 0, 4, "Define DR objectives (RTO/RPO)", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "RTO/RPO (or clear equivalents) are defined for stateful workloads."],
  ["region_and_environment_boundaries_identified", "operations", "operations", "Azure region and prod/non-prod boundaries are explicit", "medium", "recommended", 2, 1, "pass(region+env)=2; partial(one)=1; else=0.", "Label the Azure region and show production isolation (subscriptions/resource groups or both).", 1, 6, "Clarify region + environment isolation", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Azure region and prod/non-prod boundaries are explicit."],
  ["stated_multi_region_requirement_mismatch", "reliability", "operations", "Stated multi-region requirement matches the drawn design", "critical", "contradiction_check", 4, 2, "N/A=4; pass(2 regions+replication+failover)=4; partial(2 regions only)=2; else=0.", "Either remove the multi-region claim, or redesign with an explicit secondary region, replication path, and failover aligned to RTO/RPO.", 4, 40, "Align multi-region requirement with design", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Stated multi-region requirement matches the drawn design."],
  ["stated_private_only_requirement_mismatch", "security", "operations", "Stated private-only requirement matches network exposure", "critical", "contradiction_check", 4, 2, "N/A=4; pass(no public ingress+private path)=4; partial(private ingress only)=2; else=0.", "Clarify the requirement. If truly private-only, remove public ingress and use Private Link, VPN, or ExpressRoute paths.", 4, 32, "Align private-only claim with design", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Stated private-only requirement matches network exposure."],
  ["internet_facing_endpoint_without_tls", "security", "security", "Internet-facing endpoints enforce HTTPS/TLS", "critical", "required", 5, 2, "N/A=5; pass(all public HTTPS/TLS)=5; partial(protocol unclear)=2; fail(any HTTP-only)=0.", "Terminate TLS on the public entry point and enforce HTTPS-only for every public path.", 2, 12, "Enforce HTTPS/TLS on public endpoints", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Internet-facing endpoints enforce HTTPS/TLS."],
  ["public_database_exposure", "security", "security", "Databases are not publicly accessible", "critical", "anti_pattern", 5, 2, "N/A=5; pass(DB private-only)=5; partial(exposure unclear)=2; fail(public DB)=0.", "Move the database behind private networking and remove public access; route admin access through controlled private paths.", 4, 24, "Remove public database exposure", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Databases are not publicly accessible."],
  ["unrestricted_admin_ports_from_internet", "security", "security", "No unrestricted SSH/RDP (or broad admin ports) from the internet", "critical", "anti_pattern", 5, 2, "N/A=5; pass(admin controlled)=5; partial(unclear)=2; fail(SSH/RDP open-to-world)=0.", "Close public admin ports; use Bastion, VPN, or restricted allowlists with auditing.", 2, 16, "Lock down SSH/RDP exposure", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "No unrestricted SSH/RDP (or broad admin ports) from the internet."],
  ["key_vault_secrets_management", "security", "security", "Secrets live in Key Vault, not in code/config", "high", "required", 4, 1, "N/A=4; pass(Key Vault)=4; partial(unclear)=1; fail(secret in code/diagram)=0.", "Move secrets into Azure Key Vault; fetch at runtime; scrub any embedded secrets from code or deployment artifacts.", 4, 24, "Centralize secrets management with Key Vault", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/key-vault/general/overview"], "Secrets live in Key Vault, not in code/config."],
  ["managed_identity_least_privilege", "security", "identity", "Managed identities and least-privilege RBAC are used instead of static credentials", "high", "required", 4, 1, "N/A=4; pass(managed identity+least privilege)=4; partial(one)=1; fail(embedded credentials)=0.", "Replace static credentials with managed identities and narrow RBAC assignments to the minimum required scope.", 4, 24, "Replace static credentials with managed identity", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/managed-identity-best-practice-recommendations"], "Managed identities and least-privilege RBAC are used instead of static credentials."],
  ["waf_on_public_endpoints", "security", "security", "WAF protects the public entry point", "high", "recommended", 3, 1, "N/A=3; pass(WAF on entry)=3; partial(not mentioned)=1; fail(refusal high-risk)=0.", "Put Azure WAF or Front Door WAF in front of the public entry point with managed rules and rate limiting.", 4, 24, "Add WAF protection on public endpoints", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "WAF protects the public entry point."],
  ["vnet_public_private_subnet_separation", "security", "networking", "Clear public vs private subnet separation exists for VNet-based tiers", "high", "recommended", 3, 1, "N/A=3; pass(public/private tiers)=3; partial(unclear)=1; fail(internal tiers public)=0.", "Rework the VNet layout so ingress stays on public-facing edges and app/data tiers remain private.", 4, 24, "Harden subnet layout", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Clear public vs private subnet separation exists for VNet-based tiers."],
  ["zone_redundant_compute", "reliability", "resiliency", "Compute tier is deployed across multiple availability zones when HA is claimed", "high", "recommended", 3, 1, "N/A=3; pass(≥2 zones)=3; partial(unclear)=1; fail(single zone HA)=0.", "Deploy compute across at least two availability zones when the workload claims HA or production resilience.", 4, 24, "Deploy compute across multiple zones", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Compute tier is deployed across multiple availability zones when HA is claimed."],
  ["single_instance_production_compute", "reliability", "compute", "Production compute is not a single point of failure", "critical", "required", 4, 2, "N/A=4; pass(redundant/managed)=4; partial(unclear)=2; fail(single serving instance)=0.", "Add redundant serving capacity and place it behind a load-balanced entry path.", 6, 40, "Add compute redundancy", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Production compute is not a single point of failure."],
  ["autoscaling_defined_for_variable_load", "performance", "resiliency", "Scaling strategy is defined for variable or spiky demand", "high", "recommended", 3, 1, "N/A=3; pass(scaling explicit)=3; partial(not addressed)=1; fail('no scaling' variable)=0.", "Define autoscaling or workload elasticity signals, thresholds, and guardrails.", 4, 24, "Add scaling strategy", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Scaling strategy is defined for variable or spiky demand."],
  ["backup_restore_plan_for_stateful_data", "reliability", "resiliency", "Backups and restore steps exist for stateful data stores", "critical", "required", 4, 2, "N/A=4; pass(all stores backup+restore)=4; partial(partial/unclear)=2; fail(no backups)=0.", "Define automated backups for every stateful store and document how restore is validated.", 4, 40, "Implement and validate backups", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Backups and restore steps exist for stateful data stores."],
  ["zone_redundant_database", "reliability", "database", "Production relational databases use zone redundancy or an equivalent HA pattern", "critical", "required", 4, 2, "N/A=4; pass(zone redundant DB)=4; partial(unclear)=2; fail(single zone HA prod)=0.", "Enable zone redundancy or an equivalent high-availability database posture aligned to the stated recovery goals.", 4, 24, "Enable database high availability", "consultation-only", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Production relational databases use zone redundancy or an equivalent HA pattern."],
  ["centralized_application_logging", "operations", "observability", "Application/service logs are centralized", "high", "required", 4, 1, "pass(central logs)=4; partial(unclear for prod)=1; fail(no central logs prod)=0.", "Centralize service logs in Azure Monitor / Log Analytics with baseline retention and access controls.", 4, 20, "Centralize application logging", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/overview"], "Application/service logs are centralized."],
  ["monitor_alerts_for_key_metrics", "operations", "observability", "Key health metrics have alerts and a notification path", "high", "required", 3, 1, "pass(alerts+notif)=3; partial(unclear)=1; fail(no alerting prod)=0.", "Add alerts for errors, latency, and saturation, and route them to an operational notification path.", 4, 16, "Add alerts + notifications", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-overview"], "Key health metrics have alerts and a notification path."],
  ["network_watcher_flow_logs_enabled", "operations", "security", "Network flow logging is enabled for VNet-based workloads", "medium", "recommended", 3, 1, "N/A=3; pass(flow logs)=3; partial(unclear)=1; fail(reject logging high-risk)=0.", "Enable network flow logging for higher-risk VNet paths and retain the logs centrally.", 2, 12, "Enable network flow logging", "optional-polish", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Network flow logging is enabled for VNet-based workloads."],
  ["blob_versioning_enabled", "cost", "storage", "Blob versioning is enabled when retention or rollback is needed", "medium", "recommended", 2, 1, "N/A=2; pass(versioning)=2; partial(unclear)=1; fail(no rollback controls)=0.", "Enable blob versioning when the design needs rollback, retention, or accidental-delete recovery.", 1, 8, "Enable blob versioning where required", "optional-polish", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/storage/blobs/versioning-overview"], "Blob versioning is enabled when retention or rollback is needed."],
  ["blob_lifecycle_management_configured", "cost", "storage", "Blob lifecycle management is configured for retention and cost control", "medium", "recommended", 2, 1, "N/A=2; pass(lifecycle)=2; partial(unclear)=1; fail(no retention controls)=0.", "Add blob lifecycle rules for retention, tiering, and deletion so storage cost tracks the data policy.", 1, 8, "Configure blob lifecycle management", "optional-polish", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-policy-structure"], "Blob lifecycle management is configured for retention and cost control."],
  ["production_environment_isolated", "operations", "operations", "Production is isolated from non-production", "medium", "recommended", 2, 1, "N/A=2; pass(clear isolation)=2; partial(boundaries vague)=1; fail(shared data/creds)=0.", "Separate production from non-production using subscriptions, resource groups, networking, and identity boundaries.", 4, 24, "Isolate production from non-production", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Production is isolated from non-production."],
  ["infrastructure_as_code_indicated", "operations", "operations", "Infrastructure is managed as code (IaC)", "medium", "recommended", 2, 1, "pass(IaC explicit)=2; partial(implied)=1; fail(manual-only prod)=0.", "Adopt IaC for networking, identity, and core services; tie changes to a reviewed delivery pipeline.", 8, 60, "Adopt Infrastructure as Code", "remediation-estimate", "Fail only if explicit.", ["https://learn.microsoft.com/en-us/azure/well-architected/what-is-well-architected-framework"], "Infrastructure is managed as code (IaC)."],
];

export const AZURE_ARCHITECTURE_LAUNCH_V1_RULES: AzureArchitectureLaunchV1Rule[] =
  RAW_AZURE_ARCHITECTURE_LAUNCH_V1_RULES.map(
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
      id: `azure:${id}`,
      provider: "azure",
      ruleVersion: "azure-launch-v1",
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
      officialSourceLinks: urls.map((url) => ({ label: labelForAzureUrl(url), url })),
      customerSummarySnippet,
    }),
  );

const azureArchitectureLaunchV1RuleById = new Map(
  AZURE_ARCHITECTURE_LAUNCH_V1_RULES.map((rule) => [rule.id, rule]),
);

export function getAzureArchitectureLaunchV1Rule(ruleId: string) {
  const normalizedRuleId = ruleId.startsWith("azure:") ? ruleId : `azure:${ruleId}`;
  return azureArchitectureLaunchV1RuleById.get(normalizedRuleId) ?? null;
}
