// Counterfactual cost notes — the "here's what fixing vs not fixing costs"
// context that sells the finding. Without it, readers see "fix this" without
// understanding the trade-off. With it, they can defend the spend to finance
// in the same sentence.
//
// These notes are anchored to public list pricing as of 2026 and to common
// failure-mode cost ranges. They are intentionally honest about both
// directions — sometimes the fix costs more, sometimes it's free, sometimes
// the non-fix cost is reputational not operational.

const COUNTERFACTUAL_COSTS: Record<string, string> = {
  // ---- AWS — Security ----
  "aws:public_database_exposure":
    "Removing public access is ~$0 in infrastructure cost. A single compromised public DB credential typically costs six figures in incident response + breach notification + lost trust. Move it to a private subnet and access via Session Manager or VPN.",
  "aws:internet_facing_endpoint_without_tls":
    "ACM certificates are free, and TLS termination at CloudFront/ALB adds no per-request cost. Unencrypted public traffic costs nothing today, but it's table-stakes for any compliance scope and the first thing security scans flag.",
  "aws:rds_encryption_at_rest":
    "RDS encryption at rest is free when enabled at create time. Migrating a live unencrypted DB later means downtime + a snapshot-restore cycle — the cheapest moment to turn this on is before there's any data.",
  "aws:secrets_management_centralized":
    "Secrets Manager runs ~$0.40/secret/month plus API call fees. Migrating from .env files or hard-coded values later costs deployment-pipeline rewrites and the embarrassment of a public-Git-commit incident. The cost of doing it from day one is trivial.",
  "aws:iam_roles_and_temporary_credentials":
    "IAM roles + STS temporary credentials are free. Long-term access keys cost ~$0 to create but average ~$0 to rotate in practice (because nobody does it), which is exactly how they leak. Roles eliminate the rotation question.",
  "aws:unrestricted_admin_ports_from_internet":
    "Session Manager is free and removes the need for any inbound SSH/RDP port. Open admin ports cost nothing — right up until they're an entry vector.",
  "aws:public_s3_bucket_access":
    "Block Public Access at the account level is free. A single accidentally-public S3 bucket has cost more than one company over $1M in data exfil + breach response. The default-private posture is the cheapest insurance available.",
  "aws:waf_on_public_endpoints":
    "AWS WAF Managed Rules run ~$1/rule-month + $0.60 per million requests. Each rule blocks a known class of attack. The cost of NOT having WAF is exactly $0/month right up until the day it isn't.",
  "aws:cloudfront_s3_origin_oac_enabled":
    "Origin Access Control is free. Without it, direct-to-S3 URLs bypass CloudFront's caching + WAF, which costs you both the cache benefit and the perimeter protection.",

  // ---- AWS — Reliability ----
  "aws:nat_gateway_per_az_for_private_egress":
    "Single NAT Gateway runs ~$32/month + data fees and is a single-AZ SPOF — when that AZ goes, all egress dies. Per-AZ NATs cost ~$96/month total for 3 AZs and remove the regional egress dependency on one AZ.",
  "aws:single_az_database_for_production":
    "RDS Multi-AZ roughly doubles the database bill (~+100% on storage + compute), but turns a database failure from a multi-hour DR event into ~60-120 seconds of automated failover with zero data loss. The math nearly always favors Multi-AZ for anything customer-facing.",
  "aws:single_instance_production_compute":
    "Adding a second instance behind the existing ALB adds ~+100% compute cost on that tier — but removes the most-failed pattern in production AWS: the single-instance prod box that nobody noticed until it died at 3 AM.",
  "aws:compute_multi_az_deployment":
    "Spanning two AZs adds AZ-to-AZ data transfer (~$0.01/GB). The eliminated risk is a 4-8 hour outage if that single AZ degrades. For anything beyond a hobby workload, the data-transfer cost is rounding.",
  "aws:alb_in_at_least_two_azs":
    "ALB pricing is the same regardless of how many AZs it spans. Attaching a second subnet costs nothing and removes the single-AZ ingress failure mode entirely.",
  "aws:no_backup_strategy_for_stateful_data":
    "AWS Backup costs ~$0.05/GB-month for daily snapshots. The non-fix cost is unrecoverable data loss — there's no upper bound on this one. The math always favors enabling backups.",
  "aws:autoscaling_defined_for_variable_load":
    "Auto Scaling itself is free. The savings come from not paying for peak capacity 24/7. Workloads with diurnal traffic commonly save 30-50% on compute vs. fixed sizing.",

  // ---- AWS — Operations / Observability ----
  "aws:cloudtrail_multi_region_enabled":
    "Multi-region CloudTrail is free for management events and ~$2 per 100K data events. Without it, reconstructing what happened during a security incident becomes guesswork — the cost gets paid in forensic effort, not on the bill.",
  "aws:centralized_application_logging":
    "CloudWatch Logs costs ~$0.50/GB ingested + ~$0.03/GB stored. Cheaper than SSH'ing into individual boxes after the fact. The bigger cost of not having centralized logs is the time spent chasing incidents that already happened.",
  "aws:cloudwatch_alarms_for_key_metrics":
    "Alarms are ~$0.10/alarm-month. The cost of NOT having alerting shows up in MTTD (mean time to detect) — usually 30-90 minutes longer per incident, multiplied by every customer-facing minute lost.",
  "aws:vpc_flow_logs_enabled":
    "VPC Flow Logs are ~$0.50/GB ingested + storage costs. For most VPCs this is single-digit dollars per month. Without them, network forensics during an incident is essentially blind.",
  "aws:infrastructure_as_code_indicated":
    "IaC tooling (CDK, Terraform, CloudFormation) is free. The non-IaC cost is paid in 'mystery resources nobody can recreate' — the kind that survives just long enough to become a quarterly fire when one of them needs to be moved.",

  // ---- Azure — Security ----
  "azure:public_database_exposure":
    "Private endpoints on Azure SQL or Cosmos DB are ~$7-10/month each — trivial compared to the cost of a single compromised public DB credential. Move it private and access via Bastion or VPN.",
  "azure:key_vault_secrets_management":
    "Key Vault is ~$0.03 per 10K operations. Cheaper than recovering from a leaked-credentials incident in the public Git history.",
  "azure:managed_identity_least_privilege":
    "Managed Identities are free. Service principals with long-lived secrets cost nothing to create and almost never get rotated — which is exactly how they leak.",
  "azure:waf_on_public_endpoints":
    "Azure WAF / Front Door WAF costs ~$5/month + per-rule + per-request fees. The cost of NOT having WAF is exactly $0/month until it isn't.",

  // ---- Azure — Reliability ----
  "azure:zone_redundant_compute":
    "Zone-redundant compute pricing is typically ~1.5x single-zone. Removes the single-zone failure mode that has historically caused entire-region degradation on Azure.",
  "azure:zone_redundant_database":
    "Zone-redundant Azure SQL or Cosmos DB adds ~50-100% to the database bill but removes the single-zone failure scenario. For anything customer-facing, the math favors zone-redundancy.",
  "azure:backup_restore_plan_for_stateful_data":
    "Azure Backup costs ~$0.05/GB-month for daily snapshots. The non-fix cost is unrecoverable data loss — no upper bound.",

  // ---- Azure — Operations ----
  "azure:centralized_application_logging":
    "Log Analytics costs ~$2.30/GB ingested in a basic workspace. Without it, incident reconstruction means SSH'ing into individual VMs and parsing local logs — usually too slow to catch the actual root cause in time.",
  "azure:monitor_alerts_for_key_metrics":
    "Azure Monitor alerts cost ~$0.10/alert-rule-month + per-evaluation fees. The cost of NOT having alerting shows up in MTTD, multiplied by every customer-facing minute lost during the next incident.",
  "azure:network_watcher_flow_logs_enabled":
    "Network Watcher flow logs are ~$0.50/GB ingested. Cheap insurance for any production VNet — without them, network-layer incident forensics is blind.",
  "azure:infrastructure_as_code_indicated":
    "IaC tooling (Bicep, Terraform, ARM) is free. Manual portal deployments cost nothing to create but accumulate as untracked drift — the kind of thing that surfaces during the next audit or migration.",

  // ---- Cross-provider / shared ----
  "shared:diagram_narrative_core_component_mismatch":
    "Zero direct cost to fix. But a misaligned diagram + narrative costs every future engagement an extra 15-30 minutes of clarifying questions, multiplied by every reviewer, every audit, every onboarding. Worth fixing once and never again.",
};

export function getCounterfactualCost(ruleId: string): string | null {
  return COUNTERFACTUAL_COSTS[ruleId] ?? null;
}

export function getCounterfactualCostCount(): number {
  return Object.keys(COUNTERFACTUAL_COSTS).length;
}

// Exposed so the sample report page can surface a synthetic "fixing this is
// the cheap option" note even when the demo rule IDs don't match anything
// in the live catalog.
export const SAMPLE_COUNTERFACTUAL_COST =
  "If this were a real production environment: a $0 (or near-$0) fix vs. a six-figure incident cost. The math nearly always favors fixing it before the auditor or attacker notices.";
