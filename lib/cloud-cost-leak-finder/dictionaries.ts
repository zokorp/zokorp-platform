import type {
  CloudProvider,
  ComplexitySignal,
  CostPainSignal,
  MaturityState,
  SpendFamily,
  WorkloadSignal,
} from "@/lib/cloud-cost-leak-finder/types";

export type ServiceAliasDefinition = {
  alias: string;
  service: string;
  family: SpendFamily;
  provider?: CloudProvider;
  workloadSignals?: WorkloadSignal[];
};

export const SERVICE_ALIASES: ServiceAliasDefinition[] = [
  { alias: "ec2", service: "Amazon EC2", family: "compute", provider: "aws", workloadSignals: ["vms"] },
  { alias: "elastic compute cloud", service: "Amazon EC2", family: "compute", provider: "aws", workloadSignals: ["vms"] },
  { alias: "rds", service: "Amazon RDS", family: "database", provider: "aws", workloadSignals: ["databases"] },
  { alias: "aurora", service: "Amazon Aurora", family: "database", provider: "aws", workloadSignals: ["databases"] },
  { alias: "dynamodb", service: "Amazon DynamoDB", family: "database", provider: "aws", workloadSignals: ["databases"] },
  { alias: "s3", service: "Amazon S3", family: "object_storage", provider: "aws", workloadSignals: ["storage_heavy"] },
  { alias: "eks", service: "Amazon EKS", family: "kubernetes", provider: "aws", workloadSignals: ["kubernetes"] },
  { alias: "lambda", service: "AWS Lambda", family: "serverless", provider: "aws", workloadSignals: ["serverless"] },
  { alias: "nat gateway", service: "AWS NAT Gateway", family: "networking", provider: "aws", workloadSignals: ["networking_heavy"] },
  { alias: "cloudfront", service: "Amazon CloudFront", family: "networking", provider: "aws", workloadSignals: ["networking_heavy"] },
  { alias: "cloudwatch", service: "Amazon CloudWatch", family: "logging", provider: "aws" },
  { alias: "sagemaker", service: "Amazon SageMaker", family: "ai_ml", provider: "aws", workloadSignals: ["ai_ml_gpu"] },
  { alias: "virtual machines", service: "Azure Virtual Machines", family: "compute", provider: "azure", workloadSignals: ["vms"] },
  { alias: "azure vm", service: "Azure Virtual Machines", family: "compute", provider: "azure", workloadSignals: ["vms"] },
  { alias: "azure sql", service: "Azure SQL", family: "database", provider: "azure", workloadSignals: ["databases"] },
  { alias: "cosmos db", service: "Azure Cosmos DB", family: "database", provider: "azure", workloadSignals: ["databases"] },
  { alias: "blob storage", service: "Azure Blob Storage", family: "object_storage", provider: "azure", workloadSignals: ["storage_heavy"] },
  { alias: "aks", service: "Azure Kubernetes Service", family: "kubernetes", provider: "azure", workloadSignals: ["kubernetes"] },
  { alias: "azure functions", service: "Azure Functions", family: "serverless", provider: "azure", workloadSignals: ["serverless"] },
  { alias: "azure firewall", service: "Azure Firewall", family: "networking", provider: "azure", workloadSignals: ["networking_heavy"] },
  { alias: "log analytics", service: "Azure Log Analytics", family: "logging", provider: "azure" },
  { alias: "azure machine learning", service: "Azure Machine Learning", family: "ai_ml", provider: "azure", workloadSignals: ["ai_ml_gpu"] },
  { alias: "compute engine", service: "Google Compute Engine", family: "compute", provider: "gcp", workloadSignals: ["vms"] },
  { alias: "cloud sql", service: "Cloud SQL", family: "database", provider: "gcp", workloadSignals: ["databases"] },
  { alias: "bigquery", service: "BigQuery", family: "analytics", provider: "gcp", workloadSignals: ["data_platform_analytics"] },
  { alias: "cloud storage", service: "Cloud Storage", family: "object_storage", provider: "gcp", workloadSignals: ["storage_heavy"] },
  { alias: "gke", service: "Google Kubernetes Engine", family: "kubernetes", provider: "gcp", workloadSignals: ["kubernetes"] },
  { alias: "cloud run", service: "Cloud Run", family: "serverless", provider: "gcp", workloadSignals: ["serverless"] },
  { alias: "cloud functions", service: "Cloud Functions", family: "serverless", provider: "gcp", workloadSignals: ["serverless"] },
  { alias: "cloud nat", service: "Cloud NAT", family: "networking", provider: "gcp", workloadSignals: ["networking_heavy"] },
  { alias: "vertex ai", service: "Vertex AI", family: "ai_ml", provider: "gcp", workloadSignals: ["ai_ml_gpu"] },
  { alias: "kubernetes", service: "Kubernetes", family: "kubernetes", workloadSignals: ["kubernetes"] },
  { alias: "k8s", service: "Kubernetes", family: "kubernetes", workloadSignals: ["kubernetes"] },
  { alias: "postgres", service: "PostgreSQL", family: "database", workloadSignals: ["databases"] },
  { alias: "mysql", service: "MySQL", family: "database", workloadSignals: ["databases"] },
  { alias: "mongodb", service: "MongoDB", family: "database", workloadSignals: ["databases"] },
  { alias: "redis", service: "Redis", family: "database", workloadSignals: ["databases"] },
  { alias: "snapshot", service: "Snapshots", family: "backups", workloadSignals: ["storage_heavy"] },
  { alias: "backups", service: "Backups", family: "backups", workloadSignals: ["storage_heavy"] },
  { alias: "logs", service: "Logs", family: "logging", workloadSignals: ["storage_heavy"] },
  { alias: "gpu", service: "GPU", family: "ai_ml", workloadSignals: ["ai_ml_gpu"] },
];

export const PROVIDER_TOKENS: Record<CloudProvider, string[]> = {
  aws: ["aws", "amazon web services", "ec2", "rds", "s3", "eks", "lambda", "cloudwatch"],
  azure: ["azure", "aks", "azure sql", "blob storage", "virtual machines", "log analytics"],
  gcp: ["gcp", "google cloud", "compute engine", "cloud sql", "cloud storage", "gke", "bigquery", "cloud run"],
  other: ["digitalocean", "oracle cloud", "ovh", "linode"],
};

export const WORKLOAD_TOKENS: Record<WorkloadSignal, string[]> = {
  web_app_saas: ["saas", "web app", "web application", "customer portal", "multi-tenant"],
  apis_services: ["api", "apis", "microservice", "microservices", "backend services", "services"],
  data_platform_analytics: ["analytics", "warehouse", "data lake", "etl", "elt", "pipelines", "bi", "dashboards", "bigquery", "redshift"],
  kubernetes: ["kubernetes", "k8s", "eks", "aks", "gke", "node pool"],
  vms: ["vm", "vms", "virtual machine", "virtual machines", "instance", "instances", "ec2", "compute engine"],
  serverless: ["serverless", "lambda", "cloud run", "functions", "scale to zero", "fargate"],
  databases: ["database", "databases", "postgres", "mysql", "sql", "rds", "aurora", "replica", "iops"],
  ai_ml_gpu: ["gpu", "machine learning", "ml", "training", "inference", "llm", "sagemaker", "vertex ai", "azure machine learning"],
  storage_heavy: ["storage", "s3", "blob", "archive", "retention", "snapshot", "backup", "log retention", "object storage"],
  networking_heavy: ["egress", "data transfer", "bandwidth", "cross-region", "cross region", "nat gateway", "firewall", "load balancer"],
};

export const COST_PAIN_TOKENS: Record<CostPainSignal, string[]> = {
  rapid_growth: ["keeps rising", "rising", "doubled", "growth", "ballooned", "spiking", "increasing fast"],
  unknown_spend_drivers: ["do not know", "don't know", "unknown", "not sure", "unclear", "hard to tell", "no idea"],
  idle_non_prod_waste: ["dev", "test", "staging", "non-prod", "non prod", "qa", "sandbox", "left running", "24/7"],
  oversized_compute: ["oversized", "overprovisioned", "rightsize", "rightsizing", "low utilization", "peaks", "over provisioned"],
  storage_sprawl: ["storage grows", "snapshot", "backup", "retention", "old data", "logs grow", "archive", "blob", "s3"],
  egress_network_costs: ["egress", "data transfer", "nat gateway", "firewall", "cross-region", "cross region", "bandwidth"],
  database_cost_inflation: ["database cost", "rds is high", "sql is high", "replica", "iops", "db cost", "database spend"],
  kubernetes_inefficiency: ["kubernetes", "k8s", "cluster cost", "node pool", "idle nodes", "requests and limits"],
  gpu_waste: ["gpu", "training", "inference", "sagemaker", "vertex ai", "model hosting"],
  duplicate_environments: ["duplicate environments", "too many environments", "copied stacks", "mirrored environments", "per-customer environment"],
  overengineered_ha_dr: ["multi-region active-active", "active active", "dr", "disaster recovery", "high availability", "zero downtime", "redundancy"],
  lack_resource_ownership_tagging: ["no tags", "missing tags", "unclear owner", "nobody owns", "shared cost", "labels are weak", "ownership is weak"],
  poor_budgeting_alerting: ["no budgets", "no alerts", "surprised by bill", "budget blind", "no spend alerts"],
  vendor_commitment_gaps: ["no savings plan", "no reservations", "on demand only", "committed use", "cud", "reserved instance", "reservation"],
};

export const COMPLEXITY_TOKENS: Record<ComplexitySignal, string[]> = {
  production_critical: ["production", "prod", "mission critical"],
  regulated_or_sensitive: ["hipaa", "pci", "soc 2", "soc2", "pii", "regulated", "compliance", "sensitive"],
  customer_facing: ["customer-facing", "customer facing", "customers", "sla", "latency"],
  high_availability_constraints: ["high availability", "zero downtime", "24/7", "active-active", "multi-az"],
  multi_region: ["multi-region", "multi region", "global", "cross-region"],
  high_data_transfer: ["egress", "bandwidth", "replication", "streaming", "data transfer"],
  many_teams_or_unclear_owners: ["many teams", "multiple teams", "shared ownership", "unclear owners", "squads"],
  multi_cloud: ["multi-cloud", "multi cloud"],
};

export const MATURITY_SIGNAL_TOKENS: Record<
  string,
  {
    present: string[];
    missing: string[];
  }
> = {
  budgets: {
    present: ["budget", "budgets", "budget alerts", "cost alerts", "forecast"],
    missing: ["no budgets", "no alerts", "without alerts", "budget blind"],
  },
  tagging: {
    present: ["tagging", "tags", "labels", "cost center"],
    missing: ["no tags", "missing tags", "weak tagging", "weak labels"],
  },
  ownership: {
    present: ["owner", "owners", "owned", "resource ownership", "chargeback", "showback"],
    missing: ["unclear owner", "nobody owns", "no owner", "unclear ownership"],
  },
  autoscaling: {
    present: ["autoscaling", "auto scaling", "hpa", "scale to zero"],
    missing: ["fixed capacity", "always on", "rare peaks", "overprovisioned for peaks"],
  },
  scheduledShutdowns: {
    present: ["shutdown schedule", "turn off dev", "sleep schedule", "hibernate"],
    missing: ["runs 24/7", "left running", "always on non-prod"],
  },
  costReviews: {
    present: ["cost review", "finops", "monthly review", "weekly review"],
    missing: ["never review costs", "no cost review"],
  },
  commitments: {
    present: ["savings plan", "reserved instance", "reservation", "committed use", "cud"],
    missing: ["no savings plan", "no reservations", "on demand only"],
  },
  environmentSeparation: {
    present: ["dev test prod", "separate environments", "separate accounts", "staging"],
    missing: ["prod and dev mixed", "shared prod and dev"],
  },
  cleanupProcess: {
    present: ["cleanup", "lifecycle", "retention policy", "janitor", "ttl"],
    missing: ["orphaned", "old snapshots", "unattached", "never cleaned"],
  },
};

export const MATURITY_SIGNAL_KEYS = [
  "budgets",
  "tagging",
  "ownership",
  "autoscaling",
  "scheduledShutdowns",
  "costReviews",
  "commitments",
  "environmentSeparation",
  "cleanupProcess",
] as const satisfies readonly string[];

export type MaturitySignalKey = (typeof MATURITY_SIGNAL_KEYS)[number];

export type MaturitySignals = Record<MaturitySignalKey, MaturityState>;
