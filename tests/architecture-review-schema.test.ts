import { describe, expect, it } from "vitest";

import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";
import { architectureReviewReportSchema, submitArchitectureReviewMetadataSchema } from "@/lib/architecture-review/types";

describe("architecture review schema", () => {
  it("accepts a valid finalized report", () => {
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Client request enters API Gateway, invokes Lambda, then writes to DynamoDB.",
      findings: [
        {
          ruleId: "PILLAR-SECURITY",
          category: "security",
          pointsDeducted: 12,
          message: "Document security controls for identity, secrets, and encryption.",
          fix: "Add IAM, KMS, and secrets handling details to the flow narrative.",
          evidence: "No explicit security controls were present in the paragraph.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-05T12:00:00.000Z",
    });

    const parsed = architectureReviewReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
    expect(report.reportVersion).toBe("1.0");
    expect(report.analysisConfidence).toBe("high");
    expect(report.quoteTier).toBe("advisory-review");
    expect(report.findings[0].fixCostUSD).toBeGreaterThan(0);
  });

  it("rejects overlong finding messages", () => {
    const parsed = architectureReviewReportSchema.safeParse({
      reportVersion: "1.0",
      provider: "gcp",
      overallScore: 80,
      analysisConfidence: "medium",
      quoteTier: "remediation-sprint",
      flowNarrative: "A concise narrative.",
      findings: [
        {
          ruleId: "RULE-1",
          category: "clarity",
          pointsDeducted: 5,
          message: "x".repeat(121),
          fix: "Fix message length.",
          evidence: "Evidence",
          fixCostUSD: 25,
        },
      ],
      consultationQuoteUSD: 300,
      generatedAtISO: "2026-03-05T12:00:00.000Z",
      userEmail: "architect@zokorp.com",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts submission metadata with attribution and client timing", () => {
    const parsed = submitArchitectureReviewMetadataSchema.safeParse({
      provider: "aws",
      paragraphInput:
        "Users call an edge endpoint, traffic routes to app services, and data persists to managed storage.",
      diagramFormat: "png",
      archiveForFollowup: false,
      title: "Production architecture",
      owner: "Platform Team",
      lastUpdated: "2026-03-07",
      version: "v1.0",
      submissionContext: {
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "aws-benchmark",
        landingPage: "/software/architecture-diagram-reviewer",
        referrer: "https://example.com",
        deviceClass: "desktop",
      },
      clientTiming: {
        startedAtISO: "2026-03-07T12:00:00.000Z",
        submittedAtISO: "2026-03-07T12:00:05.000Z",
        precheckMs: 1100,
        totalClientMs: 4900,
      },
      clientPngOcrText: "api gateway lambda dynamodb cloudwatch",
      clientSvgText: "edge ingress api service database",
      clientSvgDimensions: {
        width: 1280,
        height: 720,
      },
    });

    expect(parsed.success).toBe(true);
  });
});
