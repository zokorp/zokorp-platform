import type { ArchitecturePlatform, ArchitectureProvider } from "@/lib/architecture-review/types";

type ObservationProviderKey = ArchitectureProvider | "multi" | ArchitecturePlatform;

// A "what I saw" observation that echoes back the architecture's structure
// in tiered language, the way a senior reviewer would summarize a diagram in
// the first 60 seconds of a call. Pure-text, deterministic — same narrative
// always produces the same observation.

type ObservationTier =
  | "edge"
  | "identity"
  | "compute"
  | "data"
  | "messaging"
  | "observability"
  | "security"
  | "networking";

type ObservationKeyword = {
  pattern: RegExp;
  service: string;
};

const TIER_LABELS: Record<ObservationTier, string> = {
  edge: "Edge / ingress",
  identity: "Identity",
  compute: "Compute",
  data: "Data",
  messaging: "Messaging / async",
  observability: "Observability",
  security: "Security",
  networking: "Networking",
};

const TIER_ORDER: ObservationTier[] = [
  "edge",
  "identity",
  "compute",
  "data",
  "messaging",
  "observability",
  "security",
  "networking",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenPattern(...tokens: string[]): RegExp {
  const escaped = tokens.map(escapeRegex).join("|");
  return new RegExp(`\\b(?:${escaped})\\b`, "i");
}

const KEYWORDS_BY_TIER_AND_PROVIDER: Record<
  ObservationTier,
  Partial<Record<ObservationProviderKey, ObservationKeyword[]>>
> = {
  edge: {
    aws: [
      { pattern: tokenPattern("CloudFront"), service: "CloudFront" },
      { pattern: tokenPattern("Application Load Balancer", "ALB"), service: "Application Load Balancer (ALB)" },
      { pattern: tokenPattern("Network Load Balancer", "NLB"), service: "Network Load Balancer (NLB)" },
      { pattern: tokenPattern("API Gateway"), service: "API Gateway" },
      { pattern: tokenPattern("Route 53"), service: "Route 53 DNS" },
      { pattern: tokenPattern("AWS WAF", "WAF"), service: "WAF" },
      { pattern: tokenPattern("Shield"), service: "AWS Shield" },
    ],
    azure: [
      { pattern: tokenPattern("Application Gateway"), service: "Application Gateway" },
      { pattern: tokenPattern("Front Door"), service: "Azure Front Door" },
      { pattern: tokenPattern("Azure CDN", "CDN"), service: "Azure CDN" },
      { pattern: tokenPattern("WAF"), service: "Azure WAF" },
      { pattern: tokenPattern("DDoS Protection"), service: "DDoS Protection" },
    ],
    gcp: [
      { pattern: tokenPattern("Cloud CDN"), service: "Cloud CDN" },
      { pattern: tokenPattern("HTTPS Load Balancer", "HTTP Load Balancer", "Cloud Load Balancing"), service: "Cloud Load Balancing" },
      { pattern: tokenPattern("Cloud Armor"), service: "Cloud Armor" },
    ],
    multi: [{ pattern: tokenPattern("load balancer"), service: "load balancer" }],
  },
  identity: {
    aws: [
      { pattern: tokenPattern("IAM Identity Center"), service: "IAM Identity Center" },
      { pattern: tokenPattern("Cognito"), service: "Cognito" },
      { pattern: tokenPattern("IAM"), service: "IAM" },
    ],
    azure: [
      { pattern: tokenPattern("Entra ID", "Entra"), service: "Entra ID" },
      { pattern: tokenPattern("Managed Identity"), service: "Managed Identity" },
      { pattern: tokenPattern("Azure Active Directory"), service: "Azure Active Directory" },
    ],
    gcp: [
      { pattern: tokenPattern("Cloud IAM"), service: "Cloud IAM" },
      { pattern: tokenPattern("Identity Platform"), service: "Identity Platform" },
    ],
  },
  compute: {
    aws: [
      { pattern: tokenPattern("EC2"), service: "EC2" },
      { pattern: tokenPattern("ECS"), service: "ECS" },
      { pattern: tokenPattern("EKS"), service: "EKS" },
      { pattern: tokenPattern("Lambda"), service: "Lambda" },
      { pattern: tokenPattern("Fargate"), service: "Fargate" },
      { pattern: tokenPattern("Auto Scaling Group", "Auto Scaling"), service: "Auto Scaling" },
      { pattern: tokenPattern("Beanstalk"), service: "Elastic Beanstalk" },
    ],
    azure: [
      { pattern: tokenPattern("App Service"), service: "App Service" },
      { pattern: tokenPattern("Azure Functions", "Functions"), service: "Azure Functions" },
      { pattern: tokenPattern("AKS", "Azure Kubernetes Service"), service: "AKS" },
      { pattern: tokenPattern("Container Apps"), service: "Container Apps" },
    ],
    gcp: [
      { pattern: tokenPattern("Compute Engine"), service: "Compute Engine" },
      { pattern: tokenPattern("GKE", "Kubernetes Engine"), service: "GKE" },
      { pattern: tokenPattern("Cloud Run"), service: "Cloud Run" },
      { pattern: tokenPattern("Cloud Functions"), service: "Cloud Functions" },
    ],
    multi: [
      { pattern: tokenPattern("microservice"), service: "microservices" },
      { pattern: tokenPattern("container"), service: "container workloads" },
      { pattern: tokenPattern("kubernetes", "k8s"), service: "Kubernetes" },
    ],
  },
  data: {
    aws: [
      { pattern: tokenPattern("RDS"), service: "RDS" },
      { pattern: tokenPattern("Aurora"), service: "Aurora" },
      { pattern: tokenPattern("DynamoDB"), service: "DynamoDB" },
      { pattern: tokenPattern("ElastiCache"), service: "ElastiCache" },
      { pattern: tokenPattern("Redshift"), service: "Redshift" },
      { pattern: tokenPattern("S3"), service: "S3" },
      { pattern: tokenPattern("EFS"), service: "EFS" },
    ],
    azure: [
      { pattern: tokenPattern("Cosmos DB"), service: "Cosmos DB" },
      { pattern: tokenPattern("Azure SQL"), service: "Azure SQL" },
      { pattern: tokenPattern("Storage Account"), service: "Storage Account" },
      { pattern: tokenPattern("Blob Storage", "Azure Blob"), service: "Blob Storage" },
      { pattern: tokenPattern("Azure Cache for Redis"), service: "Azure Cache for Redis" },
    ],
    gcp: [
      { pattern: tokenPattern("Cloud SQL"), service: "Cloud SQL" },
      { pattern: tokenPattern("Spanner"), service: "Spanner" },
      { pattern: tokenPattern("BigQuery"), service: "BigQuery" },
      { pattern: tokenPattern("Firestore"), service: "Firestore" },
      { pattern: tokenPattern("Cloud Storage", "GCS"), service: "Cloud Storage" },
    ],
    snowflake: [
      { pattern: tokenPattern("warehouse", "warehouses"), service: "Snowflake warehouse" },
      { pattern: tokenPattern("database", "databases"), service: "database" },
      { pattern: tokenPattern("schema", "schemas"), service: "schema" },
      { pattern: tokenPattern("table", "tables"), service: "tables" },
    ],
  },
  messaging: {
    aws: [
      { pattern: tokenPattern("SQS"), service: "SQS" },
      { pattern: tokenPattern("SNS"), service: "SNS" },
      { pattern: tokenPattern("EventBridge"), service: "EventBridge" },
      { pattern: tokenPattern("Kinesis"), service: "Kinesis" },
      { pattern: tokenPattern("Step Functions"), service: "Step Functions" },
    ],
    azure: [
      { pattern: tokenPattern("Service Bus"), service: "Service Bus" },
      { pattern: tokenPattern("Event Hubs"), service: "Event Hubs" },
      { pattern: tokenPattern("Event Grid"), service: "Event Grid" },
      { pattern: tokenPattern("Logic Apps"), service: "Logic Apps" },
    ],
    gcp: [
      { pattern: tokenPattern("Pub/Sub", "Pubsub"), service: "Pub/Sub" },
      { pattern: tokenPattern("Cloud Tasks"), service: "Cloud Tasks" },
      { pattern: tokenPattern("Cloud Workflows"), service: "Workflows" },
    ],
    multi: [
      { pattern: tokenPattern("queue worker", "queue workers"), service: "queue workers" },
      { pattern: tokenPattern("background worker", "background workers"), service: "background workers" },
      { pattern: tokenPattern("event bus"), service: "event bus" },
    ],
  },
  observability: {
    aws: [
      { pattern: tokenPattern("CloudWatch"), service: "CloudWatch" },
      { pattern: tokenPattern("CloudTrail"), service: "CloudTrail" },
      { pattern: tokenPattern("X-Ray"), service: "X-Ray" },
    ],
    azure: [
      { pattern: tokenPattern("Application Insights"), service: "Application Insights" },
      { pattern: tokenPattern("Azure Monitor"), service: "Azure Monitor" },
      { pattern: tokenPattern("Log Analytics"), service: "Log Analytics" },
    ],
    gcp: [
      { pattern: tokenPattern("Cloud Logging"), service: "Cloud Logging" },
      { pattern: tokenPattern("Cloud Monitoring"), service: "Cloud Monitoring" },
      { pattern: tokenPattern("Cloud Trace"), service: "Cloud Trace" },
    ],
    multi: [
      { pattern: tokenPattern("Datadog"), service: "Datadog" },
      { pattern: tokenPattern("New Relic"), service: "New Relic" },
      { pattern: tokenPattern("Grafana"), service: "Grafana" },
      { pattern: tokenPattern("Prometheus"), service: "Prometheus" },
    ],
  },
  security: {
    aws: [
      { pattern: tokenPattern("KMS"), service: "KMS" },
      { pattern: tokenPattern("Secrets Manager"), service: "Secrets Manager" },
      { pattern: tokenPattern("GuardDuty"), service: "GuardDuty" },
      { pattern: tokenPattern("AWS Config"), service: "AWS Config" },
      { pattern: tokenPattern("Inspector"), service: "Inspector" },
    ],
    azure: [
      { pattern: tokenPattern("Key Vault"), service: "Key Vault" },
      { pattern: tokenPattern("Sentinel"), service: "Sentinel" },
      { pattern: tokenPattern("Defender"), service: "Defender for Cloud" },
    ],
    gcp: [
      { pattern: tokenPattern("Cloud KMS"), service: "Cloud KMS" },
      { pattern: tokenPattern("Secret Manager"), service: "Secret Manager" },
      { pattern: tokenPattern("Security Command Center"), service: "Security Command Center" },
    ],
  },
  networking: {
    aws: [
      { pattern: tokenPattern("VPC"), service: "VPC" },
      { pattern: tokenPattern("NAT Gateway"), service: "NAT Gateway" },
      { pattern: tokenPattern("Transit Gateway"), service: "Transit Gateway" },
      { pattern: tokenPattern("Direct Connect"), service: "Direct Connect" },
      { pattern: tokenPattern("Site-to-Site VPN", "VPN"), service: "VPN" },
      { pattern: tokenPattern("private subnet", "private subnets"), service: "private subnets" },
      { pattern: tokenPattern("public subnet", "public subnets"), service: "public subnets" },
    ],
    azure: [
      { pattern: tokenPattern("VNet"), service: "VNet" },
      { pattern: tokenPattern("ExpressRoute"), service: "ExpressRoute" },
      { pattern: tokenPattern("VPN Gateway"), service: "VPN Gateway" },
    ],
    gcp: [
      { pattern: tokenPattern("VPC Network", "VPC"), service: "VPC" },
      { pattern: tokenPattern("Cloud NAT"), service: "Cloud NAT" },
      { pattern: tokenPattern("Cloud Interconnect"), service: "Cloud Interconnect" },
      { pattern: tokenPattern("Cloud VPN"), service: "Cloud VPN" },
    ],
  },
};

export type ArchitectureObservation = {
  tiersInOrder: Array<{
    tier: ObservationTier;
    label: string;
    services: string[];
  }>;
  observationCount: number;
};

function buildObservationFromText(
  text: string,
  provider: ArchitectureProvider,
  platforms: ArchitecturePlatform[],
): ArchitectureObservation {
  const tiers: ArchitectureObservation["tiersInOrder"] = [];

  const baseProviders: ObservationProviderKey[] =
    provider === "multi" ? ["aws", "azure", "gcp", "multi"] : [provider, "multi"];
  const providersToCheck: ObservationProviderKey[] = [...baseProviders, ...platforms];

  for (const tier of TIER_ORDER) {
    const tierConfig = KEYWORDS_BY_TIER_AND_PROVIDER[tier];
    const collected = new Set<string>();

    for (const providerKey of providersToCheck) {
      const keywords = tierConfig[providerKey];
      if (!keywords) {
        continue;
      }

      for (const keyword of keywords) {
        if (keyword.pattern.test(text)) {
          collected.add(keyword.service);
        }
      }
    }

    if (collected.size > 0) {
      tiers.push({
        tier,
        label: TIER_LABELS[tier],
        services: [...collected],
      });
    }
  }

  const observationCount = tiers.reduce((sum, tier) => sum + tier.services.length, 0);
  return { tiersInOrder: tiers, observationCount };
}

export function buildArchitectureObservation(input: {
  flowNarrative: string;
  provider: ArchitectureProvider;
  platforms?: ArchitecturePlatform[];
  ocrText?: string | null;
}): ArchitectureObservation {
  const combinedText = `${input.flowNarrative}\n${input.ocrText ?? ""}`;
  return buildObservationFromText(combinedText, input.provider, input.platforms ?? []);
}

export function formatObservationLines(observation: ArchitectureObservation): string[] {
  return observation.tiersInOrder.map((tier) => `${tier.label}: ${tier.services.join(", ")}`);
}
