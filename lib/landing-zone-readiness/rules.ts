import type {
  LandingZoneReadinessAnswers,
  ReadinessCategory,
  FindingSeverity,
} from "@/lib/landing-zone-readiness/types";

type EvaluatedRule = {
  ruleId: string;
  category: ReadinessCategory;
  trigger: string;
  pointsDeducted: number;
  finding: string;
  fix: string;
  severity: FindingSeverity;
  coreControl: boolean;
};

type LandingZoneRule = {
  ruleId: string;
  category: ReadinessCategory;
  trigger: string;
  finding: string;
  fix: string;
  severity: FindingSeverity;
  coreControl?: boolean;
  evaluate: (answers: LandingZoneReadinessAnswers) => number;
};

function deductionFromYesPartialNo(value: "yes" | "partial" | "no", fullWeight: number) {
  if (value === "yes") {
    return 0;
  }

  if (value === "partial") {
    return Math.max(1, Math.ceil(fullWeight / 2));
  }

  return fullWeight;
}

function createYesPartialNoRule(input: {
  ruleId: string;
  category: ReadinessCategory;
  field: keyof LandingZoneReadinessAnswers;
  weight: number;
  trigger: string;
  finding: string;
  fix: string;
  severity: FindingSeverity;
  coreControl?: boolean;
}) {
  return {
    ruleId: input.ruleId,
    category: input.category,
    trigger: input.trigger,
    finding: input.finding,
    fix: input.fix,
    severity: input.severity,
    coreControl: input.coreControl,
    evaluate(answers: LandingZoneReadinessAnswers) {
      const value = answers[input.field];
      if (value !== "yes" && value !== "partial" && value !== "no") {
        return 0;
      }

      return deductionFromYesPartialNo(value, input.weight);
    },
  } satisfies LandingZoneRule;
}

export const LANDING_ZONE_RULES: LandingZoneRule[] = [
  createYesPartialNoRule({
    ruleId: "IAM-SSO",
    category: "identity_access",
    field: "hasSso",
    weight: 2,
    trigger: "SSO is missing or inconsistent.",
    finding: "SSO is missing or not used consistently.",
    fix: "Put workforce access behind one company-managed SSO flow.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "IAM-MFA",
    category: "identity_access",
    field: "enforcesMfa",
    weight: 4,
    trigger: "MFA is not enforced for all privileged access.",
    finding: "MFA is not enforced everywhere it should be.",
    fix: "Require MFA for admins, production access, and console sign-in.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "IAM-CENTRAL-IDP",
    category: "identity_access",
    field: "centralizedIdentity",
    weight: 2,
    trigger: "Identity is managed in multiple disconnected places.",
    finding: "Cloud identity is not centralized.",
    fix: "Use one primary identity source and connect cloud roles to it.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "IAM-BREAK-GLASS",
    category: "identity_access",
    field: "breakGlassProcess",
    weight: 2,
    trigger: "Emergency admin access is undocumented or unmanaged.",
    finding: "Break-glass access is weak or undocumented.",
    fix: "Define a monitored emergency access process with ownership and review.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "IAM-RBAC",
    category: "identity_access",
    field: "documentedRbac",
    weight: 2,
    trigger: "Role-based access rules are not documented.",
    finding: "RBAC rules are not clearly documented.",
    fix: "Document standard roles and who is allowed into each one.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "IAM-SERVICE-ACCOUNTS",
    category: "identity_access",
    field: "serviceAccountHygiene",
    weight: 3,
    trigger: "Service accounts are not reviewed, rotated, or scoped tightly.",
    finding: "Service account hygiene is weak.",
    fix: "Review non-human identities, rotate secrets, and remove broad access.",
    severity: "high",
    coreControl: true,
  }),

  createYesPartialNoRule({
    ruleId: "ORG-HIERARCHY",
    category: "org_structure",
    field: "usesOrgHierarchy",
    weight: 3,
    trigger: "No clear organization or tenancy hierarchy exists.",
    finding: "Tenant and account structure is ad hoc.",
    fix: "Use org-level hierarchy to group workloads and apply policy cleanly.",
    severity: "high",
  }),
  createYesPartialNoRule({
    ruleId: "ORG-ENV-ACCOUNTS",
    category: "org_structure",
    field: "separateCloudAccounts",
    weight: 3,
    trigger: "Environments share accounts, subscriptions, or projects.",
    finding: "Environments are not separated by account or project cleanly.",
    fix: "Split dev, test, and prod into distinct accounts, subscriptions, or projects.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "ORG-SHARED-SERVICES",
    category: "org_structure",
    field: "sharedServicesModel",
    weight: 2,
    trigger: "Shared services are unmanaged or improvised.",
    finding: "Shared services do not have a clear operating model.",
    fix: "Define what lives in shared services and who owns it.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "ORG-GUARDRAILS",
    category: "org_structure",
    field: "guardrailsPolicy",
    weight: 2,
    trigger: "Policy inheritance or guardrails are missing.",
    finding: "Guardrails are missing or inconsistent.",
    fix: "Apply baseline policies at the org or management-group level.",
    severity: "medium",
  }),

  createYesPartialNoRule({
    ruleId: "NET-ARCH",
    category: "network_foundation",
    field: "standardNetworkArchitecture",
    weight: 3,
    trigger: "Network topology is flat or improvised.",
    finding: "Network foundation is not standardized.",
    fix: "Adopt a repeatable network pattern such as hub-and-spoke.",
    severity: "high",
  }),
  createYesPartialNoRule({
    ruleId: "NET-PROD-ISOLATION",
    category: "network_foundation",
    field: "productionIsolation",
    weight: 3,
    trigger: "Production traffic and non-prod traffic are not well isolated.",
    finding: "Prod and non-prod are not isolated well enough.",
    fix: "Separate production networking and restrict cross-environment access.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "NET-INGRESS-EGRESS",
    category: "network_foundation",
    field: "ingressEgressControls",
    weight: 3,
    trigger: "Ingress or egress controls are weak or missing.",
    finding: "Ingress and egress controls are weak.",
    fix: "Define allowed entry and exit paths instead of broad open access.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "NET-PRIVATE-CONNECTIVITY",
    category: "network_foundation",
    field: "privateConnectivity",
    weight: 2,
    trigger: "Private connectivity is missing where workloads need it.",
    finding: "Private connectivity is missing where it should exist.",
    fix: "Use private paths for sensitive or internal service communication.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "NET-DNS",
    category: "network_foundation",
    field: "documentedDnsStrategy",
    weight: 2,
    trigger: "DNS ownership or naming patterns are undocumented.",
    finding: "DNS strategy is undocumented.",
    fix: "Document public and private DNS ownership, naming, and change paths.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "NET-CLEANUP",
    category: "network_foundation",
    field: "networkCleanup",
    weight: 2,
    trigger: "Unused network objects are left in place.",
    finding: "Unused network constructs are not cleaned up reliably.",
    fix: "Remove stale peering, routes, security groups, and test network objects.",
    severity: "low",
  }),

  createYesPartialNoRule({
    ruleId: "SEC-SECRETS",
    category: "security_baseline",
    field: "secretsManagement",
    weight: 3,
    trigger: "Secrets are stored in weak or inconsistent places.",
    finding: "Secrets management is weak.",
    fix: "Move secrets into managed secret storage with rotation and access control.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "SEC-KEYS",
    category: "security_baseline",
    field: "keyManagement",
    weight: 2,
    trigger: "Key management is missing or inconsistent.",
    finding: "Key management is not well defined.",
    fix: "Use managed keys with clear ownership, rotation, and usage rules.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "SEC-BASELINE-LOGGING",
    category: "security_baseline",
    field: "baselineSecurityLogging",
    weight: 2,
    trigger: "Security-relevant baseline logging is missing.",
    finding: "Baseline security logging is incomplete.",
    fix: "Turn on audit, identity, and control-plane logs everywhere important.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "SEC-VULN-SCAN",
    category: "security_baseline",
    field: "vulnerabilityScanning",
    weight: 3,
    trigger: "Vulnerability scanning is not in place consistently.",
    finding: "Vulnerability scanning is missing or inconsistent.",
    fix: "Scan hosts, images, and dependencies on a regular schedule.",
    severity: "high",
  }),
  createYesPartialNoRule({
    ruleId: "SEC-PRIVILEGE-REVIEWS",
    category: "security_baseline",
    field: "privilegeReviews",
    weight: 3,
    trigger: "Least-privilege reviews are not happening.",
    finding: "Least-privilege reviews are missing.",
    fix: "Review privileged roles regularly and remove stale access.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "SEC-PATCHING",
    category: "security_baseline",
    field: "patchingOwnership",
    weight: 2,
    trigger: "Patching ownership is unclear.",
    finding: "Patching ownership is unclear or inconsistent.",
    fix: "Assign patch ownership and define patch timing by workload risk.",
    severity: "medium",
  }),

  createYesPartialNoRule({
    ruleId: "OBS-CENTRAL-LOGS",
    category: "logging_monitoring",
    field: "centralizedLogs",
    weight: 4,
    trigger: "Logs are fragmented or not centralized.",
    finding: "Logs are not centralized.",
    fix: "Route key logs into one searchable place with retention rules.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "OBS-DASHBOARDS",
    category: "logging_monitoring",
    field: "metricsDashboards",
    weight: 2,
    trigger: "Useful metrics dashboards are missing.",
    finding: "Metrics dashboards are thin or missing.",
    fix: "Create service dashboards for latency, errors, saturation, and uptime.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "OBS-ALERTING",
    category: "logging_monitoring",
    field: "alertingCoverage",
    weight: 4,
    trigger: "Alerting is missing or not tuned to real risk.",
    finding: "Alerting coverage is weak.",
    fix: "Alert on the conditions that actually threaten production service.",
    severity: "high",
    coreControl: true,
  }),

  createYesPartialNoRule({
    ruleId: "DR-BACKUPS",
    category: "backup_dr",
    field: "backupCoverage",
    weight: 3,
    trigger: "Backups do not cover critical systems.",
    finding: "Backup coverage is incomplete.",
    fix: "Make sure critical data stores and configs are included in backup scope.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "DR-RESTORE-TESTS",
    category: "backup_dr",
    field: "restoreTesting",
    weight: 3,
    trigger: "Restore testing is not being performed.",
    finding: "Backups exist but restore tests are missing.",
    fix: "Run restore tests on a schedule and record the results.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "DR-RTO-RPO",
    category: "backup_dr",
    field: "definedRecoveryTargets",
    weight: 2,
    trigger: "Recovery targets are undefined.",
    finding: "RTO and RPO targets are undefined or unclear.",
    fix: "Set recovery targets by workload and tie them to backup design.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "DR-RESILIENCE",
    category: "backup_dr",
    field: "crossRegionResilience",
    weight: 1,
    trigger: "Cross-region resilience is missing where it is needed.",
    finding: "Cross-region resilience is missing where it matters.",
    fix: "Use multi-region or equivalent resilience for workloads that need it.",
    severity: "low",
  }),
  createYesPartialNoRule({
    ruleId: "DR-DOCS",
    category: "backup_dr",
    field: "drDocumentation",
    weight: 1,
    trigger: "DR documentation is missing or stale.",
    finding: "DR documentation is missing or stale.",
    fix: "Write down failover, restore, and decision steps before an incident happens.",
    severity: "low",
  }),

  createYesPartialNoRule({
    ruleId: "IAC-DEFINED",
    category: "iac_delivery",
    field: "infrastructureAsCode",
    weight: 3,
    trigger: "Infrastructure is not managed through code consistently.",
    finding: "Infrastructure as code is missing or inconsistent.",
    fix: "Manage cloud resources through reviewed code instead of ad hoc console work.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "IAC-CICD",
    category: "iac_delivery",
    field: "changesViaCiCd",
    weight: 2,
    trigger: "Infrastructure changes bypass CI/CD.",
    finding: "Infrastructure changes bypass CI/CD.",
    fix: "Push infrastructure changes through one pipeline with approvals.",
    severity: "high",
    coreControl: true,
  }),
  {
    ruleId: "IAC-MANUAL-PROD",
    category: "iac_delivery",
    trigger: "Manual production changes are allowed outside normal controls.",
    finding: "Manual production changes are allowed.",
    fix: "Block direct production changes except tightly controlled emergencies.",
    severity: "high",
    coreControl: true,
    evaluate(answers: LandingZoneReadinessAnswers) {
      if (answers.manualProductionChanges === "blocked") {
        return 0;
      }

      if (answers.manualProductionChanges === "emergency_only") {
        return 1;
      }

      return 2;
    },
  },
  createYesPartialNoRule({
    ruleId: "IAC-CODE-REVIEW",
    category: "iac_delivery",
    field: "codeReviewRequired",
    weight: 2,
    trigger: "Infrastructure changes do not require code review.",
    finding: "Infrastructure changes bypass code review.",
    fix: "Require review before infrastructure changes can merge or deploy.",
    severity: "high",
    coreControl: true,
  }),
  createYesPartialNoRule({
    ruleId: "IAC-DRIFT",
    category: "iac_delivery",
    field: "driftDetection",
    weight: 1,
    trigger: "Drift detection is missing.",
    finding: "Drift detection is missing.",
    fix: "Check for drift so live changes do not silently diverge from code.",
    severity: "low",
  }),

  createYesPartialNoRule({
    ruleId: "COST-TAGGING",
    category: "cost_governance",
    field: "taggingStandard",
    weight: 2,
    trigger: "Tagging or labeling is inconsistent.",
    finding: "Tagging standards are weak or missing.",
    fix: "Set a small required tag set for owner, environment, and cost center.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "COST-BUDGETS",
    category: "cost_governance",
    field: "budgetAlerts",
    weight: 2,
    trigger: "Budgets and alerts are missing.",
    finding: "Budget alerts are missing or incomplete.",
    fix: "Set budget alerts on accounts, subscriptions, and major services.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "COST-OWNERSHIP",
    category: "cost_governance",
    field: "resourceOwnership",
    weight: 1,
    trigger: "Resource ownership is unclear.",
    finding: "Resource ownership is unclear.",
    fix: "Assign an owner to each workload and high-cost resource group.",
    severity: "low",
  }),
  createYesPartialNoRule({
    ruleId: "COST-CLEANUP",
    category: "cost_governance",
    field: "lifecycleCleanup",
    weight: 1,
    trigger: "Cleanup of stale resources is inconsistent.",
    finding: "Lifecycle cleanup is weak.",
    fix: "Clean up stale snapshots, disks, IPs, and test resources on a schedule.",
    severity: "low",
  }),
  createYesPartialNoRule({
    ruleId: "COST-NONPROD-SHUTDOWN",
    category: "cost_governance",
    field: "nonProdShutdown",
    weight: 1,
    trigger: "Non-prod shutdown controls are missing.",
    finding: "Non-prod shutdown controls are missing.",
    fix: "Shut down idle non-prod resources outside working hours where appropriate.",
    severity: "low",
  }),

  createYesPartialNoRule({
    ruleId: "ENV-SEPARATION",
    category: "environment_separation",
    field: "clearEnvironmentSeparation",
    weight: 3,
    trigger: "Environment boundaries are unclear.",
    finding: "Environment boundaries are unclear.",
    fix: "Make dev, test, and prod separation obvious in access, resources, and naming.",
    severity: "high",
    coreControl: true,
  }),
  {
    ruleId: "ENV-LIFECYCLE-COVERAGE",
    category: "environment_separation",
    trigger: "Too few lifecycle environments exist for safe change control.",
    finding: "There are not enough lifecycle environments.",
    fix: "Maintain at least separate non-prod and prod, with stage/test when possible.",
    severity: "medium",
    evaluate(answers: LandingZoneReadinessAnswers) {
      if (answers.numberOfEnvironments === "1") {
        return 2;
      }

      if (answers.numberOfEnvironments === "2") {
        return 1;
      }

      return 0;
    },
  },

  createYesPartialNoRule({
    ruleId: "OPS-RUNBOOKS",
    category: "operations_readiness",
    field: "runbooks",
    weight: 1,
    trigger: "Operational runbooks are missing.",
    finding: "Runbooks are missing or incomplete.",
    fix: "Write simple runbooks for outages, access problems, and routine recovery work.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "OPS-ONCALL",
    category: "operations_readiness",
    field: "onCallOwnership",
    weight: 1,
    trigger: "Service ownership or on-call responsibilities are unclear.",
    finding: "On-call ownership is unclear.",
    fix: "Assign clear service owners and on-call responsibility.",
    severity: "medium",
  }),
  createYesPartialNoRule({
    ruleId: "OPS-INCIDENT",
    category: "operations_readiness",
    field: "incidentResponseProcess",
    weight: 1,
    trigger: "Incident response process is missing.",
    finding: "Incident response is informal or missing.",
    fix: "Define how incidents are declared, managed, and reviewed afterward.",
    severity: "medium",
  }),
];

export function evaluateLandingZoneRules(answers: LandingZoneReadinessAnswers): EvaluatedRule[] {
  return LANDING_ZONE_RULES.map((rule) => {
    const pointsDeducted = rule.evaluate(answers);

    return {
      ruleId: rule.ruleId,
      category: rule.category,
      trigger: rule.trigger,
      pointsDeducted,
      finding: rule.finding,
      fix: rule.fix,
      severity: rule.severity,
      coreControl: rule.coreControl ?? false,
    };
  }).filter((rule) => rule.pointsDeducted > 0);
}
