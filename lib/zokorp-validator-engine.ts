export const VALIDATION_PROFILES = ["FTR", "SDP_SRP", "COMPETENCY"] as const;

export type ValidationProfile = (typeof VALIDATION_PROFILES)[number];
export type ValidationCheckStatus = "PASS" | "PARTIAL" | "MISSING";

type CheckDefinition = {
  id: string;
  title: string;
  description: string;
  guidance: string;
  keywords: string[];
  passHits?: number;
};

type ProfileDefinition = {
  label: string;
  overview: string;
  checks: CheckDefinition[];
};

const PROFILE_DEFINITIONS: Record<ValidationProfile, ProfileDefinition> = {
  FTR: {
    label: "FTR",
    overview: "Foundational technical readiness review for scope, controls, and execution evidence.",
    checks: [
      {
        id: "scope",
        title: "Scope and objectives are defined",
        description: "Document should clearly state purpose, scope boundaries, and expected outcomes.",
        guidance: "Add an executive summary with objective, in-scope systems, and out-of-scope exclusions.",
        keywords: ["scope", "objective", "outcome", "in-scope", "out-of-scope"],
      },
      {
        id: "architecture",
        title: "Architecture context is documented",
        description: "Core architecture components and integration flow should be described.",
        guidance: "Include architecture diagrams and component interactions with dependencies.",
        keywords: ["architecture", "diagram", "component", "integration", "workflow"],
      },
      {
        id: "security",
        title: "Security controls are referenced",
        description: "Security baseline should include IAM, encryption, logging, and access boundaries.",
        guidance: "Document least-privilege IAM, data protection controls, and audit logging.",
        keywords: ["security", "iam", "least privilege", "encryption", "logging", "access control"],
      },
      {
        id: "testing",
        title: "Testing evidence is present",
        description: "Testing plan/results should show validation coverage and outcomes.",
        guidance: "Add explicit test cases, pass/fail criteria, and evidence of execution.",
        keywords: ["test plan", "test result", "validation", "acceptance criteria", "qa"],
      },
      {
        id: "risks",
        title: "Risks and mitigations are tracked",
        description: "Known risks should include severity and mitigation actions.",
        guidance: "Include a risk register with ownership, severity, and mitigation status.",
        keywords: ["risk", "mitigation", "issue", "blocker", "dependency"],
      },
      {
        id: "approval",
        title: "Review/approval trail exists",
        description: "Reviewers, dates, and approvals should be discoverable.",
        guidance: "Add sign-off section with reviewer names, date, and approval status.",
        keywords: ["approved", "sign-off", "reviewed by", "owner", "approval"],
      },
    ],
  },
  SDP_SRP: {
    label: "SDP/SRP",
    overview: "Service delivery and readiness review for repeatable operations and customer execution.",
    checks: [
      {
        id: "service-description",
        title: "Service/process description exists",
        description: "Delivery process should describe phases, responsibilities, and sequence.",
        guidance: "Document service flow from intake to completion with clear responsibilities.",
        keywords: ["service", "process", "delivery", "phase", "responsibility"],
      },
      {
        id: "requirements",
        title: "Requirements mapping is explicit",
        description: "Requirements should map to implementation or control evidence.",
        guidance: "Create a requirements-to-evidence mapping table with references.",
        keywords: ["requirement", "mapping", "control", "evidence", "traceability"],
      },
      {
        id: "sla",
        title: "Service levels and escalation paths are defined",
        description: "SLA, response targets, and escalation contacts should be captured.",
        guidance: "Add SLA metrics and escalation matrix including contacts and timelines.",
        keywords: ["sla", "response time", "resolution", "escalation", "support"],
      },
      {
        id: "operations",
        title: "Operations and monitoring coverage is present",
        description: "Monitoring and runbook procedures should be evident.",
        guidance: "Add monitoring scope, alert thresholds, and runbook references.",
        keywords: ["monitoring", "alert", "runbook", "operations", "incident"],
      },
      {
        id: "change-management",
        title: "Change management controls are included",
        description: "Change approvals and release process should be defined.",
        guidance: "Document release approvals, rollback procedure, and deployment controls.",
        keywords: ["change", "release", "approval", "rollback", "version"],
      },
      {
        id: "customer-outcomes",
        title: "Customer outcome/evidence statements exist",
        description: "Business outcomes or customer impact should be measurable.",
        guidance: "Add measurable outcomes and success metrics tied to customer goals.",
        keywords: ["customer", "outcome", "value", "kpi", "success metric"],
      },
    ],
  },
  COMPETENCY: {
    label: "Competency",
    overview: "Competency-level evidence review for case studies, capabilities, and operational maturity.",
    checks: [
      {
        id: "case-studies",
        title: "Case studies and customer references are present",
        description: "Evidence should include customer use cases and outcomes.",
        guidance: "Include anonymized case studies with before/after outcomes and customer profile.",
        keywords: ["case study", "customer", "reference", "use case", "engagement"],
      },
      {
        id: "capabilities",
        title: "Technical capabilities are articulated",
        description: "Capabilities should demonstrate depth in architecture and implementation.",
        guidance: "Add capability matrix showing architecture, build, and operational strengths.",
        keywords: ["capability", "expertise", "architecture", "implementation", "specialization"],
      },
      {
        id: "staffing",
        title: "Staffing and certification evidence exists",
        description: "Team qualifications and certifications should be documented.",
        guidance: "List team roles, credentials, and relevant certifications with validity window.",
        keywords: ["certification", "staff", "team", "engineer", "credential"],
      },
      {
        id: "security-compliance",
        title: "Security/compliance posture is addressed",
        description: "Security and governance posture should include control ownership.",
        guidance: "Provide compliance scope, policy references, and control ownership details.",
        keywords: ["compliance", "governance", "security", "policy", "control"],
      },
      {
        id: "operations",
        title: "Operational maturity and support model is described",
        description: "Operations, support, and lifecycle management should be clear.",
        guidance: "Add support model, operational cadence, and lifecycle ownership.",
        keywords: ["support", "operations", "lifecycle", "maintenance", "incident"],
      },
      {
        id: "continuity",
        title: "Continuity and resiliency planning is included",
        description: "Resiliency, backup, and recovery approach should be documented.",
        guidance: "Include backup cadence, DR/RTO targets, and resiliency test evidence.",
        keywords: ["backup", "disaster recovery", "resiliency", "rto", "rpo", "continuity"],
      },
    ],
  },
};

type ReportContext = {
  sourceType: "pdf" | "spreadsheet";
  filename: string;
  pages?: number;
  sheets?: number;
  additionalContext?: string;
};

export type ValidationReport = {
  profile: ValidationProfile;
  profileLabel: string;
  overview: string;
  score: number;
  counts: Record<ValidationCheckStatus, number>;
  summary: string;
  topGaps: string[];
  documentMetrics: {
    sourceType: "pdf" | "spreadsheet";
    filename: string;
    pages?: number;
    sheets?: number;
    wordCount: number;
    characterCount: number;
  };
  checks: Array<{
    id: string;
    title: string;
    description: string;
    status: ValidationCheckStatus;
    hitKeywords: string[];
    evidence: string | null;
    guidance: string;
  }>;
};

function findKeywordHits(normalizedText: string, keywords: string[]) {
  return keywords.filter((keyword) => normalizedText.includes(keyword.toLowerCase()));
}

function summarizeSnippet(rawText: string, keyword: string) {
  const lower = rawText.toLowerCase();
  const index = lower.indexOf(keyword.toLowerCase());
  if (index < 0) {
    return null;
  }

  const start = Math.max(0, index - 90);
  const end = Math.min(rawText.length, index + 210);
  const snippet = rawText.slice(start, end).replace(/\s+/g, " ").trim();
  if (!snippet) {
    return null;
  }

  const prefix = start > 0 ? "..." : "";
  const suffix = end < rawText.length ? "..." : "";
  return `${prefix}${snippet}${suffix}`;
}

function summarizeScore(score: number, profileLabel: string) {
  if (score >= 85) {
    return `${profileLabel} validation indicates strong evidence coverage.`;
  }

  if (score >= 60) {
    return `${profileLabel} validation indicates moderate readiness with targeted gaps.`;
  }

  return `${profileLabel} validation indicates low evidence coverage; major gaps should be addressed before submission.`;
}

export function buildValidationReport(input: {
  profile: ValidationProfile;
  rawText: string;
  context: ReportContext;
}) {
  const profileDefinition = PROFILE_DEFINITIONS[input.profile];
  const normalizedText = input.rawText.toLowerCase();
  const wordCount = input.rawText.trim() ? input.rawText.trim().split(/\s+/).length : 0;

  const checks = profileDefinition.checks.map((check) => {
    const hitKeywords = findKeywordHits(normalizedText, check.keywords);
    const passThreshold = check.passHits ?? 2;

    const status: ValidationCheckStatus =
      hitKeywords.length >= passThreshold ? "PASS" : hitKeywords.length >= 1 ? "PARTIAL" : "MISSING";

    const evidence = hitKeywords.length > 0 ? summarizeSnippet(input.rawText, hitKeywords[0]) : null;

    return {
      id: check.id,
      title: check.title,
      description: check.description,
      status,
      hitKeywords,
      evidence,
      guidance: check.guidance,
    };
  });

  const counts = checks.reduce<Record<ValidationCheckStatus, number>>(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { PASS: 0, PARTIAL: 0, MISSING: 0 },
  );

  const points =
    counts.PASS * 1 +
    counts.PARTIAL * 0.5;

  const score = Math.round((points / checks.length) * 100);

  const topGaps = checks
    .filter((check) => check.status !== "PASS")
    .slice(0, 3)
    .map((check) => `${check.title}: ${check.guidance}`);

  if (input.context.additionalContext?.trim()) {
    topGaps.push(`Context note reviewed: ${input.context.additionalContext.trim().slice(0, 180)}`);
  }

  const report: ValidationReport = {
    profile: input.profile,
    profileLabel: profileDefinition.label,
    overview: profileDefinition.overview,
    score,
    counts,
    summary: summarizeScore(score, profileDefinition.label),
    topGaps,
    documentMetrics: {
      sourceType: input.context.sourceType,
      filename: input.context.filename,
      pages: input.context.pages,
      sheets: input.context.sheets,
      wordCount,
      characterCount: input.rawText.length,
    },
    checks,
  };

  return report;
}

function statusToken(status: ValidationCheckStatus) {
  if (status === "PASS") {
    return "[PASS]";
  }

  if (status === "PARTIAL") {
    return "[PARTIAL]";
  }

  return "[MISSING]";
}

export function formatValidationReport(report: ValidationReport) {
  const lines: string[] = [];
  lines.push(`ZoKorpValidator Report (${report.profileLabel})`);
  lines.push(`Score: ${report.score}%`);
  lines.push(
    `Checks: ${report.counts.PASS} pass, ${report.counts.PARTIAL} partial, ${report.counts.MISSING} missing`,
  );
  lines.push(`Summary: ${report.summary}`);
  lines.push("");
  lines.push("Checklist results:");

  for (const check of report.checks) {
    const keywords = check.hitKeywords.length ? check.hitKeywords.join(", ") : "none";
    lines.push(`${statusToken(check.status)} ${check.title}`);
    lines.push(`  Matched keywords: ${keywords}`);
    if (check.evidence) {
      lines.push(`  Evidence: ${check.evidence}`);
    }
  }

  if (report.topGaps.length > 0) {
    lines.push("");
    lines.push("Priority improvements:");
    for (const gap of report.topGaps) {
      lines.push(`- ${gap}`);
    }
  }

  return lines.join("\n");
}
