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

function compressWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
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

  return {
    likelyNonArchitecture,
    nonArchitectureHits,
    architectureHits,
    hasCurrencyValues,
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

export function buildDeterministicReviewFindings(bundle: ArchitectureEvidenceBundle): ArchitectureFindingDraft[] {
  const findings: ArchitectureFindingDraft[] = [];
  const combinedNarrativeText = `${bundle.paragraph}\n${bundle.ocrText}`;
  const inputSignals = detectInputTypeSignals(bundle);

  if (inputSignals.likelyNonArchitecture) {
    findings.push({
      ruleId: "INPUT-NOT-ARCH-DIAGRAM",
      category: "clarity",
      pointsDeducted: 35,
      message: "Upload a system architecture diagram instead of a report or statement screenshot.",
      fix: "Provide a PNG that shows services, trust boundaries, and data/request flows with labeled components.",
      evidence: `OCR matched ${inputSignals.nonArchitectureHits} non-architecture terms and only ${inputSignals.architectureHits} architecture indicators.`,
    });
  }

  if (!hasDirectionality(bundle.paragraph)) {
    findings.push({
      ruleId: "MSFT-FLOW-DIRECTION",
      category: "clarity",
      pointsDeducted: 6,
      message: "Describe request and data direction explicitly.",
      fix: "State source-to-destination flow using verbs like sends, reads, and writes.",
      evidence: "Directional verbs and sequence markers were sparse in the paragraph.",
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

  const tokenCount = bundle.serviceTokens.length;
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

  addPillarFindings(bundle, findings);

  return findings;
}

export function buildDeterministicNarrative(bundle: ArchitectureEvidenceBundle) {
  const providerLabel = bundle.provider.toUpperCase();
  const inputSignals = detectInputTypeSignals(bundle);

  if (inputSignals.likelyNonArchitecture) {
    return `${providerLabel} review detected non-architecture content in the uploaded PNG. Scoring was generated from low-confidence signals; upload a true architecture diagram for accurate findings.`.slice(
      0,
      2000,
    );
  }

  const tokenPreview = bundle.serviceTokens.slice(0, 6).join(", ");
  const paragraph = compressWhitespace(bundle.paragraph);
  const tokenSentence = tokenPreview
    ? `Detected components include ${tokenPreview}${bundle.serviceTokens.length > 6 ? ", and others" : ""}.`
    : "Component labels in OCR were limited, so narrative confidence is lower.";

  return `${providerLabel} architecture review input indicates the following flow: ${paragraph} ${tokenSentence}`.slice(0, 2000);
}
