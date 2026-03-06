import { describe, expect, it } from "vitest";

import {
  buildDeterministicNarrative,
  buildDeterministicReviewFindings,
  extractServiceTokens,
} from "@/lib/architecture-review/engine";

describe("architecture deterministic engine", () => {
  it("extracts provider-relevant service tokens from OCR text", () => {
    const tokens = extractServiceTokens(
      "aws",
      "API Gateway routes requests to Lambda and stores output in DynamoDB. CloudWatch monitors latency.",
    );

    expect(tokens).toContain("api gateway");
    expect(tokens).toContain("lambda");
    expect(tokens).toContain("dynamodb");
    expect(tokens).toContain("cloudwatch");
  });

  it("adds deductions when metadata and core pillars are missing", () => {
    const findings = buildDeterministicReviewFindings({
      provider: "azure",
      paragraph: "Traffic enters app service then writes to SQL.",
      ocrText: "app service sql database", // intentionally sparse controls
      serviceTokens: ["app service", "sql database", "azure monitor", "key vault"],
      metadata: {
        title: "",
        owner: "",
        lastUpdated: "",
        version: "",
        legend: "",
      },
    });

    expect(findings.some((finding) => finding.ruleId === "MSFT-META-TITLE")).toBe(true);
    expect(findings.some((finding) => finding.ruleId === "PILLAR-SECURITY")).toBe(true);
    expect(findings.some((finding) => finding.ruleId === "PILLAR-RELIABILITY")).toBe(true);
  });

  it("flags non-architecture screenshots and lowers narrative confidence", () => {
    const findings = buildDeterministicReviewFindings({
      provider: "aws",
      paragraph:
        "Clients call HTTPS through a load balancer. The service tier orchestrates downstream calls and stores state.",
      ocrText:
        "Expanded Tradeline List Total Unsecured Debt $42,200 Balance Utilization Account number JPMCB CARD",
      serviceTokens: [],
      metadata: {
        title: "Payments API",
        owner: "Platform Team",
        lastUpdated: "2026-03-06",
        version: "v1.0",
        legend: "",
      },
    });

    expect(findings.some((finding) => finding.ruleId === "INPUT-NOT-ARCH-DIAGRAM")).toBe(true);

    const narrative = buildDeterministicNarrative({
      provider: "aws",
      paragraph:
        "Clients call HTTPS through a load balancer. The service tier orchestrates downstream calls and stores state.",
      ocrText:
        "Expanded Tradeline List Total Unsecured Debt $42,200 Balance Utilization Account number JPMCB CARD",
      serviceTokens: [],
      metadata: {
        title: "Payments API",
        owner: "Platform Team",
        lastUpdated: "2026-03-06",
        version: "v1.0",
        legend: "",
      },
    });

    expect(narrative.toLowerCase()).toContain("non-architecture content");
  });
});
