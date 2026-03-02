export const VALIDATION_PROFILES = ["FTR", "SDP", "SRP", "COMPETENCY"] as const;

export type ValidationProfile = (typeof VALIDATION_PROFILES)[number];
export type ValidationCheckStatus = "PASS" | "PARTIAL" | "MISSING";
export type ValidationTargetTrack = "ftr" | "sdp" | "srp" | "competency";
export type ValidationRuleSeverity = "CRITICAL" | "IMPORTANT" | "ADVISORY";

export type ValidationTargetOption = {
  id: string;
  profile: ValidationProfile;
  track: ValidationTargetTrack;
  sourceRow: number;
  label: string;
  domain?: string;
  partnerTypePath?: string;
  serviceCategory?: string;
  checklistUrl?: string;
  calibrationGuideUrl?: string;
  referenceChecklistUrls?: string[];
  keywords?: string[];
};

export type ValidationTargetContext = {
  id: string;
  label: string;
  track: ValidationTargetTrack;
  domain?: string;
  partnerTypePath?: string;
  serviceCategory?: string;
  checklistUrl?: string;
  calibrationGuideUrl?: string;
  referenceChecklistUrls?: string[];
  keywords?: string[];
};

type RulePattern = {
  id: string;
  regex: RegExp;
};

type RuleDefinition = {
  id: string;
  title: string;
  description: string;
  guidance: string;
  keywords: string[];
  patterns?: RulePattern[];
  minKeywordHits?: number;
  minSignalHits?: number;
  weight: number;
  severity: ValidationRuleSeverity;
};

type ProfileDefinition = {
  label: string;
  overview: string;
  rules: RuleDefinition[];
};

type Rulepack = {
  id: string;
  profile: ValidationProfile;
  version: string;
  target?: ValidationTargetContext;
  rules: RuleDefinition[];
};

type ReportContext = {
  sourceType: "pdf" | "spreadsheet";
  filename: string;
  pages?: number;
  sheets?: number;
  additionalContext?: string;
  processingNotes?: string[];
};

export type ValidationReport = {
  profile: ValidationProfile;
  profileLabel: string;
  overview: string;
  score: number;
  counts: Record<ValidationCheckStatus, number>;
  summary: string;
  topGaps: string[];
  target?: {
    id: string;
    label: string;
    track: ValidationTargetTrack;
    domain?: string;
    checklistUrl?: string;
    calibrationGuideUrl?: string;
    referenceChecklistUrls?: string[];
  };
  rulepack: {
    id: string;
    version: string;
    ruleCount: number;
  };
  processingNotes: string[];
  controlCalibration?: {
    totalControls: number;
    counts: Record<ValidationCheckStatus, number>;
    controls: Array<{
      sheetName: string;
      rowNumber: number;
      controlId: string;
      requirement: string;
      response: string;
      status: ValidationCheckStatus;
      confidence: "HIGH" | "MEDIUM" | "LOW";
      missingSignals: string[];
      recommendation: string;
      suggestedEdit: string;
    }>;
  };
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
    severity: ValidationRuleSeverity;
    weight: number;
    hitKeywords: string[];
    hitPatterns: string[];
    evidence: string | null;
    guidance: string;
  }>;
};

const RULEPACK_VERSION = "2026.03.02";

function pattern(id: string, regex: RegExp): RulePattern {
  return { id, regex };
}

const PROFILE_DEFINITIONS: Record<ValidationProfile, ProfileDefinition> = {
  FTR: {
    label: "FTR",
    overview: "Foundational technical readiness review for scope, controls, and execution evidence.",
    rules: [
      {
        id: "scope",
        title: "Scope and objectives are defined",
        description: "Document should clearly state purpose, scope boundaries, and expected outcomes.",
        guidance: "Add an executive summary with objective, in-scope systems, and out-of-scope exclusions.",
        keywords: ["scope", "objective", "outcome", "in-scope", "out-of-scope", "purpose"],
        patterns: [pattern("scope-boundary", /\b(in[\s-]?scope|out[\s-]?of[\s-]?scope)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "architecture",
        title: "Architecture context is documented",
        description: "Core architecture components and integration flow should be described.",
        guidance: "Include architecture diagrams and component interactions with dependencies.",
        keywords: ["architecture", "diagram", "component", "integration", "workflow", "data flow"],
        patterns: [
          pattern("diagram-reference", /\b(diagram|reference architecture|architecture pattern)\b/i),
          pattern("component-reference", /\b(component|module|service boundary|dependency)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "security",
        title: "Security controls are referenced",
        description: "Security baseline should include IAM, encryption, logging, and access boundaries.",
        guidance: "Document least-privilege IAM, data protection controls, and audit logging.",
        keywords: [
          "security",
          "iam",
          "least privilege",
          "encryption",
          "logging",
          "access control",
          "secrets",
          "key management",
        ],
        patterns: [
          pattern("policy-reference", /\b(policy|control owner|control objective)\b/i),
          pattern("audit-reference", /\b(audit log|cloudtrail|siem|log retention)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.4,
        severity: "CRITICAL",
      },
      {
        id: "testing",
        title: "Testing evidence is present",
        description: "Testing plan/results should show validation coverage and outcomes.",
        guidance: "Add explicit test cases, pass/fail criteria, and evidence of execution.",
        keywords: ["test plan", "test result", "validation", "acceptance criteria", "qa", "coverage"],
        patterns: [
          pattern("pass-fail", /\b(pass|fail|passed|failed|result)\b/i),
          pattern("test-case", /\b(test case|test scenario|validation case)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "IMPORTANT",
      },
      {
        id: "risks",
        title: "Risks and mitigations are tracked",
        description: "Known risks should include severity and mitigation actions.",
        guidance: "Include a risk register with ownership, severity, and mitigation status.",
        keywords: ["risk", "mitigation", "issue", "blocker", "dependency", "severity"],
        patterns: [pattern("risk-register", /\b(risk register|mitigation plan|risk owner)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.1,
        severity: "IMPORTANT",
      },
      {
        id: "approval",
        title: "Review/approval trail exists",
        description: "Reviewers, dates, and approvals should be discoverable.",
        guidance: "Add sign-off section with reviewer names, date, and approval status.",
        keywords: ["approved", "sign-off", "reviewed by", "owner", "approval", "date"],
        patterns: [
          pattern("approval-date", /\b(approved on|review date|sign-?off date|approved by)\b/i),
          pattern("iso-date", /\b\d{4}-\d{2}-\d{2}\b/),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1,
        severity: "IMPORTANT",
      },
    ],
  },
  SDP: {
    label: "Service Delivery Program (SDP)",
    overview: "Service delivery review for repeatable operations and customer execution.",
    rules: [
      {
        id: "service-description",
        title: "Service/process description exists",
        description: "Delivery process should describe phases, responsibilities, and sequence.",
        guidance: "Document service flow from intake to completion with clear responsibilities.",
        keywords: ["service", "process", "delivery", "phase", "responsibility", "workflow"],
        patterns: [pattern("process-flow", /\b(intake|handoff|delivery phase|implementation step)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "requirements",
        title: "Requirements mapping is explicit",
        description: "Requirements should map to implementation or control evidence.",
        guidance: "Create a requirements-to-evidence mapping table with references.",
        keywords: ["requirement", "mapping", "control", "evidence", "traceability", "matrix"],
        patterns: [pattern("requirement-id", /\b(req|requirement)[\s_-]*\d+\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.3,
        severity: "CRITICAL",
      },
      {
        id: "sla",
        title: "Service levels and escalation paths are defined",
        description: "SLA, response targets, and escalation contacts should be captured.",
        guidance: "Add SLA metrics and escalation matrix including contacts and timelines.",
        keywords: ["sla", "response time", "resolution", "escalation", "support", "uptime"],
        patterns: [
          pattern("time-target", /\b\d+\s*(hour|hours|minute|minutes|business day|days)\b/i),
          pattern("escalation-matrix", /\b(escalation matrix|escalation path|severity level)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "operations",
        title: "Operations and monitoring coverage is present",
        description: "Monitoring and runbook procedures should be evident.",
        guidance: "Add monitoring scope, alert thresholds, and runbook references.",
        keywords: ["monitoring", "alert", "runbook", "operations", "incident", "observability"],
        patterns: [pattern("runbook-ref", /\b(runbook|playbook|on-call|incident response)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.1,
        severity: "IMPORTANT",
      },
      {
        id: "change-management",
        title: "Change management controls are included",
        description: "Change approvals and release process should be defined.",
        guidance: "Document release approvals, rollback procedure, and deployment controls.",
        keywords: ["change", "release", "approval", "rollback", "version", "deployment"],
        patterns: [
          pattern("change-ticket", /\b(change request|cr-?\d+|ticket|jira|service now)\b/i),
          pattern("rollback", /\b(rollback|roll back|backout|revert)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1,
        severity: "IMPORTANT",
      },
      {
        id: "customer-outcomes",
        title: "Customer outcome/evidence statements exist",
        description: "Business outcomes or customer impact should be measurable.",
        guidance: "Add measurable outcomes and success metrics tied to customer goals.",
        keywords: ["customer", "outcome", "value", "kpi", "success metric", "impact"],
        patterns: [pattern("metric", /\b\d+\s*(%|percent|hours|days|tickets|incidents)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1,
        severity: "IMPORTANT",
      },
    ],
  },
  SRP: {
    label: "Service Ready Program (SRP)",
    overview: "Software/service readiness review for repeatable operations and customer execution.",
    rules: [
      {
        id: "service-description",
        title: "Service/process description exists",
        description: "Delivery process should describe phases, responsibilities, and sequence.",
        guidance: "Document service flow from intake to completion with clear responsibilities.",
        keywords: ["service", "process", "delivery", "phase", "responsibility", "workflow"],
        patterns: [pattern("process-flow", /\b(intake|handoff|delivery phase|implementation step)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "requirements",
        title: "Requirements mapping is explicit",
        description: "Requirements should map to implementation or control evidence.",
        guidance: "Create a requirements-to-evidence mapping table with references.",
        keywords: ["requirement", "mapping", "control", "evidence", "traceability", "matrix"],
        patterns: [pattern("requirement-id", /\b(req|requirement)[\s_-]*\d+\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.3,
        severity: "CRITICAL",
      },
      {
        id: "sla",
        title: "Service levels and escalation paths are defined",
        description: "SLA, response targets, and escalation contacts should be captured.",
        guidance: "Add SLA metrics and escalation matrix including contacts and timelines.",
        keywords: ["sla", "response time", "resolution", "escalation", "support", "uptime"],
        patterns: [
          pattern("time-target", /\b\d+\s*(hour|hours|minute|minutes|business day|days)\b/i),
          pattern("escalation-matrix", /\b(escalation matrix|escalation path|severity level)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "operations",
        title: "Operations and monitoring coverage is present",
        description: "Monitoring and runbook procedures should be evident.",
        guidance: "Add monitoring scope, alert thresholds, and runbook references.",
        keywords: ["monitoring", "alert", "runbook", "operations", "incident", "observability"],
        patterns: [pattern("runbook-ref", /\b(runbook|playbook|on-call|incident response)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.1,
        severity: "IMPORTANT",
      },
      {
        id: "change-management",
        title: "Change management controls are included",
        description: "Change approvals and release process should be defined.",
        guidance: "Document release approvals, rollback procedure, and deployment controls.",
        keywords: ["change", "release", "approval", "rollback", "version", "deployment"],
        patterns: [
          pattern("change-ticket", /\b(change request|cr-?\d+|ticket|jira|service now)\b/i),
          pattern("rollback", /\b(rollback|roll back|backout|revert)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1,
        severity: "IMPORTANT",
      },
      {
        id: "customer-outcomes",
        title: "Customer outcome/evidence statements exist",
        description: "Business outcomes or customer impact should be measurable.",
        guidance: "Add measurable outcomes and success metrics tied to customer goals.",
        keywords: ["customer", "outcome", "value", "kpi", "success metric", "impact"],
        patterns: [pattern("metric", /\b\d+\s*(%|percent|hours|days|tickets|incidents)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1,
        severity: "IMPORTANT",
      },
    ],
  },
  COMPETENCY: {
    label: "Competency",
    overview: "Competency-level evidence review for case studies, capabilities, and operational maturity.",
    rules: [
      {
        id: "case-studies",
        title: "Case studies and customer references are present",
        description: "Evidence should include customer use cases and outcomes.",
        guidance: "Include anonymized case studies with before/after outcomes and customer profile.",
        keywords: ["case study", "customer", "reference", "use case", "engagement", "outcome"],
        patterns: [pattern("reference-count", /\b(customer|client)\s+(reference|story|case)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.3,
        severity: "CRITICAL",
      },
      {
        id: "capabilities",
        title: "Technical capabilities are articulated",
        description: "Capabilities should demonstrate depth in architecture and implementation.",
        guidance: "Add capability matrix showing architecture, build, and operational strengths.",
        keywords: ["capability", "expertise", "architecture", "implementation", "specialization", "solution"],
        patterns: [pattern("capability-matrix", /\b(capability matrix|core capability|technical depth)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "staffing",
        title: "Staffing and certification evidence exists",
        description: "Team qualifications and certifications should be documented.",
        guidance: "List team roles, credentials, and relevant certifications with validity window.",
        keywords: ["certification", "staff", "team", "engineer", "credential", "aws certified"],
        patterns: [
          pattern("certification-id", /\b(certified|certification|badge|accreditation)\b/i),
          pattern("team-size", /\b\d+\s*(engineers|architects|consultants|specialists)\b/i),
        ],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.1,
        severity: "IMPORTANT",
      },
      {
        id: "security-compliance",
        title: "Security/compliance posture is addressed",
        description: "Security and governance posture should include control ownership.",
        guidance: "Provide compliance scope, policy references, and control ownership details.",
        keywords: ["compliance", "governance", "security", "policy", "control", "audit"],
        patterns: [pattern("framework-ref", /\b(iso\s?27001|soc\s?2|hipaa|gdpr|pci|nist)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1.2,
        severity: "CRITICAL",
      },
      {
        id: "operations",
        title: "Operational maturity and support model is described",
        description: "Operations, support, and lifecycle management should be clear.",
        guidance: "Add support model, operational cadence, and lifecycle ownership.",
        keywords: ["support", "operations", "lifecycle", "maintenance", "incident", "runbook"],
        patterns: [pattern("operations-model", /\b(service desk|support model|incident management)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1,
        severity: "IMPORTANT",
      },
      {
        id: "continuity",
        title: "Continuity and resiliency planning is included",
        description: "Resiliency, backup, and recovery approach should be documented.",
        guidance: "Include backup cadence, DR/RTO targets, and resiliency test evidence.",
        keywords: ["backup", "disaster recovery", "resiliency", "rto", "rpo", "continuity"],
        patterns: [pattern("dr-target", /\b(rto|rpo|recovery time|recovery point|failover)\b/i)],
        minKeywordHits: 2,
        minSignalHits: 2,
        weight: 1,
        severity: "IMPORTANT",
      },
    ],
  },
};

const TRACK_SPECIFIC_RULES: Record<ValidationTargetTrack, RuleDefinition[]> = {
  ftr: [
    {
      id: "ftr-service-context",
      title: "AWS service context is explicit",
      description: "Submission should explicitly identify the AWS service/workload scope being reviewed.",
      guidance: "Name the exact AWS service scope and describe workload boundaries and assumptions.",
      keywords: ["aws", "service", "workload", "account", "region", "landing zone"],
      patterns: [pattern("aws-service-name", /\b(amazon\s+[a-z0-9]+|aws\s+[a-z0-9]+)\b/i)],
      minKeywordHits: 2,
      minSignalHits: 2,
      weight: 1,
      severity: "IMPORTANT",
    },
  ],
  sdp: [
    {
      id: "sdp-delivery-operating-model",
      title: "Delivery operating model is repeatable",
      description: "Service delivery model should show repeatable execution, ownership, and handoffs.",
      guidance: "Define roles, entry/exit criteria, and repeatable delivery milestones.",
      keywords: ["milestone", "handoff", "owner", "deliverable", "acceptance", "playbook"],
      patterns: [pattern("milestone-date", /\b(milestone|phase)\s*\d+\b/i)],
      minKeywordHits: 2,
      minSignalHits: 2,
      weight: 1,
      severity: "IMPORTANT",
    },
  ],
  srp: [
    {
      id: "srp-software-readiness",
      title: "Software readiness controls are evidenced",
      description: "Software readiness should include release, supportability, and upgrade controls.",
      guidance: "Document release process, versioning, support boundaries, and compatibility expectations.",
      keywords: ["version", "release", "compatibility", "upgrade", "supportability", "deployment"],
      patterns: [pattern("version-semver", /\bv?\d+\.\d+(\.\d+)?\b/i)],
      minKeywordHits: 2,
      minSignalHits: 2,
      weight: 1,
      severity: "IMPORTANT",
    },
  ],
  competency: [
    {
      id: "competency-evidence-depth",
      title: "Evidence depth supports competency claim",
      description: "Competency submissions should provide concrete evidence beyond high-level statements.",
      guidance: "Attach measurable outcomes, technical artifacts, and clearly scoped customer evidence.",
      keywords: ["artifact", "evidence", "metric", "reference", "outcome", "implementation"],
      patterns: [
        pattern("evidence-link", /https?:\/\/[\w./%-]+/i),
        pattern("quantified-outcome", /\b\d+\s*(%|percent|hours|days|months|customers)\b/i),
      ],
      minKeywordHits: 2,
      minSignalHits: 2,
      weight: 1,
      severity: "IMPORTANT",
    },
  ],
};

const CROSS_CUTTING_RULES: RuleDefinition[] = [
  {
    id: "traceability-artifacts",
    title: "Traceability to evidence artifacts exists",
    description: "Submission should reference concrete evidence artifacts and traceability anchors.",
    guidance: "Add explicit artifact references, links, IDs, or appendix pointers for each major claim.",
    keywords: ["evidence", "artifact", "appendix", "attachment", "reference", "link"],
    patterns: [
      pattern("external-link", /https?:\/\/[\w./%-]+/i),
      pattern("ticket-reference", /\b([A-Z]{2,10}-\d{2,6}|ticket\s*#?\d+)\b/),
      pattern("appendix-reference", /\bappendix\s+[a-z0-9]+\b/i),
    ],
    minKeywordHits: 2,
    minSignalHits: 2,
    weight: 0.9,
    severity: "ADVISORY",
  },
  {
    id: "document-revision-cadence",
    title: "Document revision and recency are visible",
    description: "Submission should include revision markers, versions, or dates.",
    guidance: "Include version history with dates and owner updates so reviewers can verify freshness.",
    keywords: ["version", "revision", "updated", "owner", "date", "history"],
    patterns: [
      pattern("iso-date", /\b\d{4}-\d{2}-\d{2}\b/),
      pattern("slash-date", /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/),
    ],
    minKeywordHits: 2,
    minSignalHits: 2,
    weight: 0.8,
    severity: "ADVISORY",
  },
];

function dedupeLower(values: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(normalized);
  }

  return unique;
}

function tokenizedTargetKeywords(target: ValidationTargetContext) {
  const tokens = new Set<string>();

  const sources = [
    ...(target.keywords ?? []),
    target.label,
    target.domain,
    target.partnerTypePath,
    target.serviceCategory,
  ];

  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const token of source.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length < 3) {
        continue;
      }

      if (["aws", "service", "services", "delivery", "ready", "competency", "software"].includes(token)) {
        continue;
      }

      tokens.add(token);
    }
  }

  return [...tokens].slice(0, 20);
}

function buildTargetRules(target: ValidationTargetContext): RuleDefinition[] {
  const targetKeywords = tokenizedTargetKeywords(target);
  if (targetKeywords.length === 0) {
    return [];
  }

  const checklistReferenceKeywords = dedupeLower([
    "checklist",
    "requirement",
    "evidence",
    "control",
    "calibration",
    ...targetKeywords.slice(0, 6),
  ]);

  return [
    {
      id: "target-alignment",
      title: `Evidence aligns with selected checklist: ${target.label}`,
      description:
        "Submission should clearly map to the selected checklist designation and its technical scope.",
      guidance:
        `Reference ${target.label} requirements explicitly and map evidence sections to checklist controls.`,
      keywords: targetKeywords,
      patterns: [pattern("target-label", new RegExp(`\\b${escapeRegex(targetKeywords[0])}\\b`, "i"))],
      minKeywordHits: 2,
      minSignalHits: 2,
      weight: 1.3,
      severity: "CRITICAL",
    },
    {
      id: "checklist-traceability",
      title: "Checklist traceability is explicit",
      description: "Submission should show how controls map to checklist evidence.",
      guidance: "Add a control-by-control mapping table with direct evidence references.",
      keywords: checklistReferenceKeywords,
      patterns: [
        pattern("control-mapping", /\b(control|requirement|criterion)\s*(id|mapping|matrix|table)\b/i),
        pattern("evidence-reference", /\b(evidence\s*(id|link|ref)|artifact\s*(id|link|ref))\b/i),
      ],
      minKeywordHits: 2,
      minSignalHits: 2,
      weight: 1,
      severity: "IMPORTANT",
    },
  ];
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRulepack(input: {
  profile: ValidationProfile;
  target?: ValidationTargetContext;
}): Rulepack {
  const profileDefinition = PROFILE_DEFINITIONS[input.profile];

  const rules = [...profileDefinition.rules, ...CROSS_CUTTING_RULES];

  if (input.target?.track) {
    rules.push(...(TRACK_SPECIFIC_RULES[input.target.track] ?? []));
  }

  if (input.target) {
    rules.push(...buildTargetRules(input.target));
  }

  return {
    id: input.target ? `${input.profile.toLowerCase()}::${input.target.id}` : `${input.profile.toLowerCase()}::default`,
    profile: input.profile,
    version: RULEPACK_VERSION,
    target: input.target,
    rules,
  };
}

function findKeywordHits(normalizedText: string, keywords: string[]) {
  const normalizedKeywords = dedupeLower(keywords);
  return normalizedKeywords.filter((keyword) => normalizedText.includes(keyword));
}

function findPatternHits(rawText: string, patterns: RulePattern[] | undefined) {
  if (!patterns || patterns.length === 0) {
    return [];
  }

  const hits: string[] = [];

  for (const item of patterns) {
    const flags = item.regex.flags.replace("g", "");
    const regex = new RegExp(item.regex.source, flags);
    if (regex.test(rawText)) {
      hits.push(item.id);
    }
  }

  return hits;
}

function summarizeSnippet(rawText: string, keyword: string, patterns: RulePattern[] | undefined) {
  const lower = rawText.toLowerCase();
  let index = keyword ? lower.indexOf(keyword.toLowerCase()) : -1;

  if (index < 0 && patterns && patterns.length > 0) {
    for (const item of patterns) {
      const flags = item.regex.flags.replace("g", "");
      const regex = new RegExp(item.regex.source, flags);
      const match = regex.exec(rawText);
      if (match && typeof match.index === "number") {
        index = match.index;
        break;
      }
    }
  }

  if (index < 0) {
    return null;
  }

  const start = Math.max(0, index - 90);
  const end = Math.min(rawText.length, index + 240);
  const snippet = rawText.slice(start, end).replace(/\s+/g, " ").trim();
  if (!snippet) {
    return null;
  }

  const prefix = start > 0 ? "..." : "";
  const suffix = end < rawText.length ? "..." : "";
  return `${prefix}${snippet}${suffix}`;
}

function ruleStatus(input: {
  keywordHits: string[];
  patternHits: string[];
  minKeywordHits?: number;
  minSignalHits?: number;
}): ValidationCheckStatus {
  const minKeywordHits = input.minKeywordHits ?? 2;
  const minSignalHits = input.minSignalHits ?? 2;

  const totalSignals = input.keywordHits.length + input.patternHits.length;
  if (input.keywordHits.length >= minKeywordHits || totalSignals >= minSignalHits) {
    return "PASS";
  }

  if (totalSignals > 0) {
    return "PARTIAL";
  }

  return "MISSING";
}

function statusScore(status: ValidationCheckStatus) {
  if (status === "PASS") {
    return 1;
  }

  if (status === "PARTIAL") {
    return 0.5;
  }

  return 0;
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

function severityRank(severity: ValidationRuleSeverity) {
  if (severity === "CRITICAL") {
    return 3;
  }

  if (severity === "IMPORTANT") {
    return 2;
  }

  return 1;
}

function normalizeReferenceUrls(urls?: string[]) {
  if (!urls || urls.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const rawUrl of urls) {
    const url = rawUrl.trim();
    if (!url || seen.has(url)) {
      continue;
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      continue;
    }

    seen.add(url);
    cleaned.push(url);
  }

  return cleaned.length > 0 ? cleaned : undefined;
}

export function buildValidationReport(input: {
  profile: ValidationProfile;
  rawText: string;
  context: ReportContext;
  target?: ValidationTargetContext;
}) {
  const profileDefinition = PROFILE_DEFINITIONS[input.profile];
  const normalizedText = input.rawText.toLowerCase();
  const wordCount = input.rawText.trim() ? input.rawText.trim().split(/\s+/).length : 0;

  const rulepack = buildRulepack({
    profile: input.profile,
    target: input.target,
  });

  const checks = rulepack.rules.map((rule) => {
    const hitKeywords = findKeywordHits(normalizedText, rule.keywords);
    const hitPatterns = findPatternHits(input.rawText, rule.patterns);
    const status = ruleStatus({
      keywordHits: hitKeywords,
      patternHits: hitPatterns,
      minKeywordHits: rule.minKeywordHits,
      minSignalHits: rule.minSignalHits,
    });

    const evidence = summarizeSnippet(input.rawText, hitKeywords[0] ?? "", rule.patterns);

    return {
      id: rule.id,
      title: rule.title,
      description: rule.description,
      status,
      severity: rule.severity,
      weight: rule.weight,
      hitKeywords,
      hitPatterns,
      evidence,
      guidance: rule.guidance,
    };
  });

  const counts = checks.reduce<Record<ValidationCheckStatus, number>>(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { PASS: 0, PARTIAL: 0, MISSING: 0 },
  );

  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const weightedScore =
    totalWeight > 0
      ? checks.reduce((sum, check) => sum + statusScore(check.status) * check.weight, 0) / totalWeight
      : 0;

  const score = Math.round(weightedScore * 100);

  const topGaps = checks
    .filter((check) => check.status !== "PASS")
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "MISSING" ? -1 : 1;
      }

      const severityDelta = severityRank(b.severity) - severityRank(a.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }

      return b.weight - a.weight;
    })
    .slice(0, 5)
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
    target: input.target
      ? {
          id: input.target.id,
          label: input.target.label,
          track: input.target.track,
          domain: input.target.domain,
          checklistUrl: input.target.checklistUrl,
          calibrationGuideUrl: input.target.calibrationGuideUrl,
          referenceChecklistUrls: normalizeReferenceUrls(input.target.referenceChecklistUrls),
        }
      : undefined,
    rulepack: {
      id: rulepack.id,
      version: rulepack.version,
      ruleCount: rulepack.rules.length,
    },
    processingNotes: input.context.processingNotes ?? [],
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
  lines.push(`Rulepack: ${report.rulepack.id} v${report.rulepack.version}`);

  if (report.target) {
    lines.push(`Selected checklist: ${report.target.label} [${report.target.track.toUpperCase()}]`);
    if (report.target.checklistUrl) {
      lines.push(`Checklist link: ${report.target.checklistUrl}`);
    }
    if (report.target.calibrationGuideUrl) {
      lines.push(`Calibration guide link: ${report.target.calibrationGuideUrl}`);
    }
  }

  lines.push(`Score: ${report.score}%`);
  lines.push(
    `Checks: ${report.counts.PASS} pass, ${report.counts.PARTIAL} partial, ${report.counts.MISSING} missing`,
  );
  lines.push(`Summary: ${report.summary}`);

  if (report.processingNotes.length > 0) {
    lines.push("Processing notes:");
    for (const note of report.processingNotes) {
      lines.push(`- ${note}`);
    }
  }

  if (report.controlCalibration) {
    lines.push("");
    lines.push("Control-by-control calibration:");
    lines.push(
      `Controls: ${report.controlCalibration.totalControls} total (${report.controlCalibration.counts.PASS} pass, ${report.controlCalibration.counts.PARTIAL} partial, ${report.controlCalibration.counts.MISSING} missing)`,
    );
  }

  lines.push("");
  lines.push("Checklist results:");

  for (const check of report.checks) {
    const keywords = check.hitKeywords.length ? check.hitKeywords.join(", ") : "none";
    const patterns = check.hitPatterns.length ? check.hitPatterns.join(", ") : "none";
    lines.push(`${statusToken(check.status)} ${check.title} [${check.severity}]`);
    lines.push(`  Matched keywords: ${keywords}`);
    lines.push(`  Matched patterns: ${patterns}`);
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
