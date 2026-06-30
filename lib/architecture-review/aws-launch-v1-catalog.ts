import type { ArchitectureCategory, ArchitectureEstimatePolicyBand } from "@/lib/architecture-review/types";
import type { ArchitectureReviewRule } from "@/lib/architecture-review/rule-types";

export type AwsArchitectureLaunchV1Rule = ArchitectureReviewRule;

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

function labelForAwsUrl(url: string) {
  if (url.includes("wellarchitected")) return "AWS Well-Architected guidance";
  if (url.includes("cloudtrail")) return "AWS CloudTrail documentation";
  if (url.includes("secretsmanager")) return "AWS Secrets Manager documentation";
  if (url.includes("AmazonRDS") || url.includes("rds-instance")) return "Amazon RDS documentation";
  if (url.includes("AmazonS3")) return "Amazon S3 documentation";
  if (url.includes("vpc")) return "Amazon VPC documentation";
  if (url.includes("waf")) return "AWS WAF documentation";
  if (url.includes("IAM")) return "AWS IAM documentation";
  if (url.includes("CloudWatch")) return "Amazon CloudWatch documentation";
  if (url.includes("config")) return "AWS Config rule reference";
  return "AWS documentation";
}

const RAW_AWS_ARCHITECTURE_LAUNCH_V1_RULES: RawRule[] = [
  ["workload_objective_and_constraints_stated", "clarity", "architecture-fit", "Workload objective and measurable constraints are stated", "high", "required", 2, 1, "pass(obj+≥2 constraints)=2; partial(obj only)=1; else=0.", "Collect a 5–10 line requirements blurb (objective, users, load, data sensitivity, uptime/RTO/RPO).", 0, 2, "Clarify requirements for a credible review", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html"], "Workload objective and measurable constraints are stated."],
  ["data_classification_and_compliance_noted", "security", "data", "Data sensitivity and compliance scope are stated", "high", "recommended", 3, 1, "pass(types+sens+compliance)=3; partial(partial)=1; else=0.", "Add a short data inventory: types, sensitivity, compliance scope, retention/deletion needs.", 0, 4, "Clarify data classification/compliance scope", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/data-classification.html"], "Data sensitivity and compliance scope are stated."],
  ["rto_rpo_defined", "reliability", "resiliency", "RTO/RPO (or clear equivalents) are defined for stateful workloads", "high", "recommended", 2, 1, "N/A=2; pass(RTO+RPO)=2; partial(one)=1; else=0.", "Define RTO/RPO; use them to choose backups, Multi-AZ, and (if needed) multi-Region DR.", 0, 4, "Define DR objectives (RTO/RPO)", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html"], "RTO/RPO (or clear equivalents) are defined for stateful workloads."],
  ["region_and_environment_boundaries_identified", "operations", "operations", "AWS Region and prod/non-prod boundaries are explicit", "medium", "recommended", 2, 1, "pass(Region+env)=2; partial(one)=1; fail(shared prod/nonprod or none)=0.", "Label Region and show production isolation (separate accounts preferred).", 1, 6, "Clarify Region + environment isolation", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/aws-account-management-and-separation.html"], "AWS Region and prod/non-prod boundaries are explicit."],
  ["diagram_narrative_core_component_mismatch", "clarity", "operations", "Diagram and narrative match on core components and data flows", "critical", "contradiction_check", 5, 2, "pass(no material mismatch)=5; partial(minor labels)=2; fail(material)=0.", "Align diagram and narrative 1:1 for entry points, tiers, and data flows before estimating remediation.", 1, 6, "Resolve diagram/narrative contradictions", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/framework/the-review-process.html"], "Diagram and narrative match on core components and data flows."],
  ["stated_multi_region_requirement_mismatch", "reliability", "operations", "Stated Multi-Region requirement matches the drawn design", "critical", "contradiction_check", 4, 2, "N/A=4; pass(2 Regions+rep+failover)=4; partial(2 Regions only)=2; else=0.", "Either remove the Multi-Region claim, or redesign with explicit secondary Region + replication + failover aligned to RTO/RPO.", 4, 40, "Align Multi-Region requirement with design", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html"], "Stated Multi-Region requirement matches the drawn design."],
  ["stated_private_only_requirement_mismatch", "security", "operations", "Stated private-only requirement matches network exposure", "critical", "contradiction_check", 4, 2, "N/A=4; pass(no public ingress+private path)=4; partial(private ingress only)=2; else=0.", "Clarify the requirement. If truly private-only, remove public ingress and use private connectivity patterns.", 4, 32, "Align private-only claim with design", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html"], "Stated private-only requirement matches network exposure."],
  ["internet_facing_endpoint_without_tls", "security", "security", "Internet-facing endpoints enforce HTTPS/TLS", "critical", "required", 5, 2, "N/A=5; pass(all public HTTPS/TLS)=5; partial(protocol unclear)=2; fail(any HTTP-only)=0.", "Terminate TLS at CloudFront/API Gateway/ALB using ACM; enforce HTTPS-only.", 2, 12, "Enforce HTTPS/TLS on public endpoints", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_protect_data_transit_encrypt.html"], "Internet-facing endpoints enforce HTTPS/TLS."],
  ["public_database_exposure", "security", "security", "Databases are not publicly accessible", "critical", "anti_pattern", 5, 2, "N/A=5; pass(DB private-only)=5; partial(exposure unclear)=2; fail(public DB)=0.", "Move DB to private subnets and remove public accessibility; access via app tier + controlled admin path.", 4, 24, "Remove public database exposure", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/config/latest/developerguide/rds-instance-public-access-check.html"], "Databases are not publicly accessible."],
  ["public_s3_bucket_access", "security", "storage", "S3 buckets are not publicly readable/writable by default", "critical", "anti_pattern", 4, 2, "N/A=4; pass(non-public posture)=4; partial(unclear)=2; fail(public read/write non-public)=0.", "Enable Block Public Access; restrict bucket policy to least-privileged principals; use CloudFront for public assets.", 2, 16, "Remove public S3 bucket access", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html"], "S3 buckets are not publicly readable/writable by default."],
  ["unrestricted_admin_ports_from_internet", "security", "security", "No unrestricted SSH/RDP (or broad admin ports) from the internet", "critical", "anti_pattern", 5, 2, "N/A=5; pass(admin controlled)=5; partial(unclear)=2; fail(SSH/RDP open-to-world)=0.", "Close public admin ports; use Session Manager or VPN + restricted CIDRs + auditing.", 2, 16, "Lock down SSH/RDP exposure", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html"], "No unrestricted SSH/RDP (or broad admin ports) from the internet."],
  ["secrets_management_centralized", "security", "security", "Secrets live in Secrets Manager or Parameter Store, not in code/config", "high", "required", 4, 1, "N/A=4; pass(SecretsMgr/SSM SecureString)=4; partial(unclear)=1; fail(secret in code/diagram)=0.", "Move secrets to Secrets Manager (preferred) or Parameter Store SecureString; fetch at runtime; scrub leaked secrets.", 4, 24, "Centralize secrets management", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html"], "Secrets live in Secrets Manager or Parameter Store, not in code/config."],
  ["iam_roles_and_temporary_credentials", "security", "identity", "Use IAM roles/temporary credentials (avoid long-term access keys)", "high", "required", 4, 1, "N/A=4; pass(app roles+human SSO)=4; partial(app roles only)=1; fail(embedded keys/root keys)=0.", "Replace long-term keys with IAM roles + temporary credentials; move humans to IAM Identity Center/federation.", 4, 24, "Remove long-term AWS access keys", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html"], "Use IAM roles/temporary credentials (avoid long-term access keys)."],
  ["cloudtrail_multi_region_enabled", "operations", "security", "CloudTrail is enabled with multi-Region coverage", "high", "required", 4, 1, "pass(CloudTrail multi-Region)=4; partial(CloudTrail unclear)=1; fail(CloudTrail off)=0.", "Enable a multi-Region trail and deliver logs to a locked-down S3 log archive bucket.", 2, 12, "Enable CloudTrail audit logging", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-trails.html"], "CloudTrail is enabled with multi-Region coverage."],
  ["waf_on_public_endpoints", "security", "security", "AWS WAF protects the public entry point", "high", "recommended", 3, 1, "N/A=3; pass(WAF on entry)=3; partial(not mentioned)=1; fail(refusal high-risk)=0.", "Attach AWS WAF to the public entry point; start with AWS Managed Rules + basic rate limiting.", 4, 24, "Add AWS WAF", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html"], "AWS WAF protects the public entry point."],
  ["vpc_public_private_subnet_separation", "security", "networking", "Clear public vs private subnet separation for VPC-based tiers", "high", "recommended", 3, 1, "N/A=3; pass(public/private tiers)=3; partial(unclear)=1; fail(internal tiers public)=0.", "Rework VPC layout: ingress in public subnets; app/data in private subnets; document egress strategy.", 4, 24, "Harden subnet layout", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/vpc/latest/userguide/vpc-example-private-subnets-nat.html"], "Clear public vs private subnet separation for VPC-based tiers."],
  ["nat_gateway_per_az_for_private_egress", "reliability", "networking", "Private egress uses per-AZ NAT gateways (no single NAT bottleneck)", "medium", "recommended", 2, 1, "N/A=2; pass(per-AZ NAT)=2; partial(unclear)=1; fail(single NAT multi-AZ)=0.", "Add NAT per AZ and fix route tables so each subnet uses its local NAT.", 2, 12, "Improve NAT HA (per-AZ NAT)", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html"], "Private egress uses per-AZ NAT gateways (no single NAT bottleneck)."],
  ["alb_in_at_least_two_azs", "reliability", "networking", "Application Load Balancer spans at least two AZs", "high", "required", 2, 1, "N/A=2; pass(ALB ≥2 AZ)=2; partial(unclear)=1; fail(single-AZ ALB)=0.", "Attach ALB to subnets in at least two AZs.", 1, 6, "Make ALB multi-AZ", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/autoscaling/ec2/userguide/as-add-az-console.html"], "Application Load Balancer spans at least two AZs."],
  ["single_instance_production_compute", "reliability", "compute", "Production compute is not a single point of failure", "critical", "required", 4, 2, "N/A=4; pass(redundant/managed)=4; partial(unclear)=2; fail(single serving instance)=0.", "Add redundancy (≥2 instances/tasks) + load balancing; adopt Auto Scaling/desired-count management.", 6, 40, "Add compute redundancy", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-principles.html"], "Production compute is not a single point of failure."],
  ["compute_multi_az_deployment", "reliability", "resiliency", "Compute tier is deployed across multiple AZs", "high", "recommended", 3, 1, "N/A=3; pass(≥2 AZ)=3; partial(unclear)=1; fail(single-AZ HA)=0.", "Deploy compute to subnets in ≥2 AZs and ensure traffic can route to both.", 4, 24, "Deploy compute across multiple AZs", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/use-fault-isolation-to-protect-your-workload.html"], "Compute tier is deployed across multiple AZs."],
  ["autoscaling_defined_for_variable_load", "performance", "resiliency", "Scaling strategy is defined for variable or spiky demand", "high", "recommended", 3, 1, "N/A=3; pass(scaling explicit)=3; partial(not addressed)=1; fail('no scaling' variable)=0.", "Add a scaling strategy (Auto Scaling/serverless limits) with clear scaling signals and safety limits.", 4, 24, "Add scaling strategy", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-principles.html"], "Scaling strategy is defined for variable or spiky demand."],
  ["no_backup_strategy_for_stateful_data", "reliability", "resiliency", "Backups exist for all stateful data stores", "critical", "required", 4, 2, "N/A=4; pass(all stores backup+restore)=4; partial(partial/unclear)=2; fail(no backups)=0.", "Define and implement automated backups for every stateful store; document/validate restores.", 4, 40, "Implement and validate backups", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/back-up-data.html"], "Backups exist for all stateful data stores."],
  ["single_az_database_for_production", "reliability", "database", "Production relational databases use Multi-AZ (or equivalent)", "critical", "required", 4, 2, "N/A=4; pass(DB Multi-AZ)=4; partial(unclear)=2; fail(single-AZ HA prod)=0.", "Enable Multi-AZ for RDS/Aurora (or redesign to a multi-location database strategy aligned to requirements).", 4, 24, "Enable Multi-AZ database redundancy", "consultation-only", "Fail only if explicit.", ["https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html"], "Production relational databases use Multi-AZ (or equivalent)."],
  ["rds_encryption_at_rest", "security", "security", "RDS/Aurora data is encrypted at rest", "medium", "recommended", 2, 1, "N/A=2; pass(encrypt at rest)=2; partial(unclear)=1; fail(unencrypted sensitive)=0.", "Enable RDS encryption at rest using KMS (customer-managed key if required).", 2, 12, "Encrypt the database at rest", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html"], "RDS/Aurora data is encrypted at rest."],
  ["centralized_application_logging", "operations", "observability", "Application/service logs are centralized", "high", "required", 4, 1, "pass(central logs)=4; partial(unclear for prod)=1; fail(no central logs prod)=0.", "Ship logs to CloudWatch Logs (and set baseline retention/access).", 4, 20, "Centralize application logging", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/WhatIsCloudWatchLogs.html"], "Application/service logs are centralized."],
  ["cloudwatch_alarms_for_key_metrics", "operations", "observability", "Key health metrics have CloudWatch alarms + notification path", "high", "required", 3, 1, "pass(alarms+notif)=3; partial(unclear)=1; fail(no alerting prod)=0.", "Add a minimal alarm set (errors/latency/saturation) and route to an on-call channel.", 4, 16, "Add CloudWatch alarms + notifications", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Alarms.html"], "Key health metrics have CloudWatch alarms + notification path."],
  ["vpc_flow_logs_enabled", "operations", "security", "VPC Flow Logs are enabled (network visibility)", "medium", "recommended", 3, 1, "N/A=3; pass(Flow Logs)=3; partial(unclear)=1; fail(reject logging high-risk)=0.", "Enable VPC Flow Logs and set retention/access controls.", 2, 12, "Enable VPC Flow Logs", "optional-polish", "Fail only if explicit.", ["https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html"], "VPC Flow Logs are enabled (network visibility)."],
  ["cloudfront_s3_origin_oac_enabled", "security", "security", "CloudFront + S3 uses Origin Access Control (no direct bucket bypass)", "high", "recommended", 3, 1, "N/A=3; pass(OAC/origin restricted)=3; partial(unclear)=1; fail(bucket bypass)=0.", "Enable CloudFront OAC and restrict the S3 bucket policy to CloudFront only.", 2, 12, "Restrict S3 origin access (OAC)", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/config/latest/developerguide/cloudfront-s3-origin-access-control-enabled.html"], "CloudFront + S3 uses Origin Access Control (no direct bucket bypass)."],
  ["multi_account_prod_isolation", "operations", "operations", "Production is isolated from non-production (accounts preferred)", "medium", "recommended", 2, 1, "N/A=2; pass(separate accounts)=2; partial(strong boundaries)=1; fail(shared data/creds)=0.", "Move production to its own AWS account (preferred) or establish strong boundaries (VPC/data/roles) with a roadmap.", 4, 40, "Isolate production from non-production", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/aws-account-management-and-separation.html"], "Production is isolated from non-production (accounts preferred)."],
  ["infrastructure_as_code_indicated", "operations", "operations", "Infrastructure is managed as code (IaC)", "medium", "recommended", 2, 1, "pass(IaC explicit)=2; partial(implied)=1; fail(manual-only prod)=0.", "Adopt IaC for networking, IAM, and core services; integrate with CI/CD.", 8, 60, "Adopt Infrastructure as Code", "remediation-estimate", "Fail only if explicit.", ["https://docs.aws.amazon.com/wellarchitected/latest/framework/oe-design-principles.html"], "Infrastructure is managed as code (IaC)."],
];

export const AWS_ARCHITECTURE_LAUNCH_V1_RULES: AwsArchitectureLaunchV1Rule[] = RAW_AWS_ARCHITECTURE_LAUNCH_V1_RULES.map(
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
    id: `aws:${id}`,
    provider: "aws",
    ruleVersion: "aws-launch-v1",
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
    officialSourceLinks: urls.map((url) => ({ label: labelForAwsUrl(url), url })),
    customerSummarySnippet,
  }),
);

export const awsArchitectureLaunchV1RuleById = new Map(
  AWS_ARCHITECTURE_LAUNCH_V1_RULES.map((rule) => [rule.id, rule]),
);

export function getAwsArchitectureLaunchV1Rule(ruleId: string) {
  const normalizedRuleId = ruleId.startsWith("aws:") ? ruleId : `aws:${ruleId}`;
  return awsArchitectureLaunchV1RuleById.get(normalizedRuleId) ?? null;
}
