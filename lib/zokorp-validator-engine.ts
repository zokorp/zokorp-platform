import {
  FTR_LAUNCH_V1_CHECKLIST_WINDOW,
  FTR_LAUNCH_V1_CORE_RULE_IDS,
  FTR_LAUNCH_V1_CUSTOMER_DEPLOYED_RULE_IDS,
  FTR_LAUNCH_V1_PARTNER_HOSTED_RULE_IDS,
  FTR_LAUNCH_V1_RULES_BY_ID,
} from "@/lib/validator-ftr-launch-v1-catalog";

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
      responseCell?: string;
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
    officialSourceLinks?: string[];
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

type FtrChecklistPath = "partner-hosted" | "customer-deployed" | "unknown";
type FtrChecklistConfidence = "explicit" | "probable" | "conflicted" | "unknown";

type FtrChecklistClassification = {
  path: FtrChecklistPath;
  confidence: FtrChecklistConfidence;
  evidence: string[];
};

type FtrRuleEvaluation = {
  status: ValidationCheckStatus;
  evidence: string | null;
  hitKeywords: string[];
  hitPatterns: string[];
};

type FtrEvaluationContext = {
  rawText: string;
  normalizedText: string;
  filenameLower: string;
  sourceType: ReportContext["sourceType"];
  target?: ValidationTargetContext;
  classification: FtrChecklistClassification;
  controlCalibration?: ValidationReport["controlCalibration"];
  additionalContext?: string;
};

const FTR_AWS_SERVICE_TERMS = [
  "aws",
  "amazon",
  "ec2",
  "ecs",
  "fargate",
  "eks",
  "lambda",
  "api gateway",
  "alb",
  "application load balancer",
  "cloudfront",
  "route 53",
  "rds",
  "aurora",
  "dynamodb",
  "s3",
  "sqs",
  "sns",
  "eventbridge",
  "step functions",
  "cloudwatch",
  "cloudtrail",
  "vpc",
  "subnet",
  "security hub",
  "secrets manager",
  "kms",
  "iam",
];

const FTR_DIAGRAM_TERMS = [
  "architecture diagram",
  "reference architecture",
  "deployment diagram",
  "solution diagram",
  "architecture",
  "diagram",
];

const FTR_FLOW_TERMS = [
  "data flow",
  "request flow",
  "integration",
  "connects to",
  "publishes to",
  "subscribes to",
  "writes to",
  "reads from",
  "calls",
  "connects",
  "flow",
  "vpc",
  "subnet",
];

const FTR_SUPPORT_TERMS = [
  "business support",
  "partner-led support",
  "support plan",
  "escalation plan",
  "escalation path",
  "production accounts",
  "support coverage",
  "severity",
];

const FTR_INCIDENT_TERMS = [
  "incident management",
  "incident response",
  "triage",
  "severity levels",
  "post-incident",
  "post incident",
  "on-call",
  "on call",
  "roles",
  "customer communication",
];

const FTR_BACKUP_TERMS = [
  "backup",
  "backups",
  "restore",
  "restore test",
  "recovery test",
  "snapshot",
  "retention",
];

const FTR_CROSS_ACCOUNT_TERMS = [
  "cross-account",
  "cross account",
  "assumerole",
  "assume role",
  "assumerolewithwebidentity",
  "web identity",
  "external id",
  "issuer url",
  "least privilege",
];

const FTR_PARTNER_HOSTED_TERMS = [
  "partner-hosted",
  "partner hosted",
  "hosted by the partner",
  "hosted and operated by",
  "saas",
  "service offering",
  "our aws account",
  "partner aws account",
  "we host",
];

const FTR_CUSTOMER_DEPLOYED_TERMS = [
  "customer-deployed",
  "customer deployed",
  "deployed in the customer account",
  "customer aws account",
  "deploy into your aws account",
  "software offering",
  "cloudformation",
  "terraform",
  "helm chart",
  "install into customer",
];

const FTR_SECURITY_CLAIM_TERMS = [
  "cis compliant",
  "security hub",
  "all controls passed",
  "least privilege",
  "encrypted at rest",
  "encrypted in transit",
  "highly available",
  "no public resources",
  "private only",
  "root access is not required",
];

const FTR_EVIDENCE_POINTER_PATTERNS = [
  /\bpage\s+\d+\b/i,
  /\bsection\s+[a-z0-9._-]+\b/i,
  /\bparagraph\s+\d+\b/i,
  /https?:\/\/[\w./%#?=&:-]+/i,
  /\bappendix\b/i,
  /\bevidence\b/i,
];

const FTR_PUBLIC_EXPOSURE_TERMS = [
  "public bucket",
  "public s3",
  "internet-facing",
  "internet facing",
  "public endpoint",
  "public alb",
  "public subnet",
  "cloudfront",
];

const FTR_SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bASIA[0-9A-Z]{16}\b/,
  /\baws_secret_access_key\b/i,
  /\bsecret_access_key\b/i,
  /\bpassword\s*=\s*['"]?[^\s'"]+/i,
  /\btoken\s*=\s*['"]?[^\s'"]+/i,
];

function ftrIncludesTerm(text: string, term: string) {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return false;
  }

  if (/\s/.test(normalizedTerm) || normalizedTerm.includes("-") || normalizedTerm.includes("/")) {
    return text.includes(normalizedTerm);
  }

  return new RegExp(`\\b${escapeRegex(normalizedTerm)}\\b`, "i").test(text);
}

function ftrMatchingTerms(text: string, terms: string[]) {
  return dedupeLower(terms.filter((term) => ftrIncludesTerm(text, term)));
}

function ftrSnippet(rawText: string, terms: string[]) {
  for (const term of terms) {
    const snippet = summarizeSnippet(rawText, term, undefined);
    if (snippet) {
      return snippet;
    }
  }

  return null;
}

function ftrStatusPoints(ruleId: string, status: ValidationCheckStatus) {
  const rule = FTR_LAUNCH_V1_RULES_BY_ID.get(ruleId);
  if (!rule) {
    return 0;
  }

  if (status === "PASS") {
    return rule.score_weight;
  }

  if (status === "PARTIAL") {
    return rule.max_partial_credit;
  }

  return 0;
}

function ftrSeverityForRule(ruleId: string): ValidationRuleSeverity {
  const rule = FTR_LAUNCH_V1_RULES_BY_ID.get(ruleId);
  if (!rule) {
    return "IMPORTANT";
  }

  if (rule.launch_priority === "critical") {
    return "CRITICAL";
  }

  if (rule.launch_priority === "high") {
    return "IMPORTANT";
  }

  return "ADVISORY";
}

function ftrStatusRank(status: ValidationCheckStatus) {
  if (status === "MISSING") {
    return 2;
  }

  if (status === "PARTIAL") {
    return 1;
  }

  return 0;
}

function ftrHasEvidencePointer(text: string) {
  return FTR_EVIDENCE_POINTER_PATTERNS.some((pattern) => pattern.test(text));
}

function classifyFtrChecklistPath(context: {
  normalizedText: string;
  target?: ValidationTargetContext;
  additionalContext?: string;
}): FtrChecklistClassification {
  const baseText = `${context.normalizedText} ${context.additionalContext ?? ""}`.trim();
  const partnerHits = ftrMatchingTerms(baseText, FTR_PARTNER_HOSTED_TERMS);
  const customerHits = ftrMatchingTerms(baseText, FTR_CUSTOMER_DEPLOYED_TERMS);

  if (partnerHits.length > 0 && customerHits.length > 0) {
    return {
      path: "unknown",
      confidence: "conflicted",
      evidence: [...partnerHits.slice(0, 2), ...customerHits.slice(0, 2)],
    };
  }

  if (partnerHits.length > 0) {
    return {
      path: "partner-hosted",
      confidence: "explicit",
      evidence: partnerHits.slice(0, 3),
    };
  }

  if (customerHits.length > 0) {
    return {
      path: "customer-deployed",
      confidence: "explicit",
      evidence: customerHits.slice(0, 3),
    };
  }

  if (context.target?.serviceCategory === "service") {
    return {
      path: "partner-hosted",
      confidence: "probable",
      evidence: ["selected target: service offering"],
    };
  }

  if (context.target?.serviceCategory === "software") {
    return {
      path: "customer-deployed",
      confidence: "probable",
      evidence: ["selected target: software offering"],
    };
  }

  return {
    path: "unknown",
    confidence: "unknown",
    evidence: [],
  };
}

function buildFtrRuleEvaluation(ruleId: string, context: FtrEvaluationContext): FtrRuleEvaluation {
  const text = context.normalizedText;
  const awsServiceHits = ftrMatchingTerms(text, FTR_AWS_SERVICE_TERMS);
  const diagramHits = ftrMatchingTerms(text, FTR_DIAGRAM_TERMS);
  const flowHits = ftrMatchingTerms(text, FTR_FLOW_TERMS);
  const strongClaimHits = ftrMatchingTerms(text, FTR_SECURITY_CLAIM_TERMS);
  const filenameYearMatch = context.filenameLower.match(/\b(202[4-9])\b/);

  switch (ruleId) {
    case "component_type_classified": {
      if (context.classification.confidence === "explicit") {
        return {
          status: "PASS",
          evidence: `Detected ${context.classification.path} from: ${context.classification.evidence.join(", ")}.`,
          hitKeywords: context.classification.evidence,
          hitPatterns: ["explicit-classification"],
        };
      }

      if (context.classification.confidence === "probable") {
        return {
          status: "PARTIAL",
          evidence: `Probable ${context.classification.path} based on ${context.classification.evidence.join(", ")}, but the documents do not state it explicitly.`,
          hitKeywords: context.classification.evidence,
          hitPatterns: ["probable-classification"],
        };
      }

      const evidence =
        context.classification.confidence === "conflicted"
          ? `Conflicting checklist-path signals: ${context.classification.evidence.join(", ")}.`
          : "No reliable hosting/deployment model signal found in the uploaded material.";
      return {
        status: "MISSING",
        evidence,
        hitKeywords: context.classification.evidence,
        hitPatterns: [context.classification.confidence === "conflicted" ? "classification-conflict" : "classification-missing"],
      };
    }

    case "checklist_version_in_validity_window": {
      const currentSignals = ftrMatchingTerms(text, ["2026", "feb 2026", "aug 2026", "current checklist"]);
      const staleSignals = ftrMatchingTerms(text, ["2024", "2025", "older checklist", "previous checklist"]);
      const observedVersion = filenameYearMatch?.[1] ?? staleSignals[0] ?? currentSignals[0] ?? "";

      if (currentSignals.length > 0 || observedVersion === "2026") {
        return {
          status: "PASS",
          evidence: `Observed checklist version signal: ${observedVersion || "2026/current"} within the ${FTR_LAUNCH_V1_CHECKLIST_WINDOW}.`,
          hitKeywords: currentSignals,
          hitPatterns: ["current-version"],
        };
      }

      if (observedVersion === "2025" || observedVersion === "2024" || staleSignals.length > 0) {
        return {
          status: "MISSING",
          evidence: `Observed version signal looks stale: ${observedVersion || staleSignals.join(", ")}.`,
          hitKeywords: staleSignals,
          hitPatterns: ["stale-version"],
        };
      }

      return {
        status: "PARTIAL",
        evidence: "Checklist version is not provable from the uploaded material. It appears to be an FTR checklist, but the version window is not explicit.",
        hitKeywords: [],
        hitPatterns: ["version-not-provable"],
      };
    }

    case "required_artifacts_present_for_path": {
      const hasSelfAssessment =
        context.sourceType === "spreadsheet" ||
        ftrMatchingTerms(text, ["self-assessment", "self assessment", "checklist", "partner response", "spreadsheet"]).length > 0;
      const hasArchitecture = diagramHits.length > 0;
      const hasDeploymentGuide =
        ftrMatchingTerms(text, ["deployment guide", "implementation guide", "installation guide", "admin guide"]).length > 0 ||
        context.filenameLower.includes("deployment");

      if (hasSelfAssessment && hasArchitecture && (context.classification.path !== "customer-deployed" || hasDeploymentGuide)) {
        return {
          status: "PASS",
          evidence: `Core artifacts detected: self-assessment=${hasSelfAssessment}, architecture=${hasArchitecture}, deployment-guide=${hasDeploymentGuide || context.classification.path !== "customer-deployed"}.`,
          hitKeywords: dedupeLower([
            ...(hasSelfAssessment ? ["self-assessment"] : []),
            ...(hasArchitecture ? ["architecture diagram"] : []),
            ...(hasDeploymentGuide ? ["deployment guide"] : []),
          ]),
          hitPatterns: ["artifact-pack"],
        };
      }

      const missing: string[] = [];
      if (!hasSelfAssessment) missing.push("self-assessment checklist");
      if (!hasArchitecture) missing.push("architecture diagram");
      if (context.classification.path === "customer-deployed" && !hasDeploymentGuide) {
        missing.push("deployment guide");
      }

      return {
        status: "MISSING",
        evidence: `Missing core artifacts: ${missing.join(", ")}.`,
        hitKeywords: [],
        hitPatterns: ["artifact-missing"],
      };
    }

    case "self_assessment_complete_no_blanks": {
      if (context.controlCalibration?.totalControls) {
        const total = context.controlCalibration.totalControls;
        const missing = context.controlCalibration.counts.MISSING;
        const partial = context.controlCalibration.counts.PARTIAL;
        const evidencePointerGaps = context.controlCalibration.controls.filter((control) =>
          control.missingSignals.includes("evidence_ref"),
        ).length;
        const missingRatio = total > 0 ? missing / total : 0;

        if (missing === 0 && evidencePointerGaps === 0) {
          return {
            status: "PASS",
            evidence: `Checklist calibration found ${total} rows with no missing rows and no missing evidence-pointer gaps.`,
            hitKeywords: ["control calibration"],
            hitPatterns: ["checklist-complete"],
          };
        }

        if (missingRatio <= 0.1 && missing < total) {
          return {
            status: "PARTIAL",
            evidence: `Checklist calibration found ${missing} missing rows, ${partial} partial rows, and ${evidencePointerGaps} rows missing evidence pointers.`,
            hitKeywords: ["control calibration"],
            hitPatterns: ["checklist-partial"],
          };
        }

        return {
          status: "MISSING",
          evidence: `Checklist calibration found ${missing} missing rows, ${partial} partial rows, and ${evidencePointerGaps} rows missing evidence pointers.`,
          hitKeywords: ["control calibration"],
          hitPatterns: ["checklist-incomplete"],
        };
      }

      const blankHits = ftrMatchingTerms(text, ["tbd", "todo", "to be determined", "n/a", "blank"]);
      const pointerHits = ftrHasEvidencePointer(text);
      if (blankHits.length === 0 && pointerHits) {
        return {
          status: "PASS",
          evidence: "No obvious blank/TBD checklist markers found, and evidence-pointer signals are present.",
          hitKeywords: ["evidence pointer"],
          hitPatterns: ["no-blank-markers"],
        };
      }

      if (blankHits.length <= 2 || pointerHits) {
        return {
          status: "PARTIAL",
          evidence: `Checklist shows incomplete-response markers or weak evidence pointers: ${blankHits.join(", ") || "pointer coverage is inconsistent"}.`,
          hitKeywords: blankHits,
          hitPatterns: ["checklist-gaps"],
        };
      }

      return {
        status: "MISSING",
        evidence: "Checklist content appears incomplete, with multiple blank/TBD markers and no reliable evidence-pointer pattern.",
        hitKeywords: blankHits,
        hitPatterns: ["checklist-incomplete"],
      };
    }

    case "architecture_diagram_present_and_aws_services_named": {
      if (diagramHits.length > 0 && awsServiceHits.length >= 2 && flowHits.length > 0) {
        return {
          status: "PASS",
          evidence: ftrSnippet(context.rawText, [...diagramHits, ...awsServiceHits.slice(0, 2), ...flowHits.slice(0, 1)]),
          hitKeywords: [...diagramHits.slice(0, 2), ...awsServiceHits.slice(0, 4)],
          hitPatterns: ["diagram-and-services"],
        };
      }

      if ((diagramHits.length > 0 && awsServiceHits.length >= 1) || awsServiceHits.length >= 3) {
        return {
          status: "PARTIAL",
          evidence: "Architecture signals are present, but the diagrams/resources/connections are not explicit enough to validate the typical AWS deployment cleanly.",
          hitKeywords: [...diagramHits.slice(0, 2), ...awsServiceHits.slice(0, 3)],
          hitPatterns: ["diagram-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "I could not find a usable architecture-diagram story with named AWS services and clear connection/flow signals.",
        hitKeywords: [...diagramHits.slice(0, 2), ...awsServiceHits.slice(0, 2)],
        hitPatterns: ["diagram-missing"],
      };
    }

    case "no_material_contradictions_across_documents": {
      const contradictionHits: string[] = [];
      if (context.classification.confidence === "conflicted") {
        contradictionHits.push("hosting model conflict");
      }
      if (
        ftrIncludesTerm(text, "no public resources") &&
        ftrMatchingTerms(text, FTR_PUBLIC_EXPOSURE_TERMS).length > 0
      ) {
        contradictionHits.push("public exposure conflict");
      }
      if (ftrIncludesTerm(text, "business support") && ftrIncludesTerm(text, "basic support")) {
        contradictionHits.push("support-tier conflict");
      }

      if (contradictionHits.length > 0) {
        return {
          status: "MISSING",
          evidence: `Material contradictions detected: ${contradictionHits.join(", ")}.`,
          hitKeywords: contradictionHits,
          hitPatterns: ["contradiction"],
        };
      }

      if (context.classification.confidence === "probable") {
        return {
          status: "PARTIAL",
          evidence: "No direct contradiction found, but the checklist path is only probable rather than explicitly stated.",
          hitKeywords: context.classification.evidence,
          hitPatterns: ["classification-not-explicit"],
        };
      }

      return {
        status: "PASS",
        evidence: "No material contradictions surfaced across the uploaded material.",
        hitKeywords: [],
        hitPatterns: ["no-material-contradiction"],
      };
    }

    case "unsupported_claims_flagged": {
      const hasEvidence = ftrHasEvidencePointer(text) || ftrMatchingTerms(text, ["security hub", "cis report", "appendix", "evidence"]).length > 0;
      if (strongClaimHits.length === 0 || (strongClaimHits.length > 0 && hasEvidence)) {
        return {
          status: strongClaimHits.length === 0 ? "PASS" : "PARTIAL",
          evidence:
            strongClaimHits.length === 0
              ? "No high-confidence unsupported claim pattern was detected."
              : `Strong claims were found (${strongClaimHits.join(", ")}), but some evidence-pointer signals are present.`,
          hitKeywords: strongClaimHits,
          hitPatterns: [strongClaimHits.length === 0 ? "no-strong-claims" : "claims-with-some-evidence"],
        };
      }

      if (strongClaimHits.length >= 3) {
        return {
          status: "MISSING",
          evidence: `Strong claims are present without supporting evidence pointers: ${strongClaimHits.join(", ")}.`,
          hitKeywords: strongClaimHits,
          hitPatterns: ["unsupported-claims"],
        };
      }

      return {
        status: "PARTIAL",
        evidence: `Some strong claims are not backed by visible evidence pointers: ${strongClaimHits.join(", ")}.`,
        hitKeywords: strongClaimHits,
        hitPatterns: ["partially-supported-claims"],
      };
    }

    case "ph_hosting_model_all_critical_on_aws": {
      if (context.classification.path !== "partner-hosted") {
        return {
          status: "PASS",
          evidence: "Not triggered for the current checklist path.",
          hitKeywords: [],
          hitPatterns: ["not-applicable"],
        };
      }

      const nonAwsCriticalHits = ftrMatchingTerms(text, ["azure", "gcp", "on-prem", "on prem", "datacenter", "data center"]);
      if (nonAwsCriticalHits.length > 0) {
        return {
          status: "MISSING",
          evidence: `Critical hosting appears to be outside AWS or not clearly AWS-only: ${nonAwsCriticalHits.join(", ")}.`,
          hitKeywords: nonAwsCriticalHits,
          hitPatterns: ["non-aws-critical-hosting"],
        };
      }

      if (awsServiceHits.length >= 3) {
        return {
          status: "PASS",
          evidence: "Partner-hosted architecture signals point to AWS-native critical components.",
          hitKeywords: awsServiceHits.slice(0, 4),
          hitPatterns: ["aws-critical-hosting"],
        };
      }

      return {
        status: "PARTIAL",
        evidence: "The package reads as Partner-Hosted, but the component-location story is still too thin to prove that all critical planes run on AWS.",
        hitKeywords: awsServiceHits.slice(0, 3),
        hitPatterns: ["aws-hosting-not-provable"],
      };
    }

    case "ph_support_plan_business_or_action_plan": {
      const supportHits = ftrMatchingTerms(text, FTR_SUPPORT_TERMS);
      const ownerHits = ftrMatchingTerms(text, ["owner", "team", "contact", "escalation", "severity"]);
      if (supportHits.length >= 2 && ownerHits.length > 0) {
        return {
          status: "PASS",
          evidence: ftrSnippet(context.rawText, [...supportHits, ...ownerHits]) ?? "Support coverage and escalation ownership are documented.",
          hitKeywords: [...supportHits, ...ownerHits.slice(0, 2)],
          hitPatterns: ["support-plan"],
        };
      }

      if (supportHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "Support coverage is mentioned, but the escalation plan is incomplete or not tied to owners/production accounts.",
          hitKeywords: supportHits,
          hitPatterns: ["support-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No usable AWS support or escalation-plan signal was found.",
        hitKeywords: [],
        hitPatterns: ["support-missing"],
      };
    }

    case "ph_architecture_review_program": {
      const cadenceHits = ftrMatchingTerms(text, ["annual", "annually", "yearly", "review cadence", "well-architected", "well architected"]);
      const sharedResponsibilityHits = ftrMatchingTerms(text, ["shared responsibility", "partner responsibility", "customer responsibility"]);
      if (cadenceHits.length > 0 && sharedResponsibilityHits.length > 0) {
        return {
          status: "PASS",
          evidence: "Architecture review cadence and shared-responsibility coverage are both documented.",
          hitKeywords: [...cadenceHits, ...sharedResponsibilityHits],
          hitPatterns: ["review-program"],
        };
      }

      if (cadenceHits.length > 0 || sharedResponsibilityHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "The package references either a review cadence or shared responsibility, but not both clearly enough.",
          hitKeywords: [...cadenceHits, ...sharedResponsibilityHits],
          hitPatterns: ["review-program-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No periodic architecture-review program with shared-responsibility coverage was found.",
        hitKeywords: [],
        hitPatterns: ["review-program-missing"],
      };
    }

    case "ph_incident_management_plan_exists": {
      const incidentHits = ftrMatchingTerms(text, FTR_INCIDENT_TERMS);
      const maintenanceHits = ftrMatchingTerms(text, ["updated", "last updated", "revision history", "change log", "review date"]);
      if (incidentHits.length >= 2 && maintenanceHits.length > 0) {
        return {
          status: "PASS",
          evidence: "Incident-plan roles/steps and a maintenance signal are present.",
          hitKeywords: [...incidentHits.slice(0, 4), ...maintenanceHits.slice(0, 2)],
          hitPatterns: ["incident-plan"],
        };
      }

      if (incidentHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "An incident plan is mentioned, but it is still missing either operational detail or a maintenance/update signal.",
          hitKeywords: incidentHits,
          hitPatterns: ["incident-plan-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No usable incident-management plan signal was found.",
        hitKeywords: [],
        hitPatterns: ["incident-plan-missing"],
      };
    }

    case "ph_cis_or_securityhub_report_provided": {
      const reportHits = ftrMatchingTerms(text, ["security hub", "cis benchmark", "cis report", "csv export", "benchmark status", "control findings"]);
      const screenshotHits = ftrMatchingTerms(text, ["screenshot", "screenshots"]);
      if (reportHits.length > 0) {
        return {
          status: "PASS",
          evidence: "Security Hub/CIS evidence is present in the uploaded material.",
          hitKeywords: reportHits,
          hitPatterns: ["securityhub-cis-evidence"],
        };
      }

      if (screenshotHits.length > 0 || strongClaimHits.length === 0) {
        return {
          status: strongClaimHits.length === 0 ? "PASS" : "PARTIAL",
          evidence:
            strongClaimHits.length === 0
              ? "No CIS-linked security posture claim was strong enough to require a structured report in this run."
              : "Security screenshots are mentioned, but there is no structured Security Hub/CIS export.",
          hitKeywords: screenshotHits,
          hitPatterns: [strongClaimHits.length === 0 ? "not-triggered" : "partial-security-evidence"],
        };
      }

      return {
        status: "MISSING",
        evidence: "The package makes strong security-posture claims without a Security Hub/CIS report.",
        hitKeywords: strongClaimHits,
        hitPatterns: ["securityhub-cis-missing"],
      };
    }

    case "ph_no_embedded_credentials": {
      const hardcodeHits = ftrMatchingTerms(text, ["hardcode", "hardcoded", "paste access key", "static iam user", "access key", "secret access key"]);
      const realSecretHits = FTR_SECRET_PATTERNS.filter((pattern) => pattern.test(context.rawText)).map((pattern) => pattern.source);
      const secureDeliveryHits = ftrMatchingTerms(text, ["iam role", "iam roles", "secrets manager", "secret store", "do not hardcode credentials"]);
      if (realSecretHits.length > 0 || hardcodeHits.length > 0) {
        return {
          status: "MISSING",
          evidence: `Credential-hardcoding evidence found: ${[...hardcodeHits, ...realSecretHits].slice(0, 4).join(", ")}.`,
          hitKeywords: [...hardcodeHits, ...realSecretHits],
          hitPatterns: ["embedded-credentials"],
        };
      }

      if (secureDeliveryHits.length > 0) {
        return {
          status: "PASS",
          evidence: "The documents avoid embedded credentials and reference safer delivery patterns.",
          hitKeywords: secureDeliveryHits,
          hitPatterns: ["no-embedded-credentials"],
        };
      }

      return {
        status: "PARTIAL",
        evidence: "No real secret was found, but the docs do not clearly explain how credentials are delivered without hardcoding.",
        hitKeywords: [],
        hitPatterns: ["credential-delivery-unclear"],
      };
    }

    case "ph_secrets_stored_securely": {
      const secureStoreHits = ftrMatchingTerms(text, ["secrets manager", "parameter store", "secret store", "vault"]);
      const encryptionHits = ftrMatchingTerms(text, ["encrypted at rest", "kms", "tls", "encrypted in transit", "access controls", "audit"]);
      const plaintextHits = ftrMatchingTerms(text, ["plaintext", "plain text", ".env file", "config file", "hardcoded"]);
      if (plaintextHits.length > 0) {
        return {
          status: "MISSING",
          evidence: `Secrets appear to be stored or described insecurely: ${plaintextHits.join(", ")}.`,
          hitKeywords: plaintextHits,
          hitPatterns: ["plaintext-secrets"],
        };
      }

      if (secureStoreHits.length > 0 && encryptionHits.length > 0) {
        return {
          status: "PASS",
          evidence: "A centralized secret-store approach plus encryption/access-control language is present.",
          hitKeywords: [...secureStoreHits, ...encryptionHits.slice(0, 2)],
          hitPatterns: ["secure-secrets"],
        };
      }

      if (secureStoreHits.length > 0 || encryptionHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "Some secure-secret-handling language exists, but it does not fully explain storage, encryption, and access controls together.",
          hitKeywords: [...secureStoreHits, ...encryptionHits],
          hitPatterns: ["partial-secret-story"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No clear secure-secret-storage approach was found.",
        hitKeywords: [],
        hitPatterns: ["secret-story-missing"],
      };
    }

    case "ph_network_security_no_open_ssh_rdp": {
      const restrictedHits = ftrMatchingTerms(text, ["security hub", "cis", "restricted", "no unrestricted", "session manager", "vpn"]);
      const openAdminHits = ftrMatchingTerms(text, ["0.0.0.0/0", "open ssh", "open rdp", "22/tcp", "3389", "allow ssh from anywhere", "allow rdp from anywhere"]);
      if (openAdminHits.length > 0) {
        return {
          status: "MISSING",
          evidence: `The package suggests unrestricted admin-port exposure: ${openAdminHits.join(", ")}.`,
          hitKeywords: openAdminHits,
          hitPatterns: ["open-admin-ports"],
        };
      }

      if (restrictedHits.length > 0) {
        return {
          status: "PASS",
          evidence: "Admin-access language points to restricted access or benchmark evidence.",
          hitKeywords: restrictedHits,
          hitPatterns: ["restricted-admin-access"],
        };
      }

      return {
        status: "PARTIAL",
        evidence: "I did not find a hard failure, but there is not enough structured evidence to prove 22/3389 are restricted.",
        hitKeywords: [],
        hitPatterns: ["admin-access-not-provable"],
      };
    }

    case "ph_backups_and_restore_testing": {
      const backupHits = ftrMatchingTerms(text, FTR_BACKUP_TERMS);
      const restoreTestHits = ftrMatchingTerms(text, ["restore test", "recovery test", "test record", "restored successfully", "drill"]);
      if (backupHits.length > 0 && restoreTestHits.length > 0) {
        return {
          status: "PASS",
          evidence: "Backups and restore/recovery testing are both described.",
          hitKeywords: [...backupHits.slice(0, 3), ...restoreTestHits.slice(0, 2)],
          hitPatterns: ["backup-and-restore-test"],
        };
      }

      if (backupHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "Backups are documented, but restore-testing evidence is missing or too thin.",
          hitKeywords: backupHits,
          hitPatterns: ["backup-without-restore-test"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No documented backup-and-restore story was found for stateful data.",
        hitKeywords: [],
        hitPatterns: ["backup-story-missing"],
      };
    }

    case "ph_recovery_objectives_and_resilience_test": {
      const objectiveHits = ftrMatchingTerms(text, ["rto", "rpo", "recovery time objective", "recovery point objective"]);
      const testHits = ftrMatchingTerms(text, ["resilience test", "failover test", "dr drill", "game day", "recovery test"]);
      if (objectiveHits.length >= 2 && testHits.length > 0) {
        return {
          status: "PASS",
          evidence: "RTO/RPO and resilience-testing evidence are both present.",
          hitKeywords: [...objectiveHits, ...testHits.slice(0, 2)],
          hitPatterns: ["rto-rpo-and-test"],
        };
      }

      if (objectiveHits.length > 0 || testHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "The package mentions either recovery objectives or resilience testing, but not both with enough specificity.",
          hitKeywords: [...objectiveHits, ...testHits],
          hitPatterns: ["rto-rpo-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No reliable RTO/RPO plus resilience-testing evidence was found.",
        hitKeywords: [],
        hitPatterns: ["rto-rpo-missing"],
      };
    }

    case "ph_cross_account_access_controls": {
      const crossAccountHits = ftrMatchingTerms(text, FTR_CROSS_ACCOUNT_TERMS);
      const staticCredHits = ftrMatchingTerms(text, ["static iam user", "access key", "secret access key", "customer-provided credentials"]);
      if (staticCredHits.length > 0) {
        return {
          status: "MISSING",
          evidence: `Cross-account integration appears to rely on static credentials: ${staticCredHits.join(", ")}.`,
          hitKeywords: staticCredHits,
          hitPatterns: ["static-cross-account-creds"],
        };
      }

      if (crossAccountHits.length === 0) {
        return {
          status: "PASS",
          evidence: "No cross-account integration signal was detected, so this conditional control was not triggered in this run.",
          hitKeywords: [],
          hitPatterns: ["not-triggered"],
        };
      }

      const roleHits = ftrMatchingTerms(text, ["assume role", "assumerole", "web identity", "role"]);
      const confusedDeputyHits = ftrMatchingTerms(text, ["external id", "issuer url"]);
      if (roleHits.length > 0 && confusedDeputyHits.length > 0) {
        return {
          status: "PASS",
          evidence: "Cross-account role usage plus external-ID/issuer protections are described.",
          hitKeywords: [...roleHits.slice(0, 3), ...confusedDeputyHits],
          hitPatterns: ["cross-account-protected"],
        };
      }

      return {
        status: "PARTIAL",
        evidence: "Cross-account access is mentioned, but the docs do not fully explain external-ID/issuer protections or least-privilege setup.",
        hitKeywords: crossAccountHits,
        hitPatterns: ["cross-account-partial"],
      };
    }

    case "cd_intro_use_cases_present": {
      const useCaseHits = ftrMatchingTerms(text, ["use case", "use cases", "customer scenario", "example workflow"]);
      const pointerPresent = ftrHasEvidencePointer(text);
      if (useCaseHits.length > 0 && pointerPresent) {
        return {
          status: "PASS",
          evidence: "Use-case content and evidence-pointer signals are present.",
          hitKeywords: useCaseHits,
          hitPatterns: ["use-cases-with-pointers"],
        };
      }

      if (useCaseHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "Use cases are described, but the supporting document pointers are weak or missing.",
          hitKeywords: useCaseHits,
          hitPatterns: ["use-cases-without-pointers"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No clear deployment-guide use-case section was found.",
        hitKeywords: [],
        hitPatterns: ["use-cases-missing"],
      };
    }

    case "cd_intro_deployment_overview_and_resources": {
      const overviewHits = ftrMatchingTerms(text, ["deployment overview", "deployment architecture", "resources created", "resource list", "aws resources"]);
      if (overviewHits.length >= 2 && awsServiceHits.length >= 3) {
        return {
          status: "PASS",
          evidence: "Deployment overview language plus a concrete AWS resource list are present.",
          hitKeywords: [...overviewHits.slice(0, 3), ...awsServiceHits.slice(0, 4)],
          hitPatterns: ["deployment-overview-and-resources"],
        };
      }

      if (overviewHits.length > 0 || awsServiceHits.length >= 2) {
        return {
          status: "PARTIAL",
          evidence: "The docs mention deployment or resources, but they do not yet read like a concrete, reviewer-ready resource inventory.",
          hitKeywords: [...overviewHits, ...awsServiceHits.slice(0, 3)],
          hitPatterns: ["deployment-overview-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No concrete deployment-overview section or AWS resource inventory was found.",
        hitKeywords: [],
        hitPatterns: ["deployment-overview-missing"],
      };
    }

    case "cd_arch_diagrams_complete_and_use_aws_icons": {
      const iconHits = ftrMatchingTerms(text, ["aws icon", "aws icons", "architecture icons", "icon legend", "legend"]);
      const networkHits = ftrMatchingTerms(text, ["vpc", "subnet", "public subnet", "private subnet"]);
      const integrationHits = ftrMatchingTerms(text, ["integration", "connects to", "third-party", "third party"]);
      if (diagramHits.length > 0 && awsServiceHits.length >= 2 && networkHits.length > 0 && integrationHits.length > 0 && iconHits.length > 0) {
        return {
          status: "PASS",
          evidence: "Customer-Deployed diagrams cover AWS resources, networking, integrations, and AWS-icon usage.",
          hitKeywords: [...awsServiceHits.slice(0, 3), ...networkHits.slice(0, 2), ...iconHits.slice(0, 1)],
          hitPatterns: ["customer-deployed-diagram-complete"],
        };
      }

      if (diagramHits.length > 0 && awsServiceHits.length >= 2) {
        return {
          status: "PARTIAL",
          evidence: "Diagrams exist and reference AWS services, but they are still missing one or more required elements such as VPC/subnets, integrations, or AWS-icon usage.",
          hitKeywords: [...diagramHits.slice(0, 2), ...awsServiceHits.slice(0, 3)],
          hitPatterns: ["customer-deployed-diagram-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "Customer-Deployed diagram requirements are not met: the diagrams are missing or too incomplete for FTR review.",
        hitKeywords: [...diagramHits.slice(0, 2), ...awsServiceHits.slice(0, 2)],
        hitPatterns: ["customer-deployed-diagram-missing"],
      };
    }

    case "cd_security_no_root_and_least_privilege_guidance": {
      const rootWarningHits = ftrMatchingTerms(text, [
        "do not use root",
        "never use root",
        "root is not required",
        "root account should not be used",
        "not use the root account",
        "do not use the root account",
      ]);
      const leastPrivilegeHits = ftrMatchingTerms(text, ["least privilege", "scoped actions", "scoped resources", "conditions", "iam role"]);
      const rootRequirementHits = ftrMatchingTerms(text, ["run as root", "requires root", "log in as root"]);
      if (rootRequirementHits.length > 0) {
        return {
          status: "MISSING",
          evidence: `The deployment guidance appears to require root usage: ${rootRequirementHits.join(", ")}.`,
          hitKeywords: rootRequirementHits,
          hitPatterns: ["root-required"],
        };
      }

      if (rootWarningHits.length > 0 && leastPrivilegeHits.length > 0) {
        return {
          status: "PASS",
          evidence: "The guide warns against root use and includes least-privilege deployment guidance.",
          hitKeywords: [...rootWarningHits, ...leastPrivilegeHits.slice(0, 3)],
          hitPatterns: ["root-warning-and-lp"],
        };
      }

      if (rootWarningHits.length > 0 || leastPrivilegeHits.length > 0) {
        return {
          status: "PARTIAL",
          evidence: "The guide covers either root-account avoidance or least privilege, but not both strongly enough.",
          hitKeywords: [...rootWarningHits, ...leastPrivilegeHits],
          hitPatterns: ["root-or-lp-partial"],
        };
      }

      return {
        status: "MISSING",
        evidence: "No root-account warning or usable least-privilege guidance was found in the deployment instructions.",
        hitKeywords: [],
        hitPatterns: ["root-and-lp-missing"],
      };
    }

    default:
      return {
        status: "MISSING",
        evidence: null,
        hitKeywords: [],
        hitPatterns: [],
      };
  }
}

function summarizeFtrScore(score: number, hasConsultationBlocker: boolean) {
  if (hasConsultationBlocker || score < 60) {
    return "Not FTR-ready. The package is incomplete, contradictory, or high-risk enough that it is not safely validateable from the uploaded material.";
  }

  if (score >= 90) {
    return "Strong FTR package. The checklist path is clear, the documents are internally consistent, and the remaining issues are polish or small evidence gaps.";
  }

  return "Partially FTR-ready pending documentation-bounded remediation. The package is mostly coherent, but the evidence pack still needs tighter pointers, clearer operating detail, or stronger reviewer-facing structure.";
}

function buildFtrValidationReport(input: {
  rawText: string;
  context: ReportContext;
  target?: ValidationTargetContext;
  controlCalibration?: ValidationReport["controlCalibration"];
}): ValidationReport {
  const normalizedText = input.rawText.toLowerCase();
  const wordCount = input.rawText.trim() ? input.rawText.trim().split(/\s+/).length : 0;
  const classification = classifyFtrChecklistPath({
    normalizedText,
    target: input.target,
    additionalContext: input.context.additionalContext?.toLowerCase(),
  });

  const evaluationContext: FtrEvaluationContext = {
    rawText: input.rawText,
    normalizedText,
    filenameLower: input.context.filename.toLowerCase(),
    sourceType: input.context.sourceType,
    target: input.target,
    classification,
    controlCalibration: input.controlCalibration,
    additionalContext: input.context.additionalContext?.toLowerCase(),
  };

  const activeRuleIds = [
    ...FTR_LAUNCH_V1_CORE_RULE_IDS,
    ...(classification.path === "partner-hosted"
      ? FTR_LAUNCH_V1_PARTNER_HOSTED_RULE_IDS
      : classification.path === "customer-deployed"
        ? FTR_LAUNCH_V1_CUSTOMER_DEPLOYED_RULE_IDS
        : []),
  ];

  const checks = activeRuleIds.map((ruleId) => {
    const rule = FTR_LAUNCH_V1_RULES_BY_ID.get(ruleId);
    if (!rule) {
      throw new Error(`Missing FTR launch-v1 rule: ${ruleId}`);
    }

    const evaluation = buildFtrRuleEvaluation(ruleId, evaluationContext);
    return {
      id: rule.id,
      title: rule.control_name,
      description: rule.description,
      status: evaluation.status,
      severity: ftrSeverityForRule(rule.id),
      weight: rule.score_weight,
      hitKeywords: evaluation.hitKeywords,
      hitPatterns: evaluation.hitPatterns,
      evidence: evaluation.evidence,
      guidance: rule.remediation_summary,
      officialSourceLinks: normalizeReferenceUrls(rule.official_source_links),
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
  const scoreNumerator = checks.reduce((sum, check) => sum + ftrStatusPoints(check.id, check.status), 0);
  const score = totalWeight > 0 ? Math.round((scoreNumerator / totalWeight) * 100) : 0;
  const hasConsultationBlocker = checks.some(
    (check) => check.status === "MISSING" && FTR_LAUNCH_V1_RULES_BY_ID.get(check.id)?.estimate_policy_band === "consultation_only",
  );

  const topGaps = checks
    .filter((check) => check.status !== "PASS")
    .sort((left, right) => {
      const consultationDelta =
        Number(FTR_LAUNCH_V1_RULES_BY_ID.get(right.id)?.estimate_policy_band === "consultation_only") -
        Number(FTR_LAUNCH_V1_RULES_BY_ID.get(left.id)?.estimate_policy_band === "consultation_only");
      if (consultationDelta !== 0) {
        return consultationDelta;
      }

      const statusDelta = ftrStatusRank(right.status as ValidationCheckStatus) - ftrStatusRank(left.status as ValidationCheckStatus);
      if (statusDelta !== 0) {
        return statusDelta;
      }

      return right.weight - left.weight;
    })
    .slice(0, 5)
    .map((check) => `${check.title}: ${check.guidance}`);

  if (input.context.additionalContext?.trim()) {
    topGaps.push(`Context note reviewed: ${input.context.additionalContext.trim().slice(0, 180)}`);
  }

  const processingNotes = [...(input.context.processingNotes ?? [])];
  processingNotes.push(`Launch-v1 FTR scoring used the ${FTR_LAUNCH_V1_CHECKLIST_WINDOW}.`);

  if (classification.confidence === "probable") {
    processingNotes.push(`Checklist path inferred as ${classification.path} from target/context because the documents did not state it explicitly.`);
  } else if (classification.confidence === "conflicted") {
    processingNotes.push("Checklist path signals conflicted across the uploaded material.");
  } else if (classification.confidence === "unknown") {
    processingNotes.push("Checklist path could not be classified from the uploaded material.");
  }

  return {
    profile: "FTR",
    profileLabel: "FTR",
    overview: "Foundational technical readiness review for AWS FTR document readiness.",
    score,
    counts,
    summary: summarizeFtrScore(score, hasConsultationBlocker),
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
      id: input.target ? `ftr::launch-v1::${input.target.id}` : `ftr::launch-v1::${classification.path}`,
      version: RULEPACK_VERSION,
      ruleCount: checks.length,
    },
    processingNotes,
    controlCalibration: input.controlCalibration,
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
}

export function buildValidationReport(input: {
  profile: ValidationProfile;
  rawText: string;
  context: ReportContext;
  target?: ValidationTargetContext;
  controlCalibration?: ValidationReport["controlCalibration"];
}) {
  if (input.profile === "FTR") {
    return buildFtrValidationReport({
      rawText: input.rawText,
      context: input.context,
      target: input.target,
      controlCalibration: input.controlCalibration,
    });
  }

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
    controlCalibration: input.controlCalibration,
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
