import { describe, expect, it } from "vitest";

import {
  buildArchitectureObservation,
  formatObservationLines,
} from "@/lib/architecture-review/observation";

describe("architecture review observation echo", () => {
  it("echoes a tiered observation of recognized AWS services from the narrative", () => {
    const observation = buildArchitectureObservation({
      flowNarrative:
        "Users enter through CloudFront and an ALB, app services run in private subnets, data persists to RDS with SQS workers consuming events. KMS handles secrets.",
      provider: "aws",
    });

    const tiersByName = Object.fromEntries(
      observation.tiersInOrder.map((tier) => [tier.tier, tier.services]),
    );

    expect(tiersByName.edge).toContain("CloudFront");
    expect(tiersByName.edge).toContain("Application Load Balancer (ALB)");
    expect(tiersByName.data).toContain("RDS");
    expect(tiersByName.messaging).toContain("SQS");
    expect(tiersByName.networking).toContain("private subnets");
    expect(tiersByName.security).toContain("KMS");
  });

  it("ignores non-matching narratives and returns no tiers", () => {
    const observation = buildArchitectureObservation({
      flowNarrative: "This describes a system but does not name any specific cloud service.",
      provider: "aws",
    });

    expect(observation.tiersInOrder).toEqual([]);
    expect(observation.observationCount).toBe(0);
  });

  it("picks up Azure-specific terms when provider is azure", () => {
    const observation = buildArchitectureObservation({
      flowNarrative:
        "Requests come through Front Door and Application Gateway into Azure Functions, persisting to Cosmos DB. Service Bus handles async work. Application Insights captures telemetry. Key Vault holds secrets.",
      provider: "azure",
    });

    const tiersByName = Object.fromEntries(
      observation.tiersInOrder.map((tier) => [tier.tier, tier.services]),
    );

    expect(tiersByName.edge).toContain("Azure Front Door");
    expect(tiersByName.edge).toContain("Application Gateway");
    expect(tiersByName.compute).toContain("Azure Functions");
    expect(tiersByName.data).toContain("Cosmos DB");
    expect(tiersByName.messaging).toContain("Service Bus");
    expect(tiersByName.observability).toContain("Application Insights");
    expect(tiersByName.security).toContain("Key Vault");
  });

  it("picks up GCP-specific terms when provider is gcp", () => {
    const observation = buildArchitectureObservation({
      flowNarrative:
        "Cloud Load Balancing terminates traffic, Cloud Run handles compute, Spanner is the data store, Pub/Sub handles async events, Cloud Logging captures everything.",
      provider: "gcp",
    });

    const tiersByName = Object.fromEntries(
      observation.tiersInOrder.map((tier) => [tier.tier, tier.services]),
    );

    expect(tiersByName.edge).toContain("Cloud Load Balancing");
    expect(tiersByName.compute).toContain("Cloud Run");
    expect(tiersByName.data).toContain("Spanner");
    expect(tiersByName.messaging).toContain("Pub/Sub");
    expect(tiersByName.observability).toContain("Cloud Logging");
  });

  it("picks up Snowflake terms when the snowflake platform is included", () => {
    const observation = buildArchitectureObservation({
      flowNarrative:
        "Snowflake warehouse processes ELT jobs against multiple databases and schemas.",
      provider: "multi",
      platforms: ["snowflake"],
    });

    const tiersByName = Object.fromEntries(
      observation.tiersInOrder.map((tier) => [tier.tier, tier.services]),
    );

    expect(tiersByName.data).toContain("Snowflake warehouse");
    expect(tiersByName.data).toContain("database");
    expect(tiersByName.data).toContain("schema");
  });

  it("merges cross-cloud terms when provider is multi", () => {
    const observation = buildArchitectureObservation({
      flowNarrative:
        "Customer hybrid setup: CloudFront in AWS terminates external traffic, but workloads run in Azure Container Apps with data in Cosmos DB. GCS holds backups in GCP.",
      provider: "multi",
    });

    const tiersByName = Object.fromEntries(
      observation.tiersInOrder.map((tier) => [tier.tier, tier.services]),
    );

    expect(tiersByName.edge).toContain("CloudFront");
    expect(tiersByName.compute).toContain("Container Apps");
    expect(tiersByName.data).toContain("Cosmos DB");
    expect(tiersByName.data).toContain("Cloud Storage");
  });

  it("formats observation lines as 'Tier: a, b, c' strings", () => {
    const observation = buildArchitectureObservation({
      flowNarrative: "CloudFront and an ALB route to EC2.",
      provider: "aws",
    });

    const lines = formatObservationLines(observation);
    expect(lines.some((line) => line.startsWith("Edge / ingress: "))).toBe(true);
    expect(lines.some((line) => line.startsWith("Compute: "))).toBe(true);
  });

  it("also picks up keywords from optional OCR text when provided", () => {
    const observation = buildArchitectureObservation({
      flowNarrative: "Customer facing application.",
      provider: "aws",
      ocrText: "Diagram labels: CloudFront, ALB, RDS, EC2 Auto Scaling",
    });

    const tiersByName = Object.fromEntries(
      observation.tiersInOrder.map((tier) => [tier.tier, tier.services]),
    );

    expect(tiersByName.edge).toContain("CloudFront");
    expect(tiersByName.data).toContain("RDS");
    expect(tiersByName.compute).toContain("EC2");
    expect(tiersByName.compute).toContain("Auto Scaling");
  });
});
