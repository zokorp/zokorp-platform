import { FTR_LAUNCH_V1_RULES, type FtrEstimatePolicyBand } from "@/lib/validator-ftr-launch-v1-catalog";
import type {
  ValidationCheckStatus,
  ValidationProfile,
  ValidationReport,
  ValidationRuleSeverity,
} from "@/lib/zokorp-validator-engine";

export type ValidatorEstimateLineItem = {
  catalogKey: string;
  ruleId: string;
  title: string;
  status: Exclude<ValidationCheckStatus, "PASS">;
  severity: ValidationRuleSeverity | "PACKAGE";
  serviceLineLabel: string;
  publicFixSummary: string;
  amountUsd: number;
  estimatedHours: number;
  source: "catalog" | "package";
};

export type ValidatorEstimate = {
  quoteUsd: number;
  estimatedHoursTotal: number;
  slaLabel: string;
  summary: string;
  nextStep: string;
  lineItems: ValidatorEstimateLineItem[];
};

type PricingBand = "critical" | "important" | "advisory" | "hygiene";

type ValidatorEstimateCatalogEntry = {
  catalogKey: string;
  profile: ValidationProfile;
  ruleId: string;
  title: string;
  severity: ValidationRuleSeverity;
  pricingBand: PricingBand;
  serviceLineLabel: string;
  publicFixSummary: string;
  estimatePolicyBand?: FtrEstimatePolicyBand;
  remediationHoursLow?: number;
  remediationHoursHigh?: number;
};

type RateCard = {
  missingUsd: number;
  partialUsd: number;
  missingHours: number;
  partialHours: number;
};

const PROFILE_RATE_CARDS: Record<ValidationProfile, Record<PricingBand, RateCard>> = {
  FTR: {
    critical: { missingUsd: 175, partialUsd: 100, missingHours: 2, partialHours: 1 },
    important: { missingUsd: 125, partialUsd: 75, missingHours: 1.5, partialHours: 1 },
    advisory: { missingUsd: 75, partialUsd: 50, missingHours: 1, partialHours: 0.5 },
    hygiene: { missingUsd: 100, partialUsd: 50, missingHours: 1, partialHours: 0.5 },
  },
  SDP: {
    critical: { missingUsd: 275, partialUsd: 150, missingHours: 3, partialHours: 1.5 },
    important: { missingUsd: 200, partialUsd: 125, missingHours: 2, partialHours: 1 },
    advisory: { missingUsd: 125, partialUsd: 75, missingHours: 1.5, partialHours: 0.75 },
    hygiene: { missingUsd: 150, partialUsd: 75, missingHours: 1.5, partialHours: 0.75 },
  },
  SRP: {
    critical: { missingUsd: 275, partialUsd: 150, missingHours: 3, partialHours: 1.5 },
    important: { missingUsd: 200, partialUsd: 125, missingHours: 2, partialHours: 1 },
    advisory: { missingUsd: 125, partialUsd: 75, missingHours: 1.5, partialHours: 0.75 },
    hygiene: { missingUsd: 150, partialUsd: 75, missingHours: 1.5, partialHours: 0.75 },
  },
  COMPETENCY: {
    critical: { missingUsd: 550, partialUsd: 300, missingHours: 6, partialHours: 3 },
    important: { missingUsd: 350, partialUsd: 200, missingHours: 4, partialHours: 2 },
    advisory: { missingUsd: 200, partialUsd: 100, missingHours: 2, partialHours: 1 },
    hygiene: { missingUsd: 250, partialUsd: 125, missingHours: 2.5, partialHours: 1 },
  },
};

const PROFILE_CONTROL_ROW_REVIEW = {
  FTR: { minUsd: 75, perControlUsd: 35, maxUsd: 350, minHours: 1, perControlHours: 0.25, maxHours: 3 },
  SDP: { minUsd: 125, perControlUsd: 45, maxUsd: 500, minHours: 1.5, perControlHours: 0.25, maxHours: 4 },
  SRP: { minUsd: 125, perControlUsd: 45, maxUsd: 500, minHours: 1.5, perControlHours: 0.25, maxHours: 4 },
  COMPETENCY: { minUsd: 150, perControlUsd: 60, maxUsd: 650, minHours: 2, perControlHours: 0.5, maxHours: 5 },
} as const;

const PROFILE_POLISH_FLOOR = {
  FTR: { quoteUsd: 250, hours: 2 },
  SDP: { quoteUsd: 400, hours: 3 },
  SRP: { quoteUsd: 400, hours: 3 },
  COMPETENCY: { quoteUsd: 800, hours: 5 },
} as const;

function buildCatalogKey(profile: ValidationProfile, ruleId: string) {
  return `${profile}::${ruleId}`;
}

function createCatalogEntry(input: {
  profile: ValidationProfile;
  ruleId: string;
  title: string;
  severity: ValidationRuleSeverity;
  pricingBand: PricingBand;
  serviceLineLabel: string;
  publicFixSummary: string;
  estimatePolicyBand?: FtrEstimatePolicyBand;
  remediationHoursLow?: number;
  remediationHoursHigh?: number;
}) {
  return {
    ...input,
    catalogKey: buildCatalogKey(input.profile, input.ruleId),
  } satisfies ValidatorEstimateCatalogEntry;
}

function ftrPricingBandForRule(rule: (typeof FTR_LAUNCH_V1_RULES)[number]): PricingBand {
  if (rule.estimate_policy_band === "consultation_only") {
    return "critical";
  }

  if (rule.launch_priority === "critical") {
    return "critical";
  }

  if (rule.launch_priority === "high") {
    return "important";
  }

  return "advisory";
}

const SDP_SRP_SHARED_RULES = [
  {
    ruleId: "service-description",
    title: "Service/process description exists",
    severity: "CRITICAL" as const,
    pricingBand: "critical" as const,
    serviceLineLabel: "Delivery workflow narrative cleanup",
    publicFixSummary: "Write the service flow clearly from intake through delivery so reviewers can follow the operating model.",
  },
  {
    ruleId: "requirements",
    title: "Requirements mapping is explicit",
    severity: "CRITICAL" as const,
    pricingBand: "critical" as const,
    serviceLineLabel: "Requirements-to-evidence mapping",
    publicFixSummary: "Build a requirement-by-requirement evidence map instead of leaving the reviewer to infer traceability.",
  },
  {
    ruleId: "sla",
    title: "Service levels and escalation paths are defined",
    severity: "CRITICAL" as const,
    pricingBand: "critical" as const,
    serviceLineLabel: "SLA and escalation matrix cleanup",
    publicFixSummary: "Add response targets, severity definitions, and named escalation paths that the reviewer can verify quickly.",
  },
  {
    ruleId: "operations",
    title: "Operations and monitoring coverage is present",
    severity: "IMPORTANT" as const,
    pricingBand: "important" as const,
    serviceLineLabel: "Operations evidence hardening",
    publicFixSummary: "Show monitoring scope, alerting, and runbook ownership instead of vague operations language.",
  },
  {
    ruleId: "change-management",
    title: "Change management controls are included",
    severity: "IMPORTANT" as const,
    pricingBand: "important" as const,
    serviceLineLabel: "Change-control narrative cleanup",
    publicFixSummary: "Document release approvals, rollback expectations, and deployment control ownership in reviewer-facing language.",
  },
  {
    ruleId: "customer-outcomes",
    title: "Customer outcome/evidence statements exist",
    severity: "IMPORTANT" as const,
    pricingBand: "important" as const,
    serviceLineLabel: "Outcome metrics evidence pass",
    publicFixSummary: "Tie the submission to measurable customer outcomes instead of unsupported value statements.",
  },
] as const;

export const VALIDATOR_ESTIMATE_CATALOG: ValidatorEstimateCatalogEntry[] = [
  ...FTR_LAUNCH_V1_RULES.map((rule) =>
    createCatalogEntry({
      profile: "FTR",
      ruleId: rule.id,
      title: rule.control_name,
      severity:
        rule.launch_priority === "critical"
          ? "CRITICAL"
          : rule.launch_priority === "high"
            ? "IMPORTANT"
            : "ADVISORY",
      pricingBand: ftrPricingBandForRule(rule),
      serviceLineLabel: rule.estimate_line_item_label,
      publicFixSummary: rule.remediation_summary,
      estimatePolicyBand: rule.estimate_policy_band,
      remediationHoursLow: rule.remediation_hours_low,
      remediationHoursHigh: rule.remediation_hours_high,
    }),
  ),
  ...(["SDP", "SRP"] as const).flatMap((profile) =>
    SDP_SRP_SHARED_RULES.map((entry) =>
      createCatalogEntry({
        profile,
        ...entry,
      }),
    ),
  ),
  createCatalogEntry({
    profile: "COMPETENCY",
    ruleId: "case-studies",
    title: "Case studies and customer references are present",
    severity: "CRITICAL",
    pricingBand: "critical",
    serviceLineLabel: "Case-study evidence rebuild",
    publicFixSummary: "Turn weak customer examples into concrete case-study evidence with measurable outcomes and technical scope.",
  }),
  createCatalogEntry({
    profile: "COMPETENCY",
    ruleId: "capabilities",
    title: "Technical capabilities are articulated",
    severity: "CRITICAL",
    pricingBand: "critical",
    serviceLineLabel: "Capability matrix rewrite",
    publicFixSummary: "Translate broad capability claims into a reviewer-ready matrix of architecture, delivery, and operating strengths.",
  }),
  createCatalogEntry({
    profile: "COMPETENCY",
    ruleId: "staffing",
    title: "Staffing and certification evidence exists",
    severity: "IMPORTANT",
    pricingBand: "important",
    serviceLineLabel: "Staffing and certification evidence pass",
    publicFixSummary: "Show roles, certification coverage, and validity clearly enough that the reviewer can verify team depth.",
  }),
  createCatalogEntry({
    profile: "COMPETENCY",
    ruleId: "security-compliance",
    title: "Security/compliance posture is addressed",
    severity: "CRITICAL",
    pricingBand: "critical",
    serviceLineLabel: "Security and compliance ownership mapping",
    publicFixSummary: "Tie policy statements to scope, control ownership, and evidence instead of leaving compliance claims unsupported.",
  }),
  createCatalogEntry({
    profile: "COMPETENCY",
    ruleId: "operations",
    title: "Operational maturity and support model is described",
    severity: "IMPORTANT",
    pricingBand: "important",
    serviceLineLabel: "Operational maturity evidence hardening",
    publicFixSummary: "Show the support model, lifecycle ownership, and service cadence with specific operational detail.",
  }),
  createCatalogEntry({
    profile: "COMPETENCY",
    ruleId: "continuity",
    title: "Continuity and resiliency planning is included",
    severity: "IMPORTANT",
    pricingBand: "important",
    serviceLineLabel: "Continuity and resiliency evidence pass",
    publicFixSummary: "Document backup, recovery, and resiliency evidence instead of broad continuity statements.",
  }),
  ...(["FTR", "SDP", "SRP", "COMPETENCY"] as const).flatMap((profile) => [
    createCatalogEntry({
      profile,
      ruleId: "traceability-artifacts",
      title: "Traceability to evidence artifacts exists",
      severity: "ADVISORY",
      pricingBand: "advisory",
      serviceLineLabel: "Artifact cross-reference cleanup",
      publicFixSummary: "Add direct evidence references, appendix links, or artifact IDs so the reviewer can trace claims quickly.",
    }),
    createCatalogEntry({
      profile,
      ruleId: "document-revision-cadence",
      title: "Document revision and recency are visible",
      severity: "ADVISORY",
      pricingBand: "hygiene",
      serviceLineLabel: "Revision-history hygiene",
      publicFixSummary: "Add document versioning, dates, and ownership markers so the package reads as current and controlled.",
    }),
    createCatalogEntry({
      profile,
      ruleId: "target-alignment",
      title: "Evidence aligns with selected checklist",
      severity: "CRITICAL",
      pricingBand: "critical",
      serviceLineLabel: "Checklist target alignment rewrite",
      publicFixSummary: "Rewrite the package so it maps directly to the specific checklist target instead of drifting into generic language.",
    }),
    createCatalogEntry({
      profile,
      ruleId: "checklist-traceability",
      title: "Checklist traceability is explicit",
      severity: "IMPORTANT",
      pricingBand: "important",
      serviceLineLabel: "Checklist traceability matrix cleanup",
      publicFixSummary: "Build a control-by-control traceability view so the reviewer can see where each requirement is answered.",
    }),
  ]),
  createCatalogEntry({
    profile: "FTR",
    ruleId: "ftr-service-context",
    title: "AWS service context is explicit",
    severity: "IMPORTANT",
    pricingBand: "important",
    serviceLineLabel: "AWS workload scope clarification",
    publicFixSummary: "Name the exact AWS service/workload scope and the assumptions around it instead of leaving the reviewer to infer context.",
  }),
  createCatalogEntry({
    profile: "SDP",
    ruleId: "sdp-delivery-operating-model",
    title: "Delivery operating model is repeatable",
    severity: "IMPORTANT",
    pricingBand: "important",
    serviceLineLabel: "Delivery operating model hardening",
    publicFixSummary: "Show repeatable milestones, owners, and handoffs so the reviewer can see a stable service-delivery process.",
  }),
  createCatalogEntry({
    profile: "SRP",
    ruleId: "srp-software-readiness",
    title: "Software readiness controls are evidenced",
    severity: "IMPORTANT",
    pricingBand: "important",
    serviceLineLabel: "Software readiness evidence pass",
    publicFixSummary: "Document release, supportability, and upgrade expectations with reviewer-ready specificity.",
  }),
  createCatalogEntry({
    profile: "COMPETENCY",
    ruleId: "competency-evidence-depth",
    title: "Evidence depth supports competency claim",
    severity: "IMPORTANT",
    pricingBand: "important",
    serviceLineLabel: "Competency evidence-depth expansion",
    publicFixSummary: "Add quantified outcomes and concrete delivery evidence so the competency claim feels provable, not aspirational.",
  }),
];

const VALIDATOR_ESTIMATE_CATALOG_BY_KEY = new Map(
  VALIDATOR_ESTIMATE_CATALOG.map((entry) => [entry.catalogKey, entry]),
);

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function roundHours(value: number) {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

function severityRank(severity: ValidationRuleSeverity | "PACKAGE") {
  if (severity === "CRITICAL") {
    return 3;
  }

  if (severity === "IMPORTANT") {
    return 2;
  }

  if (severity === "ADVISORY" || severity === "PACKAGE") {
    return 1;
  }

  return 0;
}

function statusRank(status: Exclude<ValidationCheckStatus, "PASS">) {
  return status === "MISSING" ? 2 : 1;
}

function statusRateCard(profile: ValidationProfile, pricingBand: PricingBand, status: Exclude<ValidationCheckStatus, "PASS">) {
  const rateCard = PROFILE_RATE_CARDS[profile][pricingBand];

  return status === "MISSING"
    ? {
        amountUsd: rateCard.missingUsd,
        estimatedHours: rateCard.missingHours,
      }
    : {
        amountUsd: rateCard.partialUsd,
        estimatedHours: rateCard.partialHours,
      };
}

function fallbackCatalogEntry(
  profile: ValidationProfile,
  check: ValidationReport["checks"][number],
): ValidatorEstimateCatalogEntry {
  const pricingBand =
    check.severity === "CRITICAL" ? "critical" : check.severity === "IMPORTANT" ? "important" : "advisory";

  return createCatalogEntry({
    profile,
    ruleId: check.id,
    title: check.title,
    severity: check.severity,
    pricingBand,
    serviceLineLabel: check.title,
    publicFixSummary: check.guidance,
  });
}

function midpointHours(low?: number, high?: number) {
  if (typeof low !== "number" && typeof high !== "number") {
    return 1;
  }

  if (typeof low === "number" && typeof high === "number") {
    return roundHours((low + high) / 2);
  }

  return roundHours(low ?? high ?? 1);
}

function ftrLineItemHours(
  entry: ValidatorEstimateCatalogEntry,
  status: Exclude<ValidationCheckStatus, "PASS">,
) {
  if (status === "PARTIAL") {
    return roundHours(entry.remediationHoursLow ?? 1);
  }

  return midpointHours(entry.remediationHoursLow, entry.remediationHoursHigh);
}

function ftrLineItemAmount(hours: number) {
  return Math.max(100, roundToNearest(hours * 125, 25));
}

function ftrConsultationOnlySummary(report: ValidationReport) {
  return {
    quoteUsd: 0,
    estimatedHoursTotal: 0,
    slaLabel: "Consultation required",
    summary:
      "The package is not safely auto-scopeable. The current gaps point to missing core evidence, contradictions, or risky technical/security issues that should not be turned into a blind payable remediation quote.",
    nextStep:
      report.score < 60
        ? "Book a consultation and rebuild the submission pack before asking for remediation pricing."
        : "Resolve the consultation-only blockers first, then rerun ZoKorpValidator for a bounded remediation estimate.",
    lineItems: [] as ValidatorEstimateLineItem[],
  };
}

function ftrSummaryForScore(report: ValidationReport, lineItems: ValidatorEstimateLineItem[]) {
  if (report.score >= 90) {
    return {
      summary:
        "The package is strong. Any quote here is for polish, packaging consistency, and reviewer-facing cleanup rather than deeper FTR remediation.",
      nextStep:
        "Use the remaining suggestions to tighten presentation quality, then submit or rerun the validator after the last cleanup pass.",
    };
  }

  return {
    summary: `The package has documentation-bounded gaps across ${lineItems.length} scoped remediation area${lineItems.length === 1 ? "" : "s"}. This estimate assumes the architecture and factual evidence are fundamentally stable.`,
    nextStep:
      "Fix the listed evidence and wording gaps, then rerun the validator before submitting the package.",
  };
}

function buildFtrValidatorEstimate(report: ValidationReport): ValidatorEstimate {
  const actionableChecks = report.checks.filter((check) => check.status !== "PASS");
  const hasConsultationOnlyBlocker = actionableChecks.some((check) => {
    const entry = getValidatorEstimateCatalogEntry("FTR", check.id);
    return entry?.estimatePolicyBand === "consultation_only" && check.status === "MISSING";
  });

  if (hasConsultationOnlyBlocker || report.score < 60) {
    return ftrConsultationOnlySummary(report);
  }

  const lineItems: ValidatorEstimateLineItem[] = actionableChecks.map((check) => {
    const status = check.status as Exclude<ValidationCheckStatus, "PASS">;
    const catalogEntry = getValidatorEstimateCatalogEntry("FTR", check.id) ?? fallbackCatalogEntry("FTR", check);
    const estimatedHours = ftrLineItemHours(catalogEntry, status);

    return {
      catalogKey: catalogEntry.catalogKey,
      ruleId: check.id,
      title: catalogEntry.title,
      status,
      severity: catalogEntry.severity,
      serviceLineLabel: catalogEntry.serviceLineLabel,
      publicFixSummary: catalogEntry.publicFixSummary,
      amountUsd: ftrLineItemAmount(estimatedHours),
      estimatedHours,
      source: "catalog",
    };
  });

  const calibrationItem = controlCalibrationLineItem(report);
  if (calibrationItem) {
    lineItems.push(calibrationItem);
  }

  lineItems.sort((left, right) => {
    const statusDelta = statusRank(right.status) - statusRank(left.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return right.estimatedHours - left.estimatedHours;
  });

  let quoteUsd = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  let estimatedHoursTotal = roundHours(lineItems.reduce((sum, item) => sum + item.estimatedHours, 0));

  if (report.score >= 90) {
    const polishItem = polishGapLineItem("FTR", quoteUsd, estimatedHoursTotal);
    if (polishItem) {
      lineItems.push(polishItem);
      quoteUsd += polishItem.amountUsd;
      estimatedHoursTotal = roundHours(estimatedHoursTotal + polishItem.estimatedHours);
    }
  }

  const summary = ftrSummaryForScore(report, lineItems);

  return {
    quoteUsd,
    estimatedHoursTotal,
    slaLabel: slaLabelForHours(estimatedHoursTotal),
    summary: summary.summary,
    nextStep: summary.nextStep,
    lineItems,
  };
}

function polishGapLineItem(profile: ValidationProfile, currentUsd: number, currentHours: number) {
  const polishFloor = PROFILE_POLISH_FLOOR[profile];
  if (currentUsd >= polishFloor.quoteUsd) {
    return null;
  }

  return {
    catalogKey: buildCatalogKey(profile, "submission-polish"),
    ruleId: "submission-polish",
    title: "Submission polish pass",
    status: "PARTIAL" as const,
    severity: "PACKAGE" as const,
    serviceLineLabel: "Submission polish pass",
    publicFixSummary: "Final reviewer-facing cleanup pass for wording, traceability polish, and presentation quality before resubmission.",
    amountUsd: polishFloor.quoteUsd - currentUsd,
    estimatedHours: roundHours(Math.max(0.5, polishFloor.hours - currentHours)),
    source: "package" as const,
  };
}

function controlCalibrationLineItem(report: ValidationReport) {
  const failingControls = report.controlCalibration?.controls.filter((control) => control.status !== "PASS") ?? [];
  if (failingControls.length === 0) {
    return null;
  }

  const rate = PROFILE_CONTROL_ROW_REVIEW[report.profile];
  const amountUsd = Math.min(rate.maxUsd, Math.max(rate.minUsd, roundToNearest(failingControls.length * rate.perControlUsd, 25)));
  const estimatedHours = Math.min(rate.maxHours, roundHours(Math.max(rate.minHours, failingControls.length * rate.perControlHours)));

  return {
    catalogKey: buildCatalogKey(report.profile, "control-row-review"),
    ruleId: "control-row-review",
    title: "Control-row rewrite pass",
    status: "PARTIAL" as const,
    severity: "PACKAGE" as const,
    serviceLineLabel: "Control-row rewrite pass",
    publicFixSummary: `Rewrite or tighten ${failingControls.length} failing checklist row response${failingControls.length === 1 ? "" : "s"} so the package aligns with the worksheet guidance.`,
    amountUsd,
    estimatedHours,
    source: "package" as const,
  };
}

function slaLabelForHours(totalHours: number) {
  if (totalHours <= 4) {
    return "1-2 business days";
  }

  if (totalHours <= 10) {
    return "2-4 business days";
  }

  if (totalHours <= 20) {
    return "3-7 business days";
  }

  return "1-2 weeks";
}

function summaryForScore(report: ValidationReport, lineItems: ValidatorEstimateLineItem[]) {
  const materialIssues = lineItems.filter((item) => item.ruleId !== "submission-polish").length;

  if (report.score >= 90) {
    return {
      summary:
        "The package is close. This estimate is for polish, cleanup, and row-level reviewer readiness rather than a full rebuild.",
      nextStep:
        "Use the suggested edits first. If you want a fast submission-ready pass, the scope below is sized as a bounded polish engagement.",
    };
  }

  if (report.score >= 75) {
    return {
      summary: `The package has targeted gaps across ${materialIssues} reviewer-facing area${materialIssues === 1 ? "" : "s"}. This estimate assumes a focused remediation pass, not a program redesign.`,
      nextStep:
        "Fix the missing and partial items in priority order, then rerun the validator before submitting the package.",
    };
  }

  return {
    summary:
      "The package has material evidence gaps. This estimate assumes you want a scoped remediation cycle, but a broader consultation may be the better path if the underlying submission is still changing.",
    nextStep:
      "Rework the package before submission. If the checklist target, evidence set, or technical story is still unstable, move to consultation instead of a light remediation pass.",
  };
}

export function getValidatorEstimateCatalogEntry(profile: ValidationProfile, ruleId: string) {
  return VALIDATOR_ESTIMATE_CATALOG_BY_KEY.get(buildCatalogKey(profile, ruleId)) ?? null;
}

export function buildValidatorEstimate(report: ValidationReport): ValidatorEstimate {
  if (report.profile === "FTR") {
    return buildFtrValidatorEstimate(report);
  }

  const lineItems: ValidatorEstimateLineItem[] = report.checks
    .filter((check) => check.status !== "PASS")
    .map((check) => {
      const status = check.status as Exclude<ValidationCheckStatus, "PASS">;
      const catalogEntry = getValidatorEstimateCatalogEntry(report.profile, check.id) ?? fallbackCatalogEntry(report.profile, check);
      const derived = statusRateCard(report.profile, catalogEntry.pricingBand, status);

      return {
        catalogKey: catalogEntry.catalogKey,
        ruleId: check.id,
        title: catalogEntry.title,
        status,
        severity: catalogEntry.severity,
        serviceLineLabel: catalogEntry.serviceLineLabel,
        publicFixSummary: catalogEntry.publicFixSummary,
        amountUsd: derived.amountUsd,
        estimatedHours: roundHours(derived.estimatedHours),
        source: "catalog" as const,
      };
    });

  const calibrationItem = controlCalibrationLineItem(report);
  if (calibrationItem) {
    lineItems.push(calibrationItem);
  }

  lineItems.sort((left, right) => {
    const statusDelta = statusRank(right.status) - statusRank(left.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return right.amountUsd - left.amountUsd;
  });

  let quoteUsd = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  let estimatedHoursTotal = roundHours(lineItems.reduce((sum, item) => sum + item.estimatedHours, 0));

  if (report.score >= 90) {
    const polishItem = polishGapLineItem(report.profile, quoteUsd, estimatedHoursTotal);
    if (polishItem) {
      lineItems.push(polishItem);
      quoteUsd += polishItem.amountUsd;
      estimatedHoursTotal = roundHours(estimatedHoursTotal + polishItem.estimatedHours);
    }
  }

  const narrative = summaryForScore(report, lineItems);

  return {
    quoteUsd,
    estimatedHoursTotal,
    slaLabel: slaLabelForHours(estimatedHoursTotal),
    summary: narrative.summary,
    nextStep: narrative.nextStep,
    lineItems,
  };
}
