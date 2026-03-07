import type { ArchitectureEvidenceBundle, ArchitectureFindingDraft, ArchitectureProvider } from "@/lib/architecture-review/types";

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesTerm(text: string, term: string) {
  if (!term.trim()) {
    return false;
  }

  if (/\s/.test(term) || term.includes("-") || term.includes("/")) {
    return text.includes(term);
  }

  const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
  return pattern.test(text);
}

const PROVIDER_TOKENS: Record<ArchitectureProvider, string[]> = {
  aws: [
    "api gateway",
    "lambda",
    "ec2",
    "eks",
    "ecs",
    "fargate",
    "alb",
    "nlb",
    "route 53",
    "cloudfront",
    "rds",
    "aurora",
    "dynamodb",
    "s3",
    "sqs",
    "sns",
    "eventbridge",
    "step functions",
    "cloudwatch",
    "x-ray",
    "iam",
    "kms",
    "waf",
    "secrets manager",
    "vpc",
  ],
  azure: [
    "application gateway",
    "front door",
    "app service",
    "functions",
    "aks",
    "vm scale set",
    "virtual machine",
    "entra",
    "azure ad",
    "managed identity",
    "key vault",
    "storage account",
    "service bus",
    "event hub",
    "event grid",
    "logic app",
    "cosmos db",
    "sql database",
    "azure monitor",
    "log analytics",
    "application insights",
    "traffic manager",
    "private endpoint",
    "vnet",
    "nsg",
  ],
  gcp: [
    "cloud run",
    "gke",
    "compute engine",
    "cloud load balancing",
    "api gateway",
    "cloud armor",
    "cloud cdn",
    "cloud storage",
    "bigquery",
    "spanner",
    "cloud sql",
    "pub/sub",
    "cloud tasks",
    "dataflow",
    "cloud functions",
    "workflows",
    "cloud monitoring",
    "cloud logging",
    "service account",
    "cloud kms",
    "secret manager",
    "vpc",
    "iap",
    "filestore",
  ],
};

const GENERIC_TOKENS = [
  "load balancer",
  "cache",
  "database",
  "queue",
  "stream",
  "cdn",
  "firewall",
  "waf",
  "backup",
  "replica",
  "monitoring",
  "logging",
  "runbook",
  "dr",
  "disaster recovery",
  "autoscale",
  "encryption",
  "iam",
  "auth",
  "api",
  "gateway",
  "worker",
  "scheduler",
];

const NON_ARCHITECTURE_OCR_TERMS = [
  "tradeline",
  "tradelines",
  "debt",
  "unsecured debt",
  "creditor",
  "utilization",
  "account number",
  "statement",
  "billing",
  "balance",
  "loan",
  "card",
  "apr",
  "minimum payment",
  "payment due",
  "invoice",
  "subtotal",
  "interest charge",
  "fico",
  "credit score",
];

const ARCHITECTURE_OCR_TERMS = [
  "architecture",
  "diagram",
  "service",
  "api",
  "gateway",
  "ingress",
  "egress",
  "queue",
  "topic",
  "database",
  "cache",
  "vpc",
  "subnet",
  "firewall",
  "cdn",
  "load balancer",
  "kubernetes",
  "cluster",
  "pod",
  "microservice",
];

const OFFICIAL_REFERENCE_TERMS = [
  "microsoft azure",
  "amazon web services",
  "aws reference architecture",
  "azure architecture center",
  "cloud architecture center",
  "learn.microsoft.com",
  "aws architecture icons",
  "google cloud architecture framework",
  "reference architecture",
  "example architecture",
];

const PILLAR_KEYWORDS: Record<ArchitectureProvider, Record<string, string[]>> = {
  aws: {
    security: ["iam", "least privilege", "kms", "encryption", "waf", "auth", "secret"],
    reliability: ["multi-az", "multi az", "dr", "disaster recovery", "failover", "backup", "rto", "rpo"],
    operations: ["cloudwatch", "monitor", "logging", "alert", "runbook", "incident", "trace"],
    performance: ["cache", "cdn", "autoscale", "latency", "throughput", "load balancer"],
    cost: ["rightsiz", "cost", "budget", "autoscale", "reserved", "spot", "finops"],
    sustainability: ["sustainability", "carbon", "energy", "efficiency"],
  },
  azure: {
    security: ["entra", "azure ad", "rbac", "managed identity", "key vault", "encryption", "auth"],
    reliability: ["availability zone", "paired region", "dr", "backup", "replica", "failover", "rto", "rpo"],
    operations: ["azure monitor", "log analytics", "application insights", "monitor", "alert", "runbook"],
    performance: ["cache", "cdn", "autoscale", "latency", "throughput", "front door"],
    cost: ["cost", "budget", "rightsiz", "autoscale", "reserved", "finops"],
    sustainability: ["sustainability", "carbon", "energy", "efficiency"],
  },
  gcp: {
    security: ["iam", "service account", "cloud kms", "secret manager", "encryption", "auth", "iap"],
    reliability: ["multi-region", "zone", "dr", "backup", "failover", "replica", "rto", "rpo"],
    operations: ["cloud monitoring", "cloud logging", "monitor", "alert", "runbook", "incident", "trace"],
    performance: ["cache", "cdn", "autoscale", "latency", "throughput", "load balancing"],
    cost: ["cost", "budget", "rightsiz", "autoscale", "committed use", "finops"],
    sustainability: ["sustainability", "carbon", "energy", "efficiency"],
  },
};

const PROVIDER_SIGNAL_TOKENS: Record<ArchitectureProvider, string[]> = {
  aws: ["ec2", "lambda", "cloudfront", "route 53", "iam", "vpc", "rds", "dynamodb", "s3", "cloudwatch"],
  azure: [
    "entra",
    "azure ad",
    "vnet",
    "app service",
    "key vault",
    "log analytics",
    "application gateway",
    "front door",
    "sql database",
  ],
  gcp: [
    "cloud run",
    "gke",
    "cloud sql",
    "cloud storage",
    "cloud armor",
    "iap",
    "pub/sub",
    "bigquery",
    "spanner",
  ],
};

const STATEFUL_SERVICE_HINTS = [
  "database",
  "rds",
  "aurora",
  "dynamodb",
  "sql",
  "cosmos db",
  "spanner",
  "cloud sql",
  "storage",
  "s3",
  "cloud storage",
  "bigquery",
  "filestore",
];

function compressWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function providerMismatchRuleId(provider: ArchitectureProvider) {
  if (provider === "aws") {
    return "AWS-PROVIDER-MISMATCH";
  }

  if (provider === "azure") {
    return "AZURE-PROVIDER-MISMATCH";
  }

  return "GCP-PROVIDER-MISMATCH";
}

function isLowSignalParagraph(text: string) {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean);

  if (words.length < 8) {
    return true;
  }

  const alphaWords = words.filter((word) => /[a-z]/.test(word));
  if (alphaWords.length < 6) {
    return true;
  }

  const vowelHeavyRatio =
    alphaWords.filter((word) => /[aeiou]/.test(word)).length / Math.max(1, alphaWords.length);
  return vowelHeavyRatio < 0.45;
}

function detectInputTypeSignals(bundle: ArchitectureEvidenceBundle) {
  const normalizedOcr = bundle.ocrText.toLowerCase();
  const normalizedParagraph = bundle.paragraph.toLowerCase();
  const nonArchitectureHits = NON_ARCHITECTURE_OCR_TERMS.filter((term) => includesTerm(normalizedOcr, term)).length;
  const architectureHits =
    ARCHITECTURE_OCR_TERMS.filter((term) => includesTerm(normalizedOcr, term)).length +
    Math.min(6, bundle.serviceTokens.length);
  const architectureInParagraph = ARCHITECTURE_OCR_TERMS.filter((term) => includesTerm(normalizedParagraph, term)).length;
  const hasCurrencyValues = /\$ ?\d/.test(bundle.ocrText);

  const likelyNonArchitecture =
    nonArchitectureHits >= 3 &&
    architectureHits <= 4 &&
    (hasCurrencyValues || architectureInParagraph >= 2 || bundle.serviceTokens.length === 0);

  const highConfidenceNonArchitecture =
    nonArchitectureHits >= 5 &&
    architectureHits <= 3 &&
    (hasCurrencyValues || normalizedOcr.includes("account number"));

  const uncertainNonArchitecture =
    !highConfidenceNonArchitecture &&
    nonArchitectureHits >= 2 &&
    architectureHits <= 5 &&
    (hasCurrencyValues || architectureInParagraph >= 1);

  return {
    likelyNonArchitecture,
    highConfidenceNonArchitecture,
    uncertainNonArchitecture,
    nonArchitectureHits,
    architectureHits,
    hasCurrencyValues,
  };
}

export function detectNonArchitectureEvidence(bundle: ArchitectureEvidenceBundle) {
  const signals = detectInputTypeSignals(bundle);

  if (signals.highConfidenceNonArchitecture) {
    return {
      likely: true,
      confidence: "high" as const,
      reason: `OCR matched ${signals.nonArchitectureHits} non-architecture terms and only ${signals.architectureHits} architecture indicators.`,
    };
  }

  if (signals.uncertainNonArchitecture || signals.likelyNonArchitecture) {
    return {
      likely: true,
      confidence: "medium" as const,
      reason: `OCR matched mixed signals (${signals.nonArchitectureHits} non-architecture vs ${signals.architectureHits} architecture indicators).`,
    };
  }

  return {
    likely: false,
    confidence: "low" as const,
    reason: `OCR matched ${signals.architectureHits} architecture indicators.`,
  };
}

export function extractServiceTokens(provider: ArchitectureProvider, text: string) {
  const source = compressWhitespace(text.toLowerCase());
  const tokens = [...PROVIDER_TOKENS[provider], ...GENERIC_TOKENS];
  const matched = new Set<string>();

  for (const token of tokens) {
    if (includesTerm(source, token.toLowerCase())) {
      matched.add(token);
    }
  }

  return [...matched].sort((a, b) => a.localeCompare(b));
}

function countMentionedTokensInParagraph(tokens: string[], paragraph: string) {
  const normalized = paragraph.toLowerCase();
  return tokens.filter((token) => includesTerm(normalized, token.toLowerCase())).length;
}

function detectProviderSignalCounts(text: string) {
  const normalized = text.toLowerCase();
  return {
    aws: PROVIDER_SIGNAL_TOKENS.aws.filter((token) => includesTerm(normalized, token)).length,
    azure: PROVIDER_SIGNAL_TOKENS.azure.filter((token) => includesTerm(normalized, token)).length,
    gcp: PROVIDER_SIGNAL_TOKENS.gcp.filter((token) => includesTerm(normalized, token)).length,
  };
}

function hasDirectionality(text: string) {
  const directionTerms = [
    "->",
    "flow",
    "routes to",
    "sends",
    "receives",
    "publishes",
    "subscribes",
    "calls",
    "request",
    "response",
    "ingests",
    "writes to",
    "reads from",
    "async",
    "sync",
  ];

  const normalized = text.toLowerCase();
  return directionTerms.some((term) => normalized.includes(term));
}

function isDetailedParagraph(text: string) {
  const normalized = text.trim();
  if (normalized.length >= 280) {
    return true;
  }

  const directionalMatches = normalized.match(/\b(sends|reads|writes|routes|publishes|subscribes|stores|calls)\b/gi) ?? [];
  return directionalMatches.length >= 3;
}

function collectArrowSemantics(text: string) {
  const semantics: Array<{ id: string; terms: string[] }> = [
    { id: "async", terms: ["async", "asynchronous"] },
    { id: "sync", terms: ["sync", "synchronous"] },
    { id: "batch", terms: ["batch", "nightly"] },
    { id: "stream", terms: ["stream", "streaming"] },
    { id: "event", terms: ["event", "pub/sub", "publish", "subscribe"] },
  ];

  const normalized = text.toLowerCase();
  return semantics
    .filter((entry) => entry.terms.some((term) => normalized.includes(term)))
    .map((entry) => entry.id);
}

function hasStatefulSignals(bundle: ArchitectureEvidenceBundle) {
  const normalizedTokens = bundle.serviceTokens.map((token) => token.toLowerCase());
  if (normalizedTokens.some((token) => STATEFUL_SERVICE_HINTS.some((hint) => token.includes(hint)))) {
    return true;
  }

  const normalizedText = `${bundle.paragraph}\n${bundle.ocrText}`.toLowerCase();
  return STATEFUL_SERVICE_HINTS.some((hint) => includesTerm(normalizedText, hint));
}

function monthsSinceIsoDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    return 0;
  }

  return diffMs / (1000 * 60 * 60 * 24 * 30.4375);
}

function detectOfficialReferencePattern(bundle: ArchitectureEvidenceBundle) {
  const normalized = `${bundle.ocrText}\n${bundle.paragraph}`.toLowerCase();
  const markerHits = OFFICIAL_REFERENCE_TERMS.filter((term) => includesTerm(normalized, term)).length;
  return markerHits >= 1 && bundle.serviceTokens.length >= 6;
}

function addMetadataFindings(bundle: ArchitectureEvidenceBundle, findings: ArchitectureFindingDraft[]) {
  const fields: Array<{
    key: keyof ArchitectureEvidenceBundle["metadata"];
    ruleId: string;
    message: string;
    fix: string;
  }> = [
    {
      key: "title",
      ruleId: "MSFT-META-TITLE",
      message: "Add a title that states the workload and scope.",
      fix: "Set title metadata like 'Payments API Production Architecture'.",
    },
    {
      key: "owner",
      ruleId: "MSFT-META-OWNER",
      message: "Add the owner responsible for this architecture.",
      fix: "Set owner metadata with team or role and contact alias.",
    },
    {
      key: "lastUpdated",
      ruleId: "MSFT-META-LAST-UPDATED",
      message: "Add the date this diagram was last reviewed.",
      fix: "Set last-updated metadata with an ISO date.",
    },
    {
      key: "version",
      ruleId: "MSFT-META-VERSION",
      message: "Add a diagram version identifier.",
      fix: "Set version metadata like v1.2 and increment on edits.",
    },
  ];

  for (const field of fields) {
    const value = bundle.metadata[field.key];
    if (!value || !value.trim()) {
      findings.push({
        ruleId: field.ruleId,
        category: "clarity",
        pointsDeducted: 3,
        message: field.message,
        fix: field.fix,
        evidence: `${field.key} metadata is missing.`,
      });
    }
  }
}

function addPillarFindings(bundle: ArchitectureEvidenceBundle, findings: ArchitectureFindingDraft[]) {
  const normalized = bundle.paragraph.toLowerCase();
  const keywordMap = PILLAR_KEYWORDS[bundle.provider];

  const pillarConfig: Array<{
    key: keyof typeof keywordMap;
    category: ArchitectureFindingDraft["category"];
    maxDeduction: number;
    ruleId: string;
    missingMessage: string;
    missingFix: string;
  }> = [
    {
      key: "security",
      category: "security",
      maxDeduction: 12,
      ruleId: "PILLAR-SECURITY",
      missingMessage: "Document security controls for identity, secrets, and encryption.",
      missingFix: "Name IAM/auth controls, encryption boundaries, and secret-management steps.",
    },
    {
      key: "reliability",
      category: "reliability",
      maxDeduction: 10,
      ruleId: "PILLAR-RELIABILITY",
      missingMessage: "Specify reliability controls for failure and recovery.",
      missingFix: "Describe redundancy, backup/restore, and DR targets (RTO/RPO).",
    },
    {
      key: "operations",
      category: "operations",
      maxDeduction: 8,
      ruleId: "PILLAR-OPERATIONS",
      missingMessage: "Define monitoring and operational ownership.",
      missingFix: "Add metrics, alerts, logs, and runbook ownership for this flow.",
    },
    {
      key: "performance",
      category: "performance",
      maxDeduction: 6,
      ruleId: "PILLAR-PERFORMANCE",
      missingMessage: "Define performance mechanisms for latency and throughput.",
      missingFix: "Call out caching, autoscaling, CDN, or load-balancing strategy.",
    },
    {
      key: "cost",
      category: "cost",
      maxDeduction: 6,
      ruleId: "PILLAR-COST",
      missingMessage: "Define cost controls for this architecture.",
      missingFix: "Describe rightsizing, autoscaling bounds, and budget guardrails.",
    },
  ];

  for (const pillar of pillarConfig) {
    const matches = keywordMap[pillar.key].filter((term) => normalized.includes(term));
    if (matches.length === 0) {
      findings.push({
        ruleId: pillar.ruleId,
        category: pillar.category,
        pointsDeducted: pillar.maxDeduction,
        message: pillar.missingMessage,
        fix: pillar.missingFix,
        evidence: `${pillar.key} keywords were not found in the narrative paragraph.`,
      });
    } else if (matches.length === 1 && pillar.maxDeduction >= 8) {
      findings.push({
        ruleId: `${pillar.ruleId}-DEPTH`,
        category: pillar.category,
        pointsDeducted: Math.max(2, Math.floor(pillar.maxDeduction / 2)),
        message: `Increase ${pillar.key} detail with concrete mechanisms.`,
        fix: `Add at least two explicit ${pillar.key} controls and where they apply in the flow.`,
        evidence: `Only one ${pillar.key} indicator found: ${matches[0]}.`,
      });
    }
  }

  const sustainabilityMatches = keywordMap.sustainability.filter((term) => normalized.includes(term));
  if (sustainabilityMatches.length === 0) {
    findings.push({
      ruleId: "PILLAR-SUSTAINABILITY-OPTIONAL",
      category: "sustainability",
      pointsDeducted: 0,
      message: "Optionally document sustainability targets.",
      fix: "Add region and efficiency choices only if sustainability is part of project goals.",
      evidence: "No sustainability terms found; recommendation is optional.",
    });
  }
}

function capFindingPoints(findings: ArchitectureFindingDraft[], ruleId: string, maxPoints: number) {
  const target = findings.find((finding) => finding.ruleId === ruleId);
  if (!target) {
    return;
  }

  target.pointsDeducted = Math.min(target.pointsDeducted, maxPoints);
}

function capFindingGroupTotal(findings: ArchitectureFindingDraft[], ruleIds: string[], maxTotal: number) {
  const targets = findings.filter((finding) => ruleIds.includes(finding.ruleId) && finding.pointsDeducted > 0);
  const total = targets.reduce((sum, finding) => sum + finding.pointsDeducted, 0);
  if (total <= maxTotal) {
    return;
  }

  let overflow = total - maxTotal;
  for (const finding of targets.sort((a, b) => b.pointsDeducted - a.pointsDeducted)) {
    if (overflow <= 0) {
      break;
    }

    const reducible = Math.max(0, finding.pointsDeducted - 1);
    if (reducible <= 0) {
      continue;
    }

    const reduction = Math.min(reducible, overflow);
    finding.pointsDeducted -= reduction;
    overflow -= reduction;
  }
}

function applyScoringCalibrations(bundle: ArchitectureEvidenceBundle, findings: ArchitectureFindingDraft[]) {
  const ocrSignalStrong = bundle.serviceTokens.length >= 8 || bundle.ocrText.length >= 280;
  const paragraphDetailed = isDetailedParagraph(bundle.paragraph);
  const officialReferencePattern = detectOfficialReferencePattern(bundle);

  // Avoid over-penalizing short user text when diagram OCR is strong.
  if (ocrSignalStrong) {
    capFindingPoints(findings, "INPUT-PARAGRAPH-QUALITY", 3);
  }

  // Avoid over-penalizing sparse OCR when user provides a detailed architecture narrative.
  if (paragraphDetailed) {
    capFindingPoints(findings, "MSFT-COMPONENT-LABEL-COVERAGE", 4);
    capFindingPoints(findings, "MSFT-FLOW-DIRECTION", 3);
  }

  // Prevent double-penalizing same clarity gap.
  capFindingGroupTotal(
    findings,
    ["MSFT-FLOW-DIRECTION", "CLAR-REL-LABELS-MISSING", "CLAR-BOUNDARY-EXPLICIT"],
    10,
  );
  capFindingGroupTotal(
    findings,
    ["REL-RTO-RPO-MISSING", "REL-BACKUP-RESTORE", "PILLAR-RELIABILITY", "PILLAR-RELIABILITY-DEPTH"],
    14,
  );

  // Reference diagrams often omit ownership metadata by design; soften these penalties.
  if (officialReferencePattern) {
    for (const ruleId of ["MSFT-META-TITLE", "MSFT-META-OWNER", "MSFT-META-LAST-UPDATED", "MSFT-META-VERSION"]) {
      capFindingPoints(findings, ruleId, 1);
    }
    capFindingPoints(findings, "MSFT-COMPONENT-LABEL-COVERAGE", 4);
    capFindingPoints(findings, "CLAR-BOUNDARY-EXPLICIT", 2);

    findings.push({
      ruleId: "CLAR-OFFICIAL-REFERENCE-PATTERN",
      category: "clarity",
      pointsDeducted: 0,
      message: "Reference diagram pattern detected; score calibration was softened.",
      fix: "Add local environment labels and ownership metadata before using this in production reviews.",
      evidence: "Official reference markers detected in OCR/narrative content.",
    });
  }
}

export function buildDeterministicReviewFindings(bundle: ArchitectureEvidenceBundle): ArchitectureFindingDraft[] {
  const findings: ArchitectureFindingDraft[] = [];
  const combinedNarrativeText = `${bundle.paragraph}\n${bundle.ocrText}`;
  const normalizedParagraph = compressWhitespace(bundle.paragraph);
  const normalizedCombinedText = combinedNarrativeText.toLowerCase();
  const inputSignals = detectInputTypeSignals(bundle);
  const providerSignalCounts = detectProviderSignalCounts(combinedNarrativeText);
  const tokenCount = bundle.serviceTokens.length;

  if (inputSignals.highConfidenceNonArchitecture) {
    findings.push({
      ruleId: "INPUT-NOT-ARCH-DIAGRAM",
      category: "clarity",
      pointsDeducted: 35,
      message: "Upload a system architecture diagram instead of a report or statement screenshot.",
      fix: "Provide a PNG or SVG that shows services, trust boundaries, and data/request flows with labeled components.",
      evidence: `OCR matched ${inputSignals.nonArchitectureHits} non-architecture terms and only ${inputSignals.architectureHits} architecture indicators.`,
    });
  } else if (inputSignals.uncertainNonArchitecture) {
    findings.push({
      ruleId: "INPUT-NON-ARCH-SUSPECT",
      category: "clarity",
      pointsDeducted: 10,
      message: "Diagram content may be non-architectural; score confidence is reduced.",
      fix: "Upload a cleaner architecture diagram with component labels and flow arrows.",
      evidence: `OCR mixed ${inputSignals.nonArchitectureHits} non-architecture terms with ${inputSignals.architectureHits} architecture indicators.`,
    });
  }

  if (isLowSignalParagraph(normalizedParagraph)) {
    findings.push({
      ruleId: "INPUT-PARAGRAPH-QUALITY",
      category: "clarity",
      pointsDeducted: 8,
      message: "Provide a clear architecture paragraph with concrete flow steps.",
      fix: "Rewrite the description with request path, components, data stores, and trust boundaries.",
      evidence: "Paragraph text quality was low-signal and lacked concrete architecture terms.",
    });
  }

  const selectedProviderSignals = providerSignalCounts[bundle.provider];
  const dominantOtherProviderSignals = (
    Object.entries(providerSignalCounts) as Array<[ArchitectureProvider, number]>
  )
    .filter(([provider]) => provider !== bundle.provider)
    .reduce((maxValue, [, value]) => Math.max(maxValue, value), 0);

  if (selectedProviderSignals <= 1 && dominantOtherProviderSignals >= 3) {
    findings.push({
      ruleId: providerMismatchRuleId(bundle.provider),
      category: "clarity",
      pointsDeducted: 14,
      message: "Select the cloud provider that matches the diagram components.",
      fix: "Re-run with the provider matching detected services and official icon naming.",
      evidence: `Provider token mismatch detected (${bundle.provider}:${selectedProviderSignals}, other:${dominantOtherProviderSignals}).`,
    });
  }

  if (!hasDirectionality(combinedNarrativeText)) {
    findings.push({
      ruleId: "MSFT-FLOW-DIRECTION",
      category: "clarity",
      pointsDeducted: 6,
      message: "Describe request and data direction explicitly.",
      fix: "State source-to-destination flow using verbs like sends, reads, and writes.",
      evidence: "Directional verbs and sequence markers were sparse in the paragraph.",
    });
  }

  if (
    normalizedCombinedText.includes("bidirectional") ||
    normalizedCombinedText.includes("bi-directional") ||
    normalizedCombinedText.includes("<->") ||
    normalizedCombinedText.includes("↔")
  ) {
    findings.push({
      ruleId: "CLAR-UNIDIR-RELATIONSHIPS",
      category: "clarity",
      pointsDeducted: 4,
      message: "Replace bidirectional arrows with explicit one-way flow labels.",
      fix: "Use one-way arrows and annotate request and response directions clearly.",
      evidence: "Bidirectional relationship wording/symbols were detected.",
    });
  }

  const mentionedTokenCount = countMentionedTokensInParagraph(bundle.serviceTokens, bundle.paragraph);
  if (bundle.serviceTokens.length > 8 && mentionedTokenCount < Math.max(3, Math.floor(bundle.serviceTokens.length * 0.35))) {
    const missing = bundle.serviceTokens.length - mentionedTokenCount;
    findings.push({
      ruleId: "MSFT-COMPONENT-LABEL-COVERAGE",
      category: "clarity",
      pointsDeducted: Math.min(12, 4 + Math.floor(missing / 2)),
      message: "Explain each major component used in the diagram.",
      fix: "Reference key services in the paragraph and describe each component's role.",
      evidence: `${bundle.serviceTokens.length} service tokens detected, but only ${mentionedTokenCount} were explained.`,
    });
  }

  const hasBoundaryLanguage =
    normalizedCombinedText.includes("trust boundary") ||
    normalizedCombinedText.includes("boundary") ||
    normalizedCombinedText.includes("in scope") ||
    normalizedCombinedText.includes("out of scope") ||
    normalizedCombinedText.includes("scope");

  if (!hasBoundaryLanguage) {
    findings.push({
      ruleId: "CLAR-BOUNDARY-EXPLICIT",
      category: "clarity",
      pointsDeducted: 4,
      message: "Make system scope and trust boundaries explicit in the diagram narrative.",
      fix: "Add labeled boundary/scope statements for internet edge, private zones, and data stores.",
      evidence: "Boundary/scope language was not detected in OCR text or description.",
    });
  }

  if (
    tokenCount >= 10 &&
    /\b(connects?|uses|integrates?|talks to)\b/i.test(normalizedParagraph) &&
    !/\b(https?|grpc|jdbc|amqp|kafka|event|batch|stream|pub\/sub|rest|soap|dns|tls)\b/i.test(normalizedParagraph)
  ) {
    findings.push({
      ruleId: "CLAR-REL-LABELS-MISSING",
      category: "clarity",
      pointsDeducted: 4,
      message: "Label relationships with protocol or transfer intent.",
      fix: "Specify connection labels like HTTPS, gRPC, event, stream, batch, or JDBC.",
      evidence: "Generic relationship verbs were used without protocol/intent qualifiers.",
    });
  }

  if (
    tokenCount >= 6 &&
    !/\b(region|availability zone|multi-az|multi az|zone strategy|paired region)\b/i.test(normalizedCombinedText)
  ) {
    findings.push({
      ruleId: "CLAR-REGION-ZONE-MISSING",
      category: "clarity",
      pointsDeducted: 4,
      message: "Identify region and zone placement for this architecture.",
      fix: "Add region names and zone/availability strategy for each critical component.",
      evidence: "No explicit region or zone strategy terms were detected.",
    });
  }

  const staleMonths = bundle.metadata.lastUpdated ? monthsSinceIsoDate(bundle.metadata.lastUpdated) : null;
  if (staleMonths !== null && staleMonths > 6) {
    findings.push({
      ruleId: "CLAR-STALE-DIAGRAM",
      category: "clarity",
      pointsDeducted: Math.min(6, 2 + Math.floor((staleMonths - 6) / 4)),
      message: "Refresh this architecture diagram to reflect current system state.",
      fix: "Update components and metadata, then bump version after review.",
      evidence: `lastUpdated indicates the diagram may be stale (${Math.round(staleMonths)} months old).`,
    });
  }

  const semantics = collectArrowSemantics(combinedNarrativeText);
  const hasLegend = Boolean(bundle.metadata.legend?.trim());
  if (semantics.length >= 2 && !hasLegend) {
    findings.push({
      ruleId: "MSFT-LEGEND-SEMANTICS",
      category: "clarity",
      pointsDeducted: 7,
      message: "Add a legend for sync, async, batch, and stream arrows.",
      fix: "Define arrow styles and meanings in a legend so reviewers interpret flows consistently.",
      evidence: `Multiple transfer semantics found (${semantics.join(", ")}) but legend metadata is empty.`,
    });
  }

  addMetadataFindings(bundle, findings);

  if (tokenCount > 18) {
    findings.push({
      ruleId: "MSFT-LAYERING-DENSITY",
      category: "clarity",
      pointsDeducted: Math.min(5, 1 + Math.floor((tokenCount - 18) / 4)),
      message: "Split this architecture into layered diagrams.",
      fix: "Publish context, container, and component views instead of one dense canvas.",
      evidence: `${tokenCount} service tokens detected; diagram complexity is high.`,
    });
  } else if (tokenCount >= 12) {
    findings.push({
      ruleId: "MSFT-LAYERING-OPTIONAL",
      category: "clarity",
      pointsDeducted: 0,
      message: "Optionally provide a layered view for readability.",
      fix: "Consider separate context and component diagrams for onboarding speed.",
      evidence: `${tokenCount} service tokens detected; layering is recommended but optional.`,
    });
  }

  const statefulSignals = hasStatefulSignals(bundle);
  if (statefulSignals && !/\b(rto|rpo)\b/i.test(normalizedCombinedText)) {
    findings.push({
      ruleId: "REL-RTO-RPO-MISSING",
      category: "reliability",
      pointsDeducted: 8,
      message: "Define RTO and RPO targets for stateful components.",
      fix: "Specify numeric RTO/RPO objectives and map them to failover design.",
      evidence: "Stateful stores were detected without explicit RTO/RPO targets.",
    });
  }

  if (statefulSignals && !/\b(backup|restore|snapshot|replica)\b/i.test(normalizedCombinedText)) {
    findings.push({
      ruleId: "REL-BACKUP-RESTORE",
      category: "reliability",
      pointsDeducted: 8,
      message: "Add backup and restore coverage for stateful services.",
      fix: "Document backup frequency, retention policy, and restore test cadence.",
      evidence: "Stateful services were detected without backup/restore evidence.",
    });
  }

  const regulatedScope = bundle.metadata.regulatoryScope && bundle.metadata.regulatoryScope !== "none";
  if (regulatedScope && !/\b(soc2|pci|hipaa|compliance|privacy|iso ?27001)\b/i.test(normalizedCombinedText)) {
    findings.push({
      ruleId: "SEC-BASELINE-MISSING",
      category: "security",
      pointsDeducted: 8,
      message: "Define compliance baseline and security control coverage.",
      fix: "State required framework scope and map controls to identity, encryption, and auditing.",
      evidence: `Regulatory scope is set (${bundle.metadata.regulatoryScope}) without compliance baseline detail.`,
    });
  }

  if (
    statefulSignals &&
    !/\b(pii|pci|phi|sensitive data|data classification|confidential)\b/i.test(normalizedCombinedText)
  ) {
    findings.push({
      ruleId: "CLAR-DATA-CLASS-MISSING",
      category: "security",
      pointsDeducted: 6,
      message: "Classify sensitive data types and storage/transit handling.",
      fix: "Label PII/PCI/PHI classes and identify where each class is stored and transmitted.",
      evidence: "Stateful data stores were present without data classification language.",
    });
  }

  addPillarFindings(bundle, findings);
  applyScoringCalibrations(bundle, findings);

  return findings;
}

export function buildDeterministicNarrative(bundle: ArchitectureEvidenceBundle) {
  const providerLabel = bundle.provider.toUpperCase();
  const inputSignals = detectInputTypeSignals(bundle);

  if (inputSignals.highConfidenceNonArchitecture) {
    return `${providerLabel} review detected non-architecture content in the uploaded diagram. Scoring was generated from low-confidence signals; upload a true architecture diagram for accurate findings.`.slice(
      0,
      2000,
    );
  }

  if (inputSignals.uncertainNonArchitecture) {
    return `${providerLabel} review detected mixed content signals in the uploaded diagram. Findings were generated with reduced confidence; a cleaner architecture image should improve accuracy.`.slice(
      0,
      2000,
    );
  }

  const tokenPreview = bundle.serviceTokens.slice(0, 6).join(", ");
  const paragraph = compressWhitespace(bundle.paragraph);
  const lowSignalParagraph = isLowSignalParagraph(paragraph);
  const tokenSentence = tokenPreview
    ? `Detected components include ${tokenPreview}${bundle.serviceTokens.length > 6 ? ", and others" : ""}.`
    : "Component labels were limited, so narrative confidence is lower.";

  if (lowSignalParagraph) {
    return `${providerLabel} architecture review used OCR-derived component cues because the written description was low-signal. ${tokenSentence} Add a clearer one-paragraph flow description for higher-confidence narrative output.`.slice(
      0,
      2000,
    );
  }

  return `${providerLabel} architecture review input indicates the following flow: ${paragraph} ${tokenSentence}`.slice(0, 2000);
}
