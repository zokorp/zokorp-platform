import type { ArchitectureCategory, ArchitectureEstimatePolicyBand } from "@/lib/architecture-review/types";
import type { ArchitectureReviewRule } from "@/lib/architecture-review/rule-types";

export type GcpArchitectureLaunchV1Rule = ArchitectureReviewRule;

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

function labelForGcpUrl(url: string) {
  if (url.includes("/architecture/framework")) return "Google Cloud Architecture Framework";
  if (url.includes("well-architected-framework")) return "Google Cloud Well-Architected guidance";
  if (url.includes("/storage/docs/object-versioning")) return "Cloud Storage versioning guidance";
  if (url.includes("/storage/docs/lifecycle")) return "Cloud Storage lifecycle guidance";
  if (url.includes("service-account-keys")) return "GCP service account key guidance";
  if (url.includes("/monitoring/alerts")) return "Cloud Monitoring alerts documentation";
  if (url.includes("/logging/docs/alerting/monitoring-logs")) return "Cloud Logging alerting documentation";
  if (url.includes("/secret-manager/")) return "Secret Manager documentation";
  return "Google Cloud documentation";
}

const RAW_GCP_ARCHITECTURE_LAUNCH_V1_RULES: RawRule[] = [
  ["workload_objective_and_constraints_stated", "clarity", "architecture-fit", "Workload objective and measurable constraints are stated", "high", "required", 2, 1, "pass(obj+≥2 constraints)=2; partial(obj only)=1; else=0.", "Collect a 5–10 line requirements blurb (objective, users, load, data sensitivity, uptime/RTO/RPO).", 0, 2, "Clarify requirements for a credible review", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "Workload objective and measurable constraints are stated."],
  ["data_classification_and_compliance_noted", "security", "data", "Data sensitivity and compliance scope are stated", "high", "recommended", 3, 1, "pass(types+sens+compliance)=3; partial(partial)=1; else=0.", "Add a short data inventory: types, sensitivity, compliance scope, retention/deletion needs.", 0, 4, "Clarify data classification/compliance scope", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Data sensitivity and compliance scope are stated."],
  ["rto_rpo_defined", "reliability", "resiliency", "RTO/RPO (or clear equivalents) are defined for stateful workloads", "high", "recommended", 2, 1, "N/A=2; pass(RTO+RPO)=2; partial(one)=1; else=0.", "Define RTO/RPO; use them to choose backups, regional architecture, and failover posture.", 0, 4, "Define DR objectives (RTO/RPO)", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "RTO/RPO (or clear equivalents) are defined for stateful workloads."],
  ["region_and_environment_boundaries_identified", "operations", "operations", "GCP region/project boundaries and prod/non-prod boundaries are explicit", "medium", "recommended", 2, 1, "pass(region+env)=2; partial(one)=1; else=0.", "Label the serving region and show production isolation (projects preferred).", 1, 6, "Clarify region + environment isolation", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "GCP region/project boundaries and prod/non-prod boundaries are explicit."],
  ["stated_multi_region_requirement_mismatch", "reliability", "operations", "Stated multi-region requirement matches the drawn design", "critical", "contradiction_check", 4, 2, "N/A=4; pass(2 regions+replication+failover)=4; partial(2 regions only)=2; else=0.", "Either remove the multi-region claim, or redesign with a secondary region, replication path, and failover aligned to RTO/RPO.", 4, 40, "Align multi-region requirement with design", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "Stated multi-region requirement matches the drawn design."],
  ["stated_private_only_requirement_mismatch", "security", "operations", "Stated private-only requirement matches network exposure", "critical", "contradiction_check", 4, 2, "N/A=4; pass(no public ingress+private path)=4; partial(private ingress only)=2; else=0.", "Clarify the requirement. If truly private-only, remove public ingress and use private networking, VPN, or Interconnect paths.", 4, 32, "Align private-only claim with design", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "Stated private-only requirement matches network exposure."],
  ["internet_facing_endpoint_without_tls", "security", "security", "Internet-facing endpoints enforce HTTPS/TLS", "critical", "required", 5, 2, "N/A=5; pass(all public HTTPS/TLS)=5; partial(protocol unclear)=2; fail(any HTTP-only)=0.", "Terminate TLS on the public entry point and enforce HTTPS-only for every public path.", 2, 12, "Enforce HTTPS/TLS on public endpoints", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Internet-facing endpoints enforce HTTPS/TLS."],
  ["public_database_exposure", "security", "security", "Databases are not publicly accessible", "critical", "anti_pattern", 5, 2, "N/A=5; pass(DB private-only)=5; partial(exposure unclear)=2; fail(public DB)=0.", "Move databases behind private networking and remove public exposure; use controlled admin paths.", 4, 24, "Remove public database exposure", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Databases are not publicly accessible."],
  ["unrestricted_admin_ports_from_internet", "security", "security", "No unrestricted SSH/RDP (or broad admin ports) from the internet", "critical", "anti_pattern", 5, 2, "N/A=5; pass(admin controlled)=5; partial(unclear)=2; fail(SSH/RDP open-to-world)=0.", "Close public admin ports; use IAP, bastion controls, VPN, or restricted allowlists with auditing.", 2, 16, "Lock down SSH/RDP exposure", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "No unrestricted SSH/RDP (or broad admin ports) from the internet."],
  ["secret_manager_secrets_management", "security", "security", "Secrets live in Secret Manager, not in code/config", "high", "required", 4, 1, "N/A=4; pass(Secret Manager)=4; partial(unclear)=1; fail(secret in code/diagram)=0.", "Move secrets into Secret Manager; fetch them at runtime; scrub any embedded secrets from code or deployment artifacts.", 4, 24, "Centralize secrets management with Secret Manager", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/secret-manager/docs/overview"], "Secrets live in Secret Manager, not in code/config."],
  ["service_account_keyless_identity", "security", "identity", "Least-privilege identities avoid long-lived service account keys", "high", "required", 4, 1, "N/A=4; pass(keyless identities+least privilege)=4; partial(one)=1; fail(embedded keys)=0.", "Prefer workload identity or attached service identities over service account keys, and narrow IAM permissions to the minimum scope.", 4, 24, "Remove long-lived service account keys", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys"], "Least-privilege identities avoid long-lived service account keys."],
  ["waf_on_public_endpoints", "security", "security", "Cloud Armor or an equivalent WAF protects the public entry point", "high", "recommended", 3, 1, "N/A=3; pass(WAF on entry)=3; partial(not mentioned)=1; fail(refusal high-risk)=0.", "Protect the public entry point with Cloud Armor or an equivalent managed L7 control set and rate limiting.", 4, 24, "Add WAF protection on public endpoints", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Cloud Armor or an equivalent WAF protects the public entry point."],
  ["vpc_public_private_subnet_separation", "security", "networking", "Clear public vs private subnet separation exists for VPC-based tiers", "high", "recommended", 3, 1, "N/A=3; pass(public/private tiers)=3; partial(unclear)=1; fail(internal tiers public)=0.", "Rework the VPC layout so ingress stays on public-facing edges and app/data tiers remain private.", 4, 24, "Harden subnet layout", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Clear public vs private subnet separation exists for VPC-based tiers."],
  ["zone_redundant_compute", "reliability", "resiliency", "Compute tier spans multiple zones when HA is claimed", "high", "recommended", 3, 1, "N/A=3; pass(≥2 zones)=3; partial(unclear)=1; fail(single zone HA)=0.", "Deploy compute across at least two zones when the workload claims HA or production resilience.", 4, 24, "Deploy compute across multiple zones", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "Compute tier spans multiple zones when HA is claimed."],
  ["single_instance_production_compute", "reliability", "compute", "Production compute is not a single point of failure", "critical", "required", 4, 2, "N/A=4; pass(redundant/managed)=4; partial(unclear)=2; fail(single serving instance)=0.", "Add redundant serving capacity and place it behind a load-balanced entry path.", 6, 40, "Add compute redundancy", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Production compute is not a single point of failure."],
  ["autoscaling_defined_for_variable_load", "performance", "resiliency", "Scaling strategy is defined for variable or spiky demand", "high", "recommended", 3, 1, "N/A=3; pass(scaling explicit)=3; partial(not addressed)=1; fail('no scaling' variable)=0.", "Define autoscaling or workload elasticity signals, thresholds, and guardrails.", 4, 24, "Add scaling strategy", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "Scaling strategy is defined for variable or spiky demand."],
  ["backup_restore_plan_for_stateful_data", "reliability", "resiliency", "Backups and restore steps exist for stateful data stores", "critical", "required", 4, 2, "N/A=4; pass(all stores backup+restore)=4; partial(partial/unclear)=2; fail(no backups)=0.", "Define automated backups for every stateful store and document how restore is validated.", 4, 40, "Implement and validate backups", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Backups and restore steps exist for stateful data stores."],
  ["zone_redundant_database", "reliability", "database", "Production relational databases use regional or zonal HA aligned to requirements", "critical", "required", 4, 2, "N/A=4; pass(regional/zonal HA)=4; partial(unclear)=2; fail(single zone HA prod)=0.", "Enable a high-availability database posture aligned to the stated recovery goals.", 4, 24, "Enable database high availability", "consultation-only", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "Production relational databases use regional or zonal HA aligned to requirements."],
  ["centralized_application_logging", "operations", "observability", "Application/service logs are centralized", "high", "required", 4, 1, "pass(central logs)=4; partial(unclear for prod)=1; fail(no central logs prod)=0.", "Centralize service logs in Cloud Logging with baseline retention and access controls.", 4, 20, "Centralize application logging", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/logging/docs/alerting/monitoring-logs"], "Application/service logs are centralized."],
  ["monitor_alerts_for_key_metrics", "operations", "observability", "Key health metrics have alerts and a notification path", "high", "required", 3, 1, "pass(alerts+notif)=3; partial(unclear)=1; fail(no alerting prod)=0.", "Add alerts for errors, latency, and saturation, and route them to an operational notification path.", 4, 16, "Add alerts + notifications", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/monitoring/alerts"], "Key health metrics have alerts and a notification path."],
  ["vpc_flow_logs_enabled", "operations", "security", "VPC Flow Logs are enabled for higher-risk VPC paths", "medium", "recommended", 3, 1, "N/A=3; pass(flow logs)=3; partial(unclear)=1; fail(reject logging high-risk)=0.", "Enable VPC Flow Logs or an equivalent network logging path for higher-risk workloads.", 2, 12, "Enable network flow logging", "optional-polish", "Fail only if explicit.", ["https://docs.cloud.google.com/docs/get-started/well-architected-framework"], "VPC Flow Logs are enabled for higher-risk VPC paths."],
  ["cloud_storage_versioning_enabled", "cost", "storage", "Cloud Storage object versioning is enabled when retention or rollback is needed", "medium", "recommended", 2, 1, "N/A=2; pass(versioning)=2; partial(unclear)=1; fail(no rollback controls)=0.", "Enable Cloud Storage object versioning when the design needs rollback, retention, or accidental-delete recovery.", 1, 8, "Enable Cloud Storage versioning where required", "optional-polish", "Fail only if explicit.", ["https://docs.cloud.google.com/storage/docs/object-versioning"], "Cloud Storage object versioning is enabled when retention or rollback is needed."],
  ["cloud_storage_lifecycle_management_configured", "cost", "storage", "Cloud Storage lifecycle management is configured for retention and cost control", "medium", "recommended", 2, 1, "N/A=2; pass(lifecycle)=2; partial(unclear)=1; fail(no retention controls)=0.", "Add Cloud Storage lifecycle rules for retention, tiering, and deletion so storage cost tracks the data policy.", 1, 8, "Configure Cloud Storage lifecycle management", "optional-polish", "Fail only if explicit.", ["https://docs.cloud.google.com/storage/docs/lifecycle"], "Cloud Storage lifecycle management is configured for retention and cost control."],
  ["production_environment_isolated", "operations", "operations", "Production is isolated from non-production", "medium", "recommended", 2, 1, "N/A=2; pass(clear isolation)=2; partial(boundaries vague)=1; fail(shared data/creds)=0.", "Separate production from non-production using projects, networking, and identity boundaries.", 4, 24, "Isolate production from non-production", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "Production is isolated from non-production."],
  ["infrastructure_as_code_indicated", "operations", "operations", "Infrastructure is managed as code (IaC)", "medium", "recommended", 2, 1, "pass(IaC explicit)=2; partial(implied)=1; fail(manual-only prod)=0.", "Adopt IaC for networking, identity, and core services; tie changes to a reviewed delivery pipeline.", 8, 60, "Adopt Infrastructure as Code", "remediation-estimate", "Fail only if explicit.", ["https://docs.cloud.google.com/architecture/framework"], "Infrastructure is managed as code (IaC)."],
];

export const GCP_ARCHITECTURE_LAUNCH_V1_RULES: GcpArchitectureLaunchV1Rule[] =
  RAW_GCP_ARCHITECTURE_LAUNCH_V1_RULES.map(
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
      id: `gcp:${id}`,
      provider: "gcp",
      ruleVersion: "gcp-launch-v1",
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
      officialSourceLinks: urls.map((url) => ({ label: labelForGcpUrl(url), url })),
      customerSummarySnippet,
    }),
  );

const gcpArchitectureLaunchV1RuleById = new Map(
  GCP_ARCHITECTURE_LAUNCH_V1_RULES.map((rule) => [rule.id, rule]),
);

export function getGcpArchitectureLaunchV1Rule(ruleId: string) {
  const normalizedRuleId = ruleId.startsWith("gcp:") ? ruleId : `gcp:${ruleId}`;
  return gcpArchitectureLaunchV1RuleById.get(normalizedRuleId) ?? null;
}
