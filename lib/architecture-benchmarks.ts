export type BenchmarkProvider = "aws" | "azure" | "gcp";

export type BenchmarkPattern = {
  slug: "3-tier-web" | "event-driven" | "data-platform" | "zero-trust-edge";
  title: string;
  summary: string;
  scoreRange: [number, number];
  commonDeductions: string[];
  remediationSnippet: string;
};

export type ProviderBenchmarkLibrary = {
  provider: BenchmarkProvider;
  providerLabel: string;
  description: string;
  patterns: BenchmarkPattern[];
};

export const ARCHITECTURE_BENCHMARK_LIBRARY: ProviderBenchmarkLibrary[] = [
  {
    provider: "aws",
    providerLabel: "AWS",
    description: "Aggregate benchmarks across AWS diagrams submitted to ZoKorp Architecture Diagram Reviewer.",
    patterns: [
      {
        slug: "3-tier-web",
        title: "3-tier web app",
        summary: "ALB/API edge, stateless app tier, relational or key-value data tier, centralized observability.",
        scoreRange: [72, 89],
        commonDeductions: [
          "PILLAR-SECURITY",
          "REL-RTO-RPO-MISSING",
          "MSFT-LEGEND-SEMANTICS",
          "MSFT-META-VERSION",
        ],
        remediationSnippet:
          "Define IAM boundary per tier, add explicit backup/restore RTO-RPO, and version diagram metadata on each release.",
      },
      {
        slug: "event-driven",
        title: "Event-driven integration",
        summary: "EventBridge/SQS/SNS-driven decoupled services with asynchronous processing and replay handling.",
        scoreRange: [66, 84],
        commonDeductions: [
          "PILLAR-OPERATIONS",
          "PILLAR-RELIABILITY",
          "CLAR-REL-LABELS-MISSING",
          "MSFT-LEGEND-SEMANTICS",
        ],
        remediationSnippet:
          "Label retry/dead-letter paths, define on-call runbooks for backpressure, and add explicit async legend entries.",
      },
      {
        slug: "data-platform",
        title: "Data platform",
        summary: "Ingestion, transformation, warehousing, and analytics pipeline with governed data storage layers.",
        scoreRange: [60, 80],
        commonDeductions: ["PILLAR-COST", "PILLAR-OPERATIONS", "CLAR-DATA-CLASS-MISSING", "REL-BACKUP-RESTORE"],
        remediationSnippet:
          "Add data classification boundaries, cost guardrails per pipeline stage, and restore testing cadence for stateful systems.",
      },
      {
        slug: "zero-trust-edge",
        title: "Zero-trust edge",
        summary: "Identity-aware ingress, segmented private zones, policy enforcement points, and workload isolation.",
        scoreRange: [63, 83],
        commonDeductions: ["PILLAR-SECURITY", "CLAR-BOUNDARY-EXPLICIT", "MSFT-FLOW-DIRECTION", "PILLAR-RELIABILITY"],
        remediationSnippet:
          "Map trust boundaries explicitly, include policy decision points, and document fail-safe behavior for auth dependencies.",
      },
    ],
  },
  {
    provider: "azure",
    providerLabel: "Azure",
    description: "Aggregate benchmarks across Azure diagrams submitted to ZoKorp Architecture Diagram Reviewer.",
    patterns: [
      {
        slug: "3-tier-web",
        title: "3-tier web app",
        summary: "Front Door/App Gateway edge, App Service/AKS compute tier, SQL/Cosmos data tier.",
        scoreRange: [70, 88],
        commonDeductions: ["PILLAR-SECURITY", "PILLAR-OPERATIONS", "MSFT-COMPONENT-LABEL-COVERAGE", "MSFT-META-OWNER"],
        remediationSnippet:
          "Define Entra/RBAC and Key Vault usage, map monitoring ownership, and explain each major component in the narrative.",
      },
      {
        slug: "event-driven",
        title: "Event-driven integration",
        summary: "Event Grid/Service Bus/Event Hubs topology for asynchronous processing and system decoupling.",
        scoreRange: [65, 83],
        commonDeductions: ["PILLAR-RELIABILITY", "PILLAR-OPERATIONS", "MSFT-LEGEND-SEMANTICS", "REL-RTO-RPO-MISSING"],
        remediationSnippet:
          "Document replay controls, dead-letter handling, and operational playbooks tied to observable queue thresholds.",
      },
      {
        slug: "data-platform",
        title: "Data platform",
        summary: "Batch/stream ingestion, transformation, serving, and BI layers with governance controls.",
        scoreRange: [59, 79],
        commonDeductions: ["PILLAR-COST", "CLAR-DATA-CLASS-MISSING", "PILLAR-OPERATIONS", "REL-BACKUP-RESTORE"],
        remediationSnippet:
          "Add lifecycle/cost controls and retention policy labels; define security classification and restore validation steps.",
      },
      {
        slug: "zero-trust-edge",
        title: "Zero-trust edge",
        summary: "Identity-aware edge with segmented VNets, private endpoints, and strict east-west restrictions.",
        scoreRange: [62, 82],
        commonDeductions: ["CLAR-BOUNDARY-EXPLICIT", "PILLAR-SECURITY", "MSFT-FLOW-DIRECTION", "PILLAR-RELIABILITY"],
        remediationSnippet:
          "Annotate policy path and trust boundaries, then document fallback behavior when identity controls degrade.",
      },
    ],
  },
  {
    provider: "gcp",
    providerLabel: "GCP",
    description: "Aggregate benchmarks across GCP diagrams submitted to ZoKorp Architecture Diagram Reviewer.",
    patterns: [
      {
        slug: "3-tier-web",
        title: "3-tier web app",
        summary: "Cloud Load Balancing edge, Cloud Run/GKE/Compute app tier, Cloud SQL/Spanner data tier.",
        scoreRange: [71, 87],
        commonDeductions: ["PILLAR-SECURITY", "PILLAR-RELIABILITY", "MSFT-META-VERSION", "PILLAR-OPERATIONS"],
        remediationSnippet:
          "Specify IAM/service account model, failover targets, and incident ownership including alert-routing coverage.",
      },
      {
        slug: "event-driven",
        title: "Event-driven integration",
        summary: "Pub/Sub + Cloud Tasks + Workflows driven integration with asynchronous reliability controls.",
        scoreRange: [64, 82],
        commonDeductions: ["PILLAR-OPERATIONS", "REL-RTO-RPO-MISSING", "MSFT-LEGEND-SEMANTICS", "PILLAR-COST"],
        remediationSnippet:
          "Add queue policy annotations, backoff/retry behavior, and cost ceilings tied to autoscaling controls.",
      },
      {
        slug: "data-platform",
        title: "Data platform",
        summary: "Streaming/batch ingestion to analytical and operational data stores with governance checkpoints.",
        scoreRange: [58, 78],
        commonDeductions: ["CLAR-DATA-CLASS-MISSING", "PILLAR-COST", "PILLAR-OPERATIONS", "REL-BACKUP-RESTORE"],
        remediationSnippet:
          "Define ownership and data retention boundaries, plus tested restore paths for stateful components.",
      },
      {
        slug: "zero-trust-edge",
        title: "Zero-trust edge",
        summary: "Identity-aware access proxy, segmented projects/VPCs, and strict service-to-service authorization.",
        scoreRange: [61, 81],
        commonDeductions: ["PILLAR-SECURITY", "CLAR-BOUNDARY-EXPLICIT", "MSFT-FLOW-DIRECTION", "PILLAR-RELIABILITY"],
        remediationSnippet:
          "Document control-plane vs data-plane trust boundaries and explicit traffic direction labels for every ingress path.",
      },
    ],
  },
];

export function getBenchmarkProvider(provider: BenchmarkProvider) {
  return ARCHITECTURE_BENCHMARK_LIBRARY.find((item) => item.provider === provider) ?? null;
}

export function getBenchmarkPattern(provider: BenchmarkProvider, patternSlug: BenchmarkPattern["slug"]) {
  const providerLibrary = getBenchmarkProvider(provider);
  if (!providerLibrary) {
    return null;
  }

  return providerLibrary.patterns.find((pattern) => pattern.slug === patternSlug) ?? null;
}

export function getBenchmarkFaqItems() {
  return [
    {
      question: "How are benchmark scores calculated?",
      answer:
        "Scores are deterministic from a fixed architecture rubric. We cap overlapping penalties and preserve strict no-fluff finding text.",
    },
    {
      question: "Are benchmark pages based on customer-identifiable data?",
      answer:
        "No. Benchmarks are anonymized aggregate ranges grouped by provider and architecture pattern.",
    },
    {
      question: "Why can a known reference architecture score below 80?",
      answer:
        "Reference diagrams often omit operational metadata, ownership, and reliability targets. Reviewer scoring rewards production-ready detail.",
    },
    {
      question: "Where do I get my detailed findings?",
      answer:
        "Detailed findings and quote outputs are delivered by email only and are not rendered in the web UI.",
    },
  ] as const;
}
