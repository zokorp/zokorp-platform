import { extractServiceTokens } from "@/lib/architecture-review/engine";
import { getArchitectureIconEmbed } from "@/lib/architecture-review/icon-embeds";
import type { ArchitectureProvider } from "@/lib/architecture-review/types";

type DiagramLane = "source" | "edge" | "application" | "data" | "operations";
type NonSourceLane = Exclude<DiagramLane, "source">;

type DiagramNodeSeed = {
  label: string;
  lane: DiagramLane;
  iconKey?: string;
  iconPath?: string;
  priority: number;
  mentionOrder: number;
};

type DiagramNode = {
  id: string;
  label: string;
  lane: DiagramLane;
  iconKey?: string;
  iconPath?: string;
  priority: number;
  mentionOrder: number;
};

type DiagramEdge = {
  from: string;
  to: string;
  kind: "primary" | "secondary";
  label?: string;
};

type DiagramTemplate = "web-tier" | "event-driven" | "data-platform" | "hybrid" | "multi-region-dr";

type IconRule = {
  keywords: string[];
  label: string;
  lane: NonSourceLane;
  iconKey: string;
  priority: number;
};

type ProviderTheme = {
  accent: string;
  accentSoft: string;
  accentMuted: string;
  surface: string;
  cloudFill: string;
  cloudStroke: string;
  zoneFill: string;
  zoneStroke: string;
  sourceFill: string;
  sourceStroke: string;
  nodeFill: string;
  nodeStroke: string;
  textStrong: string;
  textMuted: string;
};

type GeneratedArchitectureDiagram = {
  provider: ArchitectureProvider;
  template: DiagramTemplate;
  svg: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  title: string;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Layout = {
  sourceZone: Rect;
  cloudRect: Rect;
  laneZones: Record<NonSourceLane, Rect>;
};

type BoundaryOverlay = {
  rect: Rect;
  label: string;
  subtitle?: string;
  style?: "solid" | "dashed";
};

const NON_SOURCE_LANES: NonSourceLane[] = ["edge", "application", "data", "operations"];

const MAX_NODES_PER_LANE: Record<DiagramLane, number> = {
  source: 2,
  edge: 3,
  application: 4,
  data: 3,
  operations: 3,
};

const DEFAULT_NARRATIVE =
  "Users access a secure edge tier, traffic routes to application services, data is persisted in managed stores, and operations are monitored.";

const MISSING_MENTION_ORDER = 10_000;

const HYBRID_SOURCE_TERMS = [
  "on-prem",
  "on prem",
  "on-premise",
  "datacenter",
  "data center",
  "corporate network",
  "hybrid",
];

const TEMPLATE_SUBTITLES: Record<DiagramTemplate, string> = {
  "web-tier": "Provider-authentic web-tier layout with deterministic request flow routing.",
  "event-driven": "Event-driven layout with command and event-processing flow channels.",
  "data-platform": "Data-platform layout emphasizing ingestion, storage, and operational oversight.",
  hybrid: "Hybrid topology with on-prem/private connectivity into cloud workloads.",
  "multi-region-dr": "Multi-region disaster recovery layout with deterministic resiliency cues.",
};

const TEMPLATE_SOURCE_HINTS: Record<DiagramTemplate, string> = {
  "web-tier": "Client entry and public access",
  "event-driven": "Clients and producers emitting commands/events",
  "data-platform": "Producers and consumers exchanging analytical data",
  hybrid: "Users and on-prem systems using private connectivity",
  "multi-region-dr": "Clients with failover-ready entry paths",
};

const TEMPLATE_EDGE_LABELS: Record<DiagramTemplate, { sourceToEdge: string; edgeToApp: string; appToData: string }> = {
  "web-tier": {
    sourceToEdge: "Ingress",
    edgeToApp: "Request flow",
    appToData: "Read / write",
  },
  "event-driven": {
    sourceToEdge: "Ingress",
    edgeToApp: "Command API",
    appToData: "Publish events",
  },
  "data-platform": {
    sourceToEdge: "Ingestion entry",
    edgeToApp: "Data processing",
    appToData: "Store / transform",
  },
  hybrid: {
    sourceToEdge: "Ingress",
    edgeToApp: "Application traffic",
    appToData: "Data access",
  },
  "multi-region-dr": {
    sourceToEdge: "Ingress",
    edgeToApp: "Primary path",
    appToData: "Primary data path",
  },
};

const LOW_SIGNAL_TOKENS = new Set([
  "api",
  "gateway",
  "auth",
  "monitoring",
  "logging",
  "cache",
  "queue",
  "stream",
  "backup",
  "replica",
  "dr",
  "service",
]);

const GENERIC_NODE_LABELS: Record<NonSourceLane, string[]> = {
  edge: ["edge", "gateway", "load balancer", "network"],
  application: ["application", "service", "compute", "worker"],
  data: ["database", "storage", "datastore", "data"],
  operations: ["monitoring", "logging", "security", "identity", "operations"],
};

const SPECIFIC_NODE_HINTS: Record<NonSourceLane, RegExp[]> = {
  edge: [
    /route 53|cloudfront|api gateway|elastic load balancing|application gateway|front door|apigee|traffic manager/i,
  ],
  application: [/lambda|ecs|eks|ec2|app service|function app|aks|gke|cloud run|compute engine/i],
  data: [/rds|aurora|dynamodb|sql|cosmos|spanner|bigquery|s3|storage account|cloud storage/i],
  operations: [/cloudwatch|key vault|iam|kms|secrets manager|application insights|observability|managed identity/i],
};

const LANE_LABELS: Record<DiagramLane, string> = {
  source: "Internet and Users",
  edge: "Edge and Ingress",
  application: "Application Services",
  data: "Data Services",
  operations: "Operations and Security",
};

const LANE_DESCRIPTIONS: Record<NonSourceLane, string> = {
  edge: "Traffic control, DNS, and gateway services",
  application: "Runtime components serving user and system requests",
  data: "Stateful systems, storage, and analytics sinks",
  operations: "Monitoring, identity, secrets, and governance",
};

const PROVIDER_THEMES: Record<ArchitectureProvider, ProviderTheme> = {
  aws: {
    accent: "#ff9900",
    accentSoft: "#fff4e3",
    accentMuted: "#f2b14f",
    surface: "#f7fafc",
    cloudFill: "#fff9f1",
    cloudStroke: "#f3c88c",
    zoneFill: "#fffdf9",
    zoneStroke: "#f2d4aa",
    sourceFill: "#f7fbff",
    sourceStroke: "#c8dced",
    nodeFill: "#ffffff",
    nodeStroke: "#e7c18d",
    textStrong: "#11253b",
    textMuted: "#4e6781",
  },
  azure: {
    accent: "#0078d4",
    accentSoft: "#e9f4ff",
    accentMuted: "#4099e2",
    surface: "#f4f9ff",
    cloudFill: "#f6fbff",
    cloudStroke: "#9ec7ef",
    zoneFill: "#fbfdff",
    zoneStroke: "#b8d8f5",
    sourceFill: "#f5fbff",
    sourceStroke: "#b9d9f5",
    nodeFill: "#ffffff",
    nodeStroke: "#a8ccee",
    textStrong: "#10253b",
    textMuted: "#486883",
  },
  gcp: {
    accent: "#1a73e8",
    accentSoft: "#ecf4ff",
    accentMuted: "#5a94ea",
    surface: "#f4f9ff",
    cloudFill: "#f4f8ff",
    cloudStroke: "#adc7ee",
    zoneFill: "#fbfdff",
    zoneStroke: "#c2d8f5",
    sourceFill: "#f7fbff",
    sourceStroke: "#c0d6ef",
    nodeFill: "#ffffff",
    nodeStroke: "#aac8ea",
    textStrong: "#102a46",
    textMuted: "#4d6882",
  },
  multi: {
    accent: "#0f766e",
    accentSoft: "#effcf9",
    accentMuted: "#3f948c",
    surface: "#f7fafc",
    cloudFill: "#f5fbfa",
    cloudStroke: "#9fd1ca",
    zoneFill: "#fbfefd",
    zoneStroke: "#b9ddd8",
    sourceFill: "#f7fbff",
    sourceStroke: "#c8dced",
    nodeFill: "#ffffff",
    nodeStroke: "#b0d7d2",
    textStrong: "#11253b",
    textMuted: "#4e6781",
  },
};

const FALLBACK_LANE_ICON_KEYS: Record<ArchitectureProvider, Record<NonSourceLane, string>> = {
  aws: {
    edge: "aws/elastic-load-balancing",
    application: "aws/ec2",
    data: "aws/rds",
    operations: "aws/cloudwatch",
  },
  azure: {
    edge: "azure/front-door",
    application: "azure/app-service",
    data: "azure/sql-database",
    operations: "azure/application-insights",
  },
  gcp: {
    edge: "gcp/networking",
    application: "gcp/cloud-run",
    data: "gcp/cloud-sql",
    operations: "gcp/observability",
  },
  multi: {
    edge: "aws/elastic-load-balancing",
    application: "aws/ec2",
    data: "aws/rds",
    operations: "aws/cloudwatch",
  },
};

const PROVIDER_ICON_RULES: Record<ArchitectureProvider, IconRule[]> = {
  aws: [
    { keywords: ["route 53"], label: "Route 53", lane: "edge", iconKey: "aws/route-53", priority: 10 },
    { keywords: ["cloudfront", "cdn"], label: "CloudFront", lane: "edge", iconKey: "aws/cloudfront", priority: 12 },
    { keywords: ["api gateway"], label: "API Gateway", lane: "edge", iconKey: "aws/api-gateway", priority: 14 },
    {
      keywords: ["alb", "nlb", "load balancer", "elastic load balancing"],
      label: "Elastic Load Balancing",
      lane: "edge",
      iconKey: "aws/elastic-load-balancing",
      priority: 16,
    },
    { keywords: ["vpc"], label: "VPC", lane: "edge", iconKey: "aws/vpc", priority: 18 },
    { keywords: ["lambda"], label: "Lambda", lane: "application", iconKey: "aws/lambda", priority: 30 },
    { keywords: ["ecs", "fargate"], label: "ECS", lane: "application", iconKey: "aws/ecs", priority: 32 },
    { keywords: ["eks"], label: "EKS", lane: "application", iconKey: "aws/eks", priority: 34 },
    {
      keywords: ["ec2", "compute", "virtual machine"],
      label: "EC2",
      lane: "application",
      iconKey: "aws/ec2",
      priority: 36,
    },
    { keywords: ["aurora"], label: "Aurora", lane: "data", iconKey: "aws/aurora", priority: 50 },
    { keywords: ["rds"], label: "RDS", lane: "data", iconKey: "aws/rds", priority: 52 },
    { keywords: ["dynamodb"], label: "DynamoDB", lane: "data", iconKey: "aws/dynamodb", priority: 54 },
    { keywords: ["s3", "storage"], label: "S3", lane: "data", iconKey: "aws/s3", priority: 56 },
    { keywords: ["iam", "auth"], label: "IAM", lane: "operations", iconKey: "aws/iam", priority: 70 },
    { keywords: ["kms", "encryption"], label: "KMS", lane: "operations", iconKey: "aws/kms", priority: 72 },
    {
      keywords: ["secrets manager", "secret"],
      label: "Secrets Manager",
      lane: "operations",
      iconKey: "aws/secrets-manager",
      priority: 74,
    },
    {
      keywords: ["cloudwatch", "monitor", "logging", "trace"],
      label: "CloudWatch",
      lane: "operations",
      iconKey: "aws/cloudwatch",
      priority: 76,
    },
  ],
  azure: [
    { keywords: ["front door"], label: "Front Door", lane: "edge", iconKey: "azure/front-door", priority: 10 },
    {
      keywords: ["application gateway"],
      label: "Application Gateway",
      lane: "edge",
      iconKey: "azure/application-gateway",
      priority: 12,
    },
    {
      keywords: ["load balancer"],
      label: "Load Balancer",
      lane: "edge",
      iconKey: "azure/load-balancer",
      priority: 14,
    },
    {
      keywords: ["traffic manager"],
      label: "Traffic Manager",
      lane: "edge",
      iconKey: "azure/traffic-manager",
      priority: 16,
    },
    {
      keywords: ["api management"],
      label: "API Management",
      lane: "edge",
      iconKey: "azure/api-management",
      priority: 18,
    },
    { keywords: ["vnet", "virtual network"], label: "Virtual Network", lane: "edge", iconKey: "azure/vnet", priority: 20 },
    {
      keywords: ["app service"],
      label: "App Service",
      lane: "application",
      iconKey: "azure/app-service",
      priority: 30,
    },
    {
      keywords: ["function app", "functions"],
      label: "Function App",
      lane: "application",
      iconKey: "azure/function-app",
      priority: 32,
    },
    { keywords: ["aks", "kubernetes"], label: "AKS", lane: "application", iconKey: "azure/aks", priority: 34 },
    {
      keywords: ["sql database"],
      label: "SQL Database",
      lane: "data",
      iconKey: "azure/sql-database",
      priority: 50,
    },
    { keywords: ["cosmos db"], label: "Cosmos DB", lane: "data", iconKey: "azure/cosmos-db", priority: 52 },
    {
      keywords: ["storage account", "storage"],
      label: "Storage Account",
      lane: "data",
      iconKey: "azure/storage-account",
      priority: 54,
    },
    { keywords: ["service bus"], label: "Service Bus", lane: "data", iconKey: "azure/service-bus", priority: 56 },
    { keywords: ["event hub"], label: "Event Hubs", lane: "data", iconKey: "azure/event-hubs", priority: 58 },
    { keywords: ["key vault"], label: "Key Vault", lane: "operations", iconKey: "azure/key-vault", priority: 70 },
    {
      keywords: ["managed identity"],
      label: "Managed Identity",
      lane: "operations",
      iconKey: "azure/managed-identity",
      priority: 72,
    },
    { keywords: ["entra", "azure ad"], label: "Microsoft Entra", lane: "operations", iconKey: "azure/entra", priority: 74 },
    {
      keywords: ["log analytics"],
      label: "Log Analytics",
      lane: "operations",
      iconKey: "azure/log-analytics",
      priority: 76,
    },
    {
      keywords: ["application insights", "azure monitor", "monitor", "logging"],
      label: "Application Insights",
      lane: "operations",
      iconKey: "azure/application-insights",
      priority: 78,
    },
  ],
  gcp: [
    { keywords: ["api gateway", "apigee"], label: "Apigee", lane: "edge", iconKey: "gcp/apigee", priority: 10 },
    {
      keywords: ["cloud load balancing", "load balancing", "cdn", "network"],
      label: "Cloud Networking",
      lane: "edge",
      iconKey: "gcp/networking",
      priority: 12,
    },
    { keywords: ["cloud run"], label: "Cloud Run", lane: "application", iconKey: "gcp/cloud-run", priority: 30 },
    { keywords: ["gke", "kubernetes"], label: "GKE", lane: "application", iconKey: "gcp/gke", priority: 32 },
    {
      keywords: ["compute engine", "compute"],
      label: "Compute Engine",
      lane: "application",
      iconKey: "gcp/compute-engine",
      priority: 34,
    },
    { keywords: ["cloud sql"], label: "Cloud SQL", lane: "data", iconKey: "gcp/cloud-sql", priority: 50 },
    { keywords: ["spanner"], label: "Cloud Spanner", lane: "data", iconKey: "gcp/cloud-spanner", priority: 52 },
    {
      keywords: ["cloud storage", "storage"],
      label: "Cloud Storage",
      lane: "data",
      iconKey: "gcp/cloud-storage",
      priority: 54,
    },
    { keywords: ["bigquery"], label: "BigQuery", lane: "data", iconKey: "gcp/bigquery", priority: 56 },
    {
      keywords: ["iam", "service account", "cloud kms", "secret manager", "security"],
      label: "Security Identity",
      lane: "operations",
      iconKey: "gcp/security-identity",
      priority: 70,
    },
    {
      keywords: ["monitor", "logging", "trace", "observability"],
      label: "Observability",
      lane: "operations",
      iconKey: "gcp/observability",
      priority: 72,
    },
  ],
  multi: [
    { keywords: ["route 53", "front door", "cloud dns"], label: "Edge Routing", lane: "edge", iconKey: "aws/route-53", priority: 10 },
    { keywords: ["api gateway", "application gateway", "cloud load balancing"], label: "Ingress", lane: "edge", iconKey: "aws/api-gateway", priority: 12 },
    { keywords: ["lambda", "app service", "cloud run"], label: "Application Service", lane: "application", iconKey: "aws/lambda", priority: 30 },
    { keywords: ["ecs", "aks", "gke", "kubernetes"], label: "Container Platform", lane: "application", iconKey: "aws/eks", priority: 32 },
    { keywords: ["rds", "sql database", "cloud sql"], label: "Relational Database", lane: "data", iconKey: "aws/rds", priority: 50 },
    { keywords: ["s3", "storage account", "cloud storage"], label: "Object Storage", lane: "data", iconKey: "aws/s3", priority: 54 },
    { keywords: ["cloudwatch", "azure monitor", "cloud monitoring", "logging"], label: "Observability", lane: "operations", iconKey: "aws/cloudwatch", priority: 72 },
  ],
};

const PROVIDER_DEFAULT_SEEDS: Record<ArchitectureProvider, DiagramNodeSeed[]> = {
  aws: [
    { label: "Users", lane: "source", priority: 0, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Route 53", lane: "edge", iconKey: "aws/route-53", priority: 10, mentionOrder: MISSING_MENTION_ORDER },
    { label: "API Gateway", lane: "edge", iconKey: "aws/api-gateway", priority: 14, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Lambda", lane: "application", iconKey: "aws/lambda", priority: 30, mentionOrder: MISSING_MENTION_ORDER },
    { label: "ECS", lane: "application", iconKey: "aws/ecs", priority: 32, mentionOrder: MISSING_MENTION_ORDER },
    { label: "RDS", lane: "data", iconKey: "aws/rds", priority: 50, mentionOrder: MISSING_MENTION_ORDER },
    { label: "S3", lane: "data", iconKey: "aws/s3", priority: 56, mentionOrder: MISSING_MENTION_ORDER },
    { label: "CloudWatch", lane: "operations", iconKey: "aws/cloudwatch", priority: 76, mentionOrder: MISSING_MENTION_ORDER },
    { label: "IAM", lane: "operations", iconKey: "aws/iam", priority: 70, mentionOrder: MISSING_MENTION_ORDER },
  ],
  azure: [
    { label: "Users", lane: "source", priority: 0, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Front Door", lane: "edge", iconKey: "azure/front-door", priority: 10, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Application Gateway", lane: "edge", iconKey: "azure/application-gateway", priority: 12, mentionOrder: MISSING_MENTION_ORDER },
    { label: "App Service", lane: "application", iconKey: "azure/app-service", priority: 30, mentionOrder: MISSING_MENTION_ORDER },
    { label: "AKS", lane: "application", iconKey: "azure/aks", priority: 34, mentionOrder: MISSING_MENTION_ORDER },
    { label: "SQL Database", lane: "data", iconKey: "azure/sql-database", priority: 50, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Storage Account", lane: "data", iconKey: "azure/storage-account", priority: 54, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Application Insights", lane: "operations", iconKey: "azure/application-insights", priority: 78, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Key Vault", lane: "operations", iconKey: "azure/key-vault", priority: 70, mentionOrder: MISSING_MENTION_ORDER },
  ],
  gcp: [
    { label: "Users", lane: "source", priority: 0, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Apigee", lane: "edge", iconKey: "gcp/apigee", priority: 10, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Cloud Networking", lane: "edge", iconKey: "gcp/networking", priority: 12, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Cloud Run", lane: "application", iconKey: "gcp/cloud-run", priority: 30, mentionOrder: MISSING_MENTION_ORDER },
    { label: "GKE", lane: "application", iconKey: "gcp/gke", priority: 32, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Cloud SQL", lane: "data", iconKey: "gcp/cloud-sql", priority: 50, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Cloud Storage", lane: "data", iconKey: "gcp/cloud-storage", priority: 54, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Observability", lane: "operations", iconKey: "gcp/observability", priority: 72, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Security Identity", lane: "operations", iconKey: "gcp/security-identity", priority: 70, mentionOrder: MISSING_MENTION_ORDER },
  ],
  multi: [
    { label: "Users", lane: "source", priority: 0, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Ingress", lane: "edge", iconKey: "aws/api-gateway", priority: 12, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Application Service", lane: "application", iconKey: "aws/ec2", priority: 30, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Relational Database", lane: "data", iconKey: "aws/rds", priority: 50, mentionOrder: MISSING_MENTION_ORDER },
    { label: "Observability", lane: "operations", iconKey: "aws/cloudwatch", priority: 72, mentionOrder: MISSING_MENTION_ORDER },
  ],
};

function escapeXml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toTitleCase(input: string) {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeToken(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function getFirstMentionOrder(narrative: string, searchTerms: string[]) {
  const normalizedNarrative = normalizeToken(narrative);
  let earliest = MISSING_MENTION_ORDER;

  for (const term of searchTerms) {
    const index = normalizedNarrative.indexOf(normalizeToken(term));
    if (index >= 0 && index < earliest) {
      earliest = index;
    }
  }

  return earliest;
}

function detectDiagramTemplate(narrative: string): DiagramTemplate {
  const text = normalizeToken(narrative);

  if (/\b(multi-region|multi region|disaster recovery|dr|rto|rpo|active-active|active-passive)\b/.test(text)) {
    return "multi-region-dr";
  }
  if (/\b(on-prem|on prem|hybrid|datacenter|data center|direct connect|expressroute|interconnect|vpn)\b/.test(text)) {
    return "hybrid";
  }
  if (/\b(analytics|warehouse|etl|data lake|lakehouse|bigquery|athena|dataflow|databricks)\b/.test(text)) {
    return "data-platform";
  }
  if (/\b(event|queue|stream|pub\/sub|pubsub|topic|sns|sqs|eventbridge|service bus|event hub|kinesis)\b/.test(text)) {
    return "event-driven";
  }

  return "web-tier";
}

function normalizeLabel(token: string) {
  return toTitleCase(
    token
      .replace(/\bapi\b/gi, "API")
      .replace(/\bdb\b/gi, "DB")
      .replace(/\baws\b/gi, "AWS")
      .replace(/\bazure\b/gi, "Azure")
      .replace(/\bgcp\b/gi, "GCP"),
  );
}

function iconPathFromKey(iconKey: string) {
  const [provider, service] = iconKey.split("/");
  if (!provider || !service) {
    return undefined;
  }
  return `/architecture-icons/${provider}/${service}.svg`;
}

function inferLane(token: string): NonSourceLane {
  const value = normalizeToken(token);
  if (
    value.includes("gateway") ||
    value.includes("front door") ||
    value.includes("route 53") ||
    value.includes("load balancer") ||
    value.includes("traffic manager") ||
    value.includes("network") ||
    value.includes("cdn")
  ) {
    return "edge";
  }

  if (
    value.includes("monitor") ||
    value.includes("log") ||
    value.includes("trace") ||
    value.includes("auth") ||
    value.includes("identity") ||
    value.includes("secret") ||
    value.includes("kms") ||
    value.includes("vault")
  ) {
    return "operations";
  }

  if (
    value.includes("database") ||
    value.includes("sql") ||
    value.includes("rds") ||
    value.includes("spanner") ||
    value.includes("bigquery") ||
    value.includes("storage") ||
    value.includes("s3") ||
    value.includes("service bus") ||
    value.includes("event hub") ||
    value.includes("event")
  ) {
    return "data";
  }

  return "application";
}

function findIconRule(provider: ArchitectureProvider, token: string) {
  const normalizedToken = normalizeToken(token);
  const rules = PROVIDER_ICON_RULES[provider];
  let bestMatch: { rule: IconRule; keywordLength: number } | null = null;

  for (const rule of rules) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = normalizeToken(keyword);
      if (!normalizedToken.includes(normalizedKeyword)) {
        continue;
      }

      if (
        !bestMatch ||
        normalizedKeyword.length > bestMatch.keywordLength ||
        (normalizedKeyword.length === bestMatch.keywordLength && rule.priority < bestMatch.rule.priority)
      ) {
        bestMatch = {
          rule,
          keywordLength: normalizedKeyword.length,
        };
      }
    }
  }

  return bestMatch?.rule ?? null;
}

function dedupeSeeds(seeds: DiagramNodeSeed[]) {
  const seen = new Set<string>();
  const output: DiagramNodeSeed[] = [];

  for (const seed of seeds) {
    const key = `${seed.lane}:${seed.label.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(seed);
  }

  return output;
}

function getProviderDefaultsForLane(provider: ArchitectureProvider, lane: DiagramLane) {
  return PROVIDER_DEFAULT_SEEDS[provider]
    .filter((seed) => seed.lane === lane)
    .map((seed) => ({ ...seed }));
}

function removeGenericDuplicates(lane: NonSourceLane, seeds: DiagramNodeSeed[]) {
  const hasSpecificNode = seeds.some((seed) => SPECIFIC_NODE_HINTS[lane].some((pattern) => pattern.test(seed.label)));
  if (!hasSpecificNode) {
    return seeds;
  }

  return seeds.filter((seed) => !GENERIC_NODE_LABELS[lane].includes(seed.label.toLowerCase()));
}

function isHybridNarrative(narrative: string) {
  const normalized = normalizeToken(narrative);
  return HYBRID_SOURCE_TERMS.some((term) => normalized.includes(normalizeToken(term)));
}

function enrichMentionOrder(seed: DiagramNodeSeed, narrative: string) {
  if (seed.mentionOrder !== MISSING_MENTION_ORDER) {
    return seed;
  }

  return {
    ...seed,
    mentionOrder: getFirstMentionOrder(narrative, [seed.label]),
  };
}

function collectNodesFromNarrative(provider: ArchitectureProvider, narrative: string) {
  const input = narrative.trim() || DEFAULT_NARRATIVE;
  const template = detectDiagramTemplate(input);
  const tokens = extractServiceTokens(provider, input).filter((token) => !LOW_SIGNAL_TOKENS.has(token));

  const buckets: Record<DiagramLane, DiagramNodeSeed[]> = {
    source: getProviderDefaultsForLane(provider, "source"),
    edge: [],
    application: [],
    data: [],
    operations: [],
  };

  if (template === "hybrid" && isHybridNarrative(input)) {
    buckets.source.push({
      label: "On-Prem Systems",
      lane: "source",
      priority: 1,
      mentionOrder: getFirstMentionOrder(input, HYBRID_SOURCE_TERMS),
    });
  }

  for (const token of tokens) {
    const rule = findIconRule(provider, token);
    const lane = rule?.lane ?? inferLane(token);
    const iconKey = rule?.iconKey ?? FALLBACK_LANE_ICON_KEYS[provider][lane];
    const mentionOrder = getFirstMentionOrder(input, rule?.keywords ?? [token]);

    buckets[lane].push({
      label: rule?.label ?? normalizeLabel(token),
      lane,
      iconKey,
      iconPath: iconPathFromKey(iconKey),
      priority: rule?.priority ?? 900,
      mentionOrder,
    });
  }

  for (const lane of NON_SOURCE_LANES) {
    if (buckets[lane].length === 0) {
      buckets[lane].push(...getProviderDefaultsForLane(provider, lane));
    }
    buckets[lane] = removeGenericDuplicates(lane, buckets[lane]).map((seed) => enrichMentionOrder(seed, input));
  }

  buckets.source = buckets.source.map((seed) => enrichMentionOrder(seed, input));

  const nodes: DiagramNode[] = [];
  for (const lane of ["source", ...NON_SOURCE_LANES] as DiagramLane[]) {
    const sorted = dedupeSeeds(buckets[lane])
      .sort((a, b) => {
        if (a.mentionOrder !== b.mentionOrder) {
          return a.mentionOrder - b.mentionOrder;
        }
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.label.localeCompare(b.label);
      })
      .slice(0, MAX_NODES_PER_LANE[lane]);

    sorted.forEach((seed, index) => {
      nodes.push({
        id: `node-${lane}-${index + 1}`,
        label: seed.label,
        lane,
        iconKey: seed.iconKey,
        iconPath: seed.iconPath ?? (seed.iconKey ? iconPathFromKey(seed.iconKey) : undefined),
        priority: seed.priority,
        mentionOrder: seed.mentionOrder,
      });
    });
  }

  return {
    nodes,
    template,
  };
}

function pushUniqueEdge(edges: DiagramEdge[], edge: DiagramEdge) {
  if (edge.from === edge.to) {
    return;
  }
  const key = `${edge.from}>${edge.to}>${edge.kind}`;
  if (edges.some((existing) => `${existing.from}>${existing.to}>${existing.kind}` === key)) {
    return;
  }
  edges.push(edge);
}

function sortLaneNodes(nodes: DiagramNode[]) {
  return [...nodes].sort((a, b) => {
    if (a.mentionOrder !== b.mentionOrder) {
      return a.mentionOrder - b.mentionOrder;
    }
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.label.localeCompare(b.label);
  });
}

function buildEdges(nodes: DiagramNode[], template: DiagramTemplate) {
  const byLane: Record<DiagramLane, DiagramNode[]> = {
    source: sortLaneNodes(nodes.filter((node) => node.lane === "source")),
    edge: sortLaneNodes(nodes.filter((node) => node.lane === "edge")),
    application: sortLaneNodes(nodes.filter((node) => node.lane === "application")),
    data: sortLaneNodes(nodes.filter((node) => node.lane === "data")),
    operations: sortLaneNodes(nodes.filter((node) => node.lane === "operations")),
  };

  const edges: DiagramEdge[] = [];
  const labels = TEMPLATE_EDGE_LABELS[template];
  const sourceMain = byLane.source[0];
  const sourceSecondary = byLane.source[1];
  const edgeMain = byLane.edge[0];
  const appMain = byLane.application[0];
  const appSecondary = byLane.application[1];
  const dataMain = byLane.data[0];
  const dataSecondary = byLane.data[1];
  const opsMain = byLane.operations[0];

  if (sourceMain && edgeMain) {
    pushUniqueEdge(edges, { from: sourceMain.id, to: edgeMain.id, kind: "primary", label: labels.sourceToEdge });
  }

  if (sourceSecondary && edgeMain) {
    pushUniqueEdge(edges, {
      from: sourceSecondary.id,
      to: edgeMain.id,
      kind: template === "hybrid" ? "primary" : "secondary",
      label: template === "hybrid" ? "Private link" : "Source path",
    });
  }

  if (edgeMain && appMain) {
    pushUniqueEdge(edges, { from: edgeMain.id, to: appMain.id, kind: "primary", label: labels.edgeToApp });
  }
  if (appMain && dataMain) {
    pushUniqueEdge(edges, { from: appMain.id, to: dataMain.id, kind: "primary", label: labels.appToData });
  }

  byLane.edge.slice(1).forEach((node) => {
    if (edgeMain) {
      pushUniqueEdge(edges, { from: edgeMain.id, to: node.id, kind: "secondary", label: "Aux edge path" });
    }
  });

  byLane.application.slice(1).forEach((node, index) => {
    const parent = byLane.edge[Math.min(index, byLane.edge.length - 1)] ?? edgeMain;
    if (parent) {
      pushUniqueEdge(edges, { from: parent.id, to: node.id, kind: "secondary", label: "Service fanout" });
    }
  });

  byLane.data.slice(1).forEach((node, index) => {
    const parent = byLane.application[Math.min(index, byLane.application.length - 1)] ?? appMain;
    if (parent) {
      pushUniqueEdge(edges, { from: parent.id, to: node.id, kind: "secondary", label: "Data dependency" });
    }
  });

  if (template === "event-driven" && dataMain && appSecondary) {
    pushUniqueEdge(edges, { from: dataMain.id, to: appSecondary.id, kind: "primary", label: "Event consumers" });
  }

  if (template === "data-platform" && dataMain && dataSecondary) {
    pushUniqueEdge(edges, { from: dataMain.id, to: dataSecondary.id, kind: "primary", label: "Transform / serve" });
  }

  if (template === "multi-region-dr") {
    if (appMain && appSecondary) {
      pushUniqueEdge(edges, { from: appMain.id, to: appSecondary.id, kind: "secondary", label: "Failover" });
    }
    if (dataMain && dataSecondary) {
      pushUniqueEdge(edges, { from: dataMain.id, to: dataSecondary.id, kind: "secondary", label: "Replication" });
    }
  }

  if (opsMain) {
    [...byLane.application.slice(0, 3), ...byLane.data.slice(0, 2)].forEach((node) => {
      pushUniqueEdge(edges, { from: node.id, to: opsMain.id, kind: "secondary", label: "Telemetry" });
    });

    byLane.operations.slice(1).forEach((node) => {
      pushUniqueEdge(edges, { from: opsMain.id, to: node.id, kind: "secondary", label: "Control plane" });
    });
  }

  return edges;
}

function wrapLabelLines(label: string, maxChars = 24, maxLines = 2) {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [label];
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }
    currentLine = word;

    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}

function buildLayout(width: number, height: number): Layout {
  const bodyTop = 122;
  const bodyHeight = height - bodyTop - 34;
  const sourceZone: Rect = {
    x: 36,
    y: bodyTop + 72,
    width: 196,
    height: bodyHeight - 120,
  };
  const cloudRect: Rect = {
    x: 252,
    y: bodyTop,
    width: width - 286,
    height: bodyHeight,
  };

  const zoneWidths: Record<NonSourceLane, number> = {
    edge: 266,
    application: 370,
    data: 266,
    operations: 330,
  };
  const zoneGap = 18;
  const totalZonesWidth =
    zoneWidths.edge + zoneWidths.application + zoneWidths.data + zoneWidths.operations + zoneGap * 3;
  let laneStartX = cloudRect.x + Math.floor((cloudRect.width - totalZonesWidth) / 2);
  const minStartX = cloudRect.x + 20;
  if (laneStartX < minStartX) {
    laneStartX = minStartX;
  }

  const laneZones: Record<NonSourceLane, Rect> = {
    edge: {
      x: laneStartX,
      y: sourceZone.y,
      width: zoneWidths.edge,
      height: sourceZone.height,
    },
    application: {
      x: laneStartX + zoneWidths.edge + zoneGap,
      y: sourceZone.y,
      width: zoneWidths.application,
      height: sourceZone.height,
    },
    data: {
      x: laneStartX + zoneWidths.edge + zoneWidths.application + zoneGap * 2,
      y: sourceZone.y,
      width: zoneWidths.data,
      height: sourceZone.height,
    },
    operations: {
      x: laneStartX + zoneWidths.edge + zoneWidths.application + zoneWidths.data + zoneGap * 3,
      y: sourceZone.y,
      width: zoneWidths.operations,
      height: sourceZone.height,
    },
  };

  return {
    sourceZone,
    cloudRect,
    laneZones,
  };
}

function laneNodeRectConfig(lane: DiagramLane, zone: Rect) {
  if (lane === "source") {
    return {
      width: Math.min(zone.width - 16, 172),
      height: 90,
      topPadding: 86,
      bottomPadding: 28,
      gap: 22,
    };
  }

  if (lane === "application") {
    return {
      width: Math.min(zone.width - 20, 320),
      height: 86,
      topPadding: 84,
      bottomPadding: 26,
      gap: 24,
    };
  }

  if (lane === "operations") {
    return {
      width: Math.min(zone.width - 20, 290),
      height: 84,
      topPadding: 84,
      bottomPadding: 26,
      gap: 24,
    };
  }

  return {
    width: Math.min(zone.width - 20, 238),
    height: 84,
    topPadding: 84,
    bottomPadding: 26,
    gap: 24,
  };
}

const FLOW_ROW_OFFSETS = [0, 1, -1, 2, -2];

function layoutNodeRects(nodes: DiagramNode[], layout: Layout) {
  const rects = new Map<string, Rect>();
  const sourceNodes = sortLaneNodes(nodes.filter((node) => node.lane === "source"));
  if (sourceNodes.length > 0) {
    const zone = layout.sourceZone;
    const config = laneNodeRectConfig("source", zone);
    const minY = zone.y + config.topPadding;
    const maxY = zone.y + zone.height - config.bottomPadding - config.height;
    const centerY = zone.y + Math.floor((zone.height - config.height) / 2);
    const step = config.height + 18;
    const nodeX = zone.x + Math.floor((zone.width - config.width) / 2);

    sourceNodes.forEach((node, index) => {
      const offset = FLOW_ROW_OFFSETS[index] ?? index;
      const rawY = centerY + offset * step;
      const y = Math.max(minY, Math.min(maxY, rawY));
      rects.set(node.id, {
        x: nodeX,
        y,
        width: config.width,
        height: config.height,
      });
    });
  }

  for (const lane of NON_SOURCE_LANES) {
    const laneNodes = sortLaneNodes(nodes.filter((node) => node.lane === lane));
    if (laneNodes.length === 0) {
      continue;
    }

    const zone = layout.laneZones[lane];
    const config = laneNodeRectConfig(lane, zone);
    const minY = zone.y + config.topPadding;
    const maxY = zone.y + zone.height - config.bottomPadding - config.height;
    const centerY = zone.y + Math.floor((zone.height - config.height) / 2);
    const step = config.height + 18;
    const nodeX = zone.x + Math.floor((zone.width - config.width) / 2);

    laneNodes.forEach((node, index) => {
      const offset = FLOW_ROW_OFFSETS[index] ?? index;
      const rawY = centerY + offset * step;
      const y = Math.max(minY, Math.min(maxY, rawY));
      rects.set(node.id, {
        x: nodeX,
        y,
        width: config.width,
        height: config.height,
      });
    });
  }

  return rects;
}

function routeConnectorPath(from: Rect, to: Rect, channel: number) {
  const channelOffset = channel * 10;
  const fromCenterX = from.x + from.width / 2;
  const fromCenterY = from.y + from.height / 2;
  const toCenterX = to.x + to.width / 2;
  const toCenterY = to.y + to.height / 2;

  if (to.x >= from.x + from.width) {
    const sx = from.x + from.width;
    const sy = fromCenterY;
    const ex = to.x;
    const ey = toCenterY;
    if (Math.abs(sy - ey) < 2) {
      return `M ${sx} ${sy} L ${ex} ${ey}`;
    }
    const midX = Math.round((sx + ex) / 2 + channelOffset);
    return `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}`;
  }

  if (to.x + to.width <= from.x) {
    const sx = from.x;
    const sy = fromCenterY;
    const ex = to.x + to.width;
    const ey = toCenterY;
    if (Math.abs(sy - ey) < 2) {
      return `M ${sx} ${sy} L ${ex} ${ey}`;
    }
    const midX = Math.round((sx + ex) / 2 + channelOffset);
    return `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}`;
  }

  if (to.y >= from.y + from.height) {
    const sx = fromCenterX;
    const sy = from.y + from.height;
    const ex = toCenterX;
    const ey = to.y;
    if (Math.abs(sx - ex) < 2) {
      return `M ${sx} ${sy} L ${ex} ${ey}`;
    }
    const midY = Math.round((sy + ey) / 2 + channelOffset);
    return `M ${sx} ${sy} L ${sx} ${midY} L ${ex} ${midY} L ${ex} ${ey}`;
  }

  const sx = fromCenterX;
  const sy = from.y;
  const ex = toCenterX;
  const ey = to.y + to.height;
  if (Math.abs(sx - ex) < 2) {
    return `M ${sx} ${sy} L ${ex} ${ey}`;
  }
  const midY = Math.round((sy + ey) / 2 + channelOffset);
  return `M ${sx} ${sy} L ${sx} ${midY} L ${ex} ${midY} L ${ex} ${ey}`;
}

function renderNodeFallbackIcon(rect: Rect, label: string, accent: string) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);

  const x = rect.x + 14;
  const y = rect.y + Math.round(rect.height / 2 - 18);
  return [
    `<circle cx="${x + 18}" cy="${y + 18}" r="18" fill="${accent}" opacity="0.18" />`,
    `<text x="${x + 18}" y="${y + 23}" text-anchor="middle" fill="${accent}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="12" font-weight="700">${escapeXml(initials || "N")}</text>`,
  ].join("");
}

function resolveIconHref(node: DiagramNode) {
  if (node.iconKey) {
    const embedded = getArchitectureIconEmbed(node.iconKey);
    if (embedded) {
      return embedded;
    }
  }

  if (node.iconPath) {
    return node.iconPath;
  }

  if (node.iconKey) {
    return iconPathFromKey(node.iconKey);
  }

  return null;
}

// ARCH-01: the generated diagram is re-checked by the project's own `validateSvgMarkup`, which
// rejects `data:` references (a defense for untrusted uploads). The icon embeds are
// `data:image/svg+xml;base64,...` URIs, so a `<image href="data:...">` made the generator emit SVG
// its own validator refused. Inline the icon markup instead — decode the base64 SVG and nest it as
// a sized/positioned `<svg>` (keeping its root attributes and viewBox) so the output is self-
// contained and passes validation, with no behavioural change to how the icon renders.
function inlineIconMarkup(embed: string, x: number, y: number, size: number): string | null {
  const prefix = "data:image/svg+xml;base64,";
  if (!embed.startsWith(prefix)) {
    return null;
  }

  let raw: string;
  try {
    raw = Buffer.from(embed.slice(prefix.length), "base64").toString("utf8");
  } catch {
    return null;
  }

  raw = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .trim();

  const openMatch = raw.match(/<svg\b([^>]*)>/i);
  if (!openMatch || !raw.includes("</svg>")) {
    return null;
  }

  const keptAttrs = (openMatch[1] ?? "")
    .replace(/\s(?:width|height|x|y)\s*=\s*["'][^"']*["']/gi, "")
    .trim();
  const hasViewBox = /viewBox\s*=/i.test(keptAttrs);
  const sizing = `x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" overflow="visible"`;
  const newOpen = `<svg ${hasViewBox ? "" : 'viewBox="0 0 40 40" '}${keptAttrs ? `${keptAttrs} ` : ""}${sizing}>`;

  return raw.replace(openMatch[0], newOpen);
}

function buildBoundaryOverlays(provider: ArchitectureProvider, template: DiagramTemplate, layout: Layout): BoundaryOverlay[] {
  const edgeZone = layout.laneZones.edge;
  const appZone = layout.laneZones.application;
  const dataZone = layout.laneZones.data;
  const opsZone = layout.laneZones.operations;
  const dataExtentX = dataZone.x + dataZone.width;
  const allLaneExtentX = opsZone.x + opsZone.width;
  const overlays: BoundaryOverlay[] = [];

  if (provider === "aws") {
    overlays.push({
      rect: {
        x: edgeZone.x - 12,
        y: layout.cloudRect.y + 66,
        width: dataExtentX - edgeZone.x + 24,
        height: edgeZone.height + 18,
      },
      label: "AWS Region",
      subtitle: template === "multi-region-dr" ? "Primary region shown" : "Single region scope",
    });
    overlays.push({
      rect: {
        x: edgeZone.x + 10,
        y: edgeZone.y + 58,
        width: dataExtentX - edgeZone.x - 20,
        height: edgeZone.height - 74,
      },
      label: "VPC",
      subtitle: "Subnets and services within trust boundary",
    });
    return overlays;
  }

  if (provider === "azure") {
    overlays.push({
      rect: {
        x: edgeZone.x - 12,
        y: layout.cloudRect.y + 66,
        width: allLaneExtentX - edgeZone.x + 24,
        height: edgeZone.height + 18,
      },
      label: "Azure Region",
      subtitle: template === "multi-region-dr" ? "Primary region shown" : "Regional deployment boundary",
    });
    overlays.push({
      rect: {
        x: edgeZone.x + 10,
        y: edgeZone.y + 58,
        width: dataExtentX - edgeZone.x - 20,
        height: edgeZone.height - 74,
      },
      label: "VNet",
      subtitle: "Application and data tiers in one VNet",
    });
    if (template === "multi-region-dr") {
      overlays.push({
        rect: {
          x: opsZone.x + 16,
          y: opsZone.y + 96,
          width: opsZone.width - 32,
          height: 138,
        },
        label: "Secondary Region (DR)",
        subtitle: "Replicated failover target",
        style: "dashed",
      });
    }
    return overlays;
  }

  overlays.push({
    rect: {
      x: edgeZone.x - 12,
      y: layout.cloudRect.y + 66,
      width: dataExtentX - edgeZone.x + 24,
      height: edgeZone.height + 18,
    },
    label: "VPC Network (Global)",
    subtitle: "Global network with regional segmentation",
  });
  overlays.push({
    rect: {
      x: appZone.x + 8,
      y: appZone.y + 58,
      width: dataExtentX - appZone.x - 16,
      height: appZone.height - 74,
    },
    label: "Regional Subnets",
    subtitle: "Regional subnet scope for app and data services",
    style: "dashed",
  });
  return overlays;
}

function renderBoundaryOverlays(theme: ProviderTheme, overlays: BoundaryOverlay[]) {
  return overlays
    .map((overlay) => {
      const strokeDash = overlay.style === "dashed" ? ' stroke-dasharray="10 8"' : "";
      const labelX = overlay.rect.x + 14;
      const labelY = overlay.rect.y + 24;
      const subtitleY = labelY + 16;
      return [
        `<rect x="${overlay.rect.x}" y="${overlay.rect.y}" width="${overlay.rect.width}" height="${overlay.rect.height}" rx="16" fill="none" stroke="${theme.zoneStroke}" stroke-width="1.6"${strokeDash} />`,
        `<text x="${labelX}" y="${labelY}" fill="${theme.textStrong}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="11" font-weight="700">${escapeXml(overlay.label)}</text>`,
        overlay.subtitle
          ? `<text x="${labelX}" y="${subtitleY}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="10.5">${escapeXml(overlay.subtitle)}</text>`
          : "",
      ].join("");
    })
    .join("");
}

function buildTemplateTitle(provider: ArchitectureProvider, template: DiagramTemplate) {
  const suffix: Record<DiagramTemplate, string> = {
    "web-tier": "reference architecture",
    "event-driven": "event-driven architecture",
    "data-platform": "data platform architecture",
    hybrid: "hybrid architecture",
    "multi-region-dr": "multi-region DR architecture",
  };
  return `${provider.toUpperCase()} ${suffix[template]}`;
}

function renderSvg(input: {
  provider: ArchitectureProvider;
  template: DiagramTemplate;
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}) {
  const theme = PROVIDER_THEMES[input.provider];
  const width = 1680;
  const height = 1040;
  const layout = buildLayout(width, height);
  const nodeRects = layoutNodeRects(input.nodes, layout);
  const boundaryOverlays = buildBoundaryOverlays(input.provider, input.template, layout);
  const sourceHint = TEMPLATE_SOURCE_HINTS[input.template];

  const laneZones = NON_SOURCE_LANES.map((lane) => {
    const rect = layout.laneZones[lane];
    return [
      `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="18" fill="${theme.zoneFill}" stroke="${theme.zoneStroke}" stroke-width="1.5" />`,
      `<text x="${rect.x + 16}" y="${rect.y + 30}" fill="${theme.textStrong}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="16" font-weight="700">${escapeXml(LANE_LABELS[lane])}</text>`,
      `<text x="${rect.x + 16}" y="${rect.y + 50}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="12">${escapeXml(LANE_DESCRIPTIONS[lane])}</text>`,
    ].join("");
  }).join("");

  const sourceZoneSvg = [
    `<rect x="${layout.sourceZone.x}" y="${layout.sourceZone.y}" width="${layout.sourceZone.width}" height="${layout.sourceZone.height}" rx="18" fill="${theme.sourceFill}" stroke="${theme.sourceStroke}" stroke-width="1.5" />`,
    `<text x="${layout.sourceZone.x + 14}" y="${layout.sourceZone.y + 30}" fill="${theme.textStrong}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="15" font-weight="700">${escapeXml(LANE_LABELS.source)}</text>`,
    `<text x="${layout.sourceZone.x + 14}" y="${layout.sourceZone.y + 49}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="12">${escapeXml(sourceHint)}</text>`,
  ].join("");

  const edgesByKind = {
    secondary: input.edges.filter((edge) => edge.kind === "secondary"),
    primary: input.edges.filter((edge) => edge.kind === "primary"),
  };

  const secondaryEdges = edgesByKind.secondary
    .map((edge, index) => {
      const from = nodeRects.get(edge.from);
      const to = nodeRects.get(edge.to);
      if (!from || !to) {
        return "";
      }
      const channel = ((index % 5) - 2) as number;
      const path = routeConnectorPath(from, to, channel);
      const labelX = Math.round((from.x + from.width / 2 + to.x + to.width / 2) / 2);
      const labelY = Math.round((from.y + from.height / 2 + to.y + to.height / 2) / 2 - 8);
      return [
        `<path d="${path}" fill="none" stroke="${theme.accentMuted}" stroke-width="2" stroke-dasharray="8 6" opacity="0.9" marker-end="url(#arrow-secondary)" />`,
        edge.label
          ? `<text x="${labelX}" y="${labelY}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="10.5" font-weight="600">${escapeXml(edge.label)}</text>`
          : "",
      ].join("");
    })
    .join("");

  const primaryEdges = edgesByKind.primary
    .map((edge, index) => {
      const from = nodeRects.get(edge.from);
      const to = nodeRects.get(edge.to);
      if (!from || !to) {
        return "";
      }
      const channel = ((index % 3) - 1) as number;
      const path = routeConnectorPath(from, to, channel);
      const labelX = Math.round((from.x + from.width / 2 + to.x + to.width / 2) / 2);
      const labelY = Math.round((from.y + from.height / 2 + to.y + to.height / 2) / 2 - 10);
      return [
        `<path d="${path}" fill="none" stroke="${theme.accent}" stroke-width="3" stroke-linecap="round" marker-end="url(#arrow-primary)" />`,
        edge.label
          ? `<text x="${labelX}" y="${labelY}" fill="${theme.textStrong}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="10.5" font-weight="700">${escapeXml(edge.label)}</text>`
          : "",
      ].join("");
    })
    .join("");

  const nodesSvg = input.nodes
    .map((node) => {
      const rect = nodeRects.get(node.id);
      if (!rect) {
        return "";
      }

      const iconHref = resolveIconHref(node);
      const lines = wrapLabelLines(node.label, node.lane === "operations" ? 28 : 24, 2);
      const textX = rect.x + 74;
      const textYStart = rect.y + Math.round(rect.height / 2) - (lines.length - 1) * 10;
      const label = lines
        .map(
          (line, index) =>
            `<tspan x="${textX}" y="${textYStart + index * 20}">${escapeXml(line)}</tspan>`,
        )
        .join("");

      const iconSize = 32;
      const iconX = rect.x + 16;
      const iconY = rect.y + Math.round((rect.height - iconSize) / 2);
      const inlinedIcon =
        iconHref && iconHref.startsWith("data:") ? inlineIconMarkup(iconHref, iconX, iconY, iconSize) : null;
      const iconSvg = inlinedIcon
        ? inlinedIcon
        : iconHref && !iconHref.startsWith("data:")
          ? `<image href="${escapeXml(iconHref)}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" preserveAspectRatio="xMidYMid meet" />`
          : renderNodeFallbackIcon(rect, node.label, theme.accent);

      return [
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="14" fill="${theme.nodeFill}" stroke="${theme.nodeStroke}" stroke-width="1.5" filter="url(#node-shadow)" />`,
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="11" rx="11" fill="${theme.accentSoft}" />`,
        `<rect x="${rect.x + 10}" y="${rect.y + Math.round((rect.height - 46) / 2)}" width="46" height="46" rx="12" fill="#ffffff" stroke="${theme.nodeStroke}" stroke-width="1.2" />`,
        iconSvg,
        `<text x="${textX}" y="${rect.y + Math.round(rect.height / 2)}" fill="${theme.textStrong}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="14.5" font-weight="700">${label}</text>`,
      ].join("");
    })
    .join("");

  const legendX = layout.cloudRect.x + 26;
  const legendY = layout.cloudRect.y + layout.cloudRect.height - 54;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(input.title)}">`,
    "<defs>",
    '<linearGradient id="canvas-gradient" x1="0%" y1="0%" x2="0%" y2="100%">',
    `<stop offset="0%" stop-color="${theme.surface}" />`,
    '<stop offset="100%" stop-color="#f2f6fb" />',
    "</linearGradient>",
    '<filter id="node-shadow" x="-25%" y="-25%" width="150%" height="170%">',
    '<feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-opacity="0.14"/>',
    "</filter>",
    '<marker id="arrow-primary" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">',
    `<path d="M0,0 L9,4.5 L0,9 Z" fill="${theme.accent}" />`,
    "</marker>",
    '<marker id="arrow-secondary" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">',
    `<path d="M0,0 L8,4 L0,8 Z" fill="${theme.accentMuted}" />`,
    "</marker>",
    "</defs>",
    `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#canvas-gradient)" />`,
    `<rect x="0" y="0" width="${width}" height="92" fill="${theme.accentSoft}" />`,
    `<text x="34" y="49" fill="${theme.textStrong}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="56" font-weight="700">${escapeXml(input.title)}</text>`,
    `<text x="34" y="84" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="19">${escapeXml(TEMPLATE_SUBTITLES[input.template])}</text>`,
    `<text x="${width - 180}" y="53" fill="${theme.accent}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="36" font-weight="700">${input.provider.toUpperCase()}</text>`,
    `<rect x="${layout.cloudRect.x}" y="${layout.cloudRect.y}" width="${layout.cloudRect.width}" height="${layout.cloudRect.height}" rx="24" fill="${theme.cloudFill}" stroke="${theme.cloudStroke}" stroke-width="1.8" />`,
    `<text x="${layout.cloudRect.x + 24}" y="${layout.cloudRect.y + 34}" fill="${theme.textStrong}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="16" font-weight="700">${escapeXml(input.provider.toUpperCase())} Cloud Boundary</text>`,
    `<text x="${layout.cloudRect.x + 24}" y="${layout.cloudRect.y + 54}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="12">Public-to-private flow with service grouping and operational overlays</text>`,
    sourceZoneSvg,
    laneZones,
    renderBoundaryOverlays(theme, boundaryOverlays),
    secondaryEdges,
    primaryEdges,
    nodesSvg,
    `<text x="${legendX}" y="${legendY}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="12">Legend</text>`,
    `<line x1="${legendX + 48}" y1="${legendY - 4}" x2="${legendX + 110}" y2="${legendY - 4}" stroke="${theme.accent}" stroke-width="3" marker-end="url(#arrow-primary)" />`,
    `<text x="${legendX + 122}" y="${legendY}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="12">Primary request/data flow</text>`,
    `<line x1="${legendX + 48}" y1="${legendY + 16}" x2="${legendX + 110}" y2="${legendY + 16}" stroke="${theme.accentMuted}" stroke-width="2" stroke-dasharray="8 6" marker-end="url(#arrow-secondary)" />`,
    `<text x="${legendX + 122}" y="${legendY + 20}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="12">Telemetry, control, or secondary paths</text>`,
    `<text x="34" y="${height - 14}" fill="${theme.textMuted}" font-family="IBM Plex Sans, Segoe UI, sans-serif" font-size="11">Icons map to official ${input.provider.toUpperCase()} icon names. Rendering is deterministic for repeatable outputs.</text>`,
    "</svg>",
  ].join("");
}

export function generateArchitectureDiagramFromNarrative(input: {
  provider: ArchitectureProvider;
  narrative: string;
}): GeneratedArchitectureDiagram {
  const trimmed = input.narrative.trim();
  const { nodes, template } = collectNodesFromNarrative(input.provider, trimmed);
  const edges = buildEdges(nodes, template);
  const title = buildTemplateTitle(input.provider, template);
  const svg = renderSvg({
    provider: input.provider,
    template,
    title,
    nodes,
    edges,
  });

  return {
    provider: input.provider,
    template,
    svg,
    nodes,
    edges,
    title,
  };
}

export function makeGeneratedDiagramSvgFile(input: {
  provider: ArchitectureProvider;
  svg: string;
  at?: Date;
}) {
  const now = input.at ?? new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const filename = `generated-${input.provider}-architecture-${stamp}.svg`;
  return new File([input.svg], filename, {
    type: "image/svg+xml",
  });
}
