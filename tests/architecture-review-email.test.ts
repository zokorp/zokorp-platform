import { describe, expect, it } from "vitest";

import { buildArchitectureReviewEmailContent } from "@/lib/architecture-review/email";
import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";

describe("architecture review email content", () => {
  it("includes polished html sections and deterministic engagement options", () => {
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Client requests enter ALB, app tier calls services, and writes to a managed database.",
      findings: [
        {
          ruleId: "PILLAR-SECURITY",
          category: "security",
          pointsDeducted: 12,
          message: "Document security controls for identity, secrets, and encryption.",
          fix: "Name IAM/auth controls, encryption boundaries, and secret-management steps.",
          evidence: "No explicit security controls were present in the paragraph.",
        },
        {
          ruleId: "PILLAR-OPERATIONS",
          category: "operations",
          pointsDeducted: 8,
          message: "Define monitoring and operational ownership.",
          fix: "Add metrics, alerts, logs, and runbook ownership for this flow.",
          evidence: "No operations controls were identified in the paragraph.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-06T00:00:00.000Z",
    });

    const content = buildArchitectureReviewEmailContent(report);

    expect(content.subject).toContain("score");
    expect(content.text).toContain("Engagement options:");
    expect(content.text).toContain("Quote basis:");
    expect(content.text).toContain("serviceLine=Security control mapping");
    expect(content.html).toContain("Engagement Options");
    expect(content.html).toContain("Advisory Review");
    expect(content.html).toContain("Implementation Partner");
    expect(content.html).toContain("Service line: Security control mapping");
    expect(content.html).toContain("Top Deductions");
  });

  it("keeps low-confidence reviews diagnostic-first in the customer email", () => {
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative:
        "Users enter through an API layer and the diagram references app services without fully explaining how requests move across the system.",
      findings: [
        {
          ruleId: "MSFT-COMPONENT-LABEL-COVERAGE",
          category: "clarity",
          pointsDeducted: 6,
          message: "Explain the role of each major component.",
          fix: "State what each service does and how the request flows through it.",
          evidence: "Several services are named but not fully explained.",
        },
        {
          ruleId: "CLAR-BOUNDARY-EXPLICIT",
          category: "clarity",
          pointsDeducted: 4,
          message: "Make the trust boundaries explicit.",
          fix: "Label the external, application, and data trust boundaries directly on the diagram.",
          evidence: "The diagram does not clearly show where the trust boundary changes.",
        },
        {
          ruleId: "PILLAR-SECURITY",
          category: "security",
          pointsDeducted: 12,
          message: "Document security controls for identity, secrets, and encryption.",
          fix: "Name IAM boundaries, secret storage, and encryption points.",
          evidence: "Security controls are not explicit in the current narrative.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-09T02:00:00.000Z",
      quoteContext: {
        tokenCount: 18,
        ocrCharacterCount: 220,
        mode: "rules-only",
        workloadCriticality: "standard",
        desiredEngagement: "hands-on-remediation",
      },
    });

    const content = buildArchitectureReviewEmailContent(report);

    expect(report.analysisConfidence).toBe("low");
    expect(report.consultationQuoteUSD).toBe(249);
    expect(content.text).toContain("This review stays diagnostic-first");
    expect(content.text).toContain("Request scoped follow-up");
    expect(content.html).toContain("This review stays diagnostic-first");
    expect(content.html).toContain("Request scoped follow-up");
    expect(content.html).toContain("Held until the advisory review confirms the findings");
  });

  it("marks broader scopes as custom after the advisory call", () => {
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative:
        "Traffic enters through CloudFront and ALB, services run in private subnets, and stateful systems support the production workload.",
      findings: [
        {
          ruleId: "SEC-BASELINE-MISSING",
          category: "security",
          pointsDeducted: 8,
          message: "Map the architecture to the required control baseline.",
          fix: "Document the control family placement and ownership model.",
          evidence: "Regulated scope is present without explicit control mapping.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-09T02:30:00.000Z",
      quoteContext: {
        tokenCount: 26,
        ocrCharacterCount: 880,
        mode: "rules-only",
        workloadCriticality: "standard",
        desiredEngagement: "hands-on-remediation",
        regulatoryScope: "soc2",
      },
    });

    const content = buildArchitectureReviewEmailContent(report);

    expect(report.quoteTier).toBe("implementation-partner");
    expect(report.consultationQuoteUSD).toBe(249);
    expect(content.text).toContain("This review points to broader delivery work");
    expect(content.text).toContain("Request scoped engagement");
    expect(content.html).toContain("This moves to custom scope");
    expect(content.html).toContain("Request scoped engagement");
    expect(content.html).toContain("Custom scoped redesign and execution support after the advisory call");
  });
});
