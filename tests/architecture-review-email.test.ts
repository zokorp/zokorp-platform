import { describe, expect, it } from "vitest";

import { buildArchitectureReviewEmailContent } from "@/lib/architecture-review/email";
import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";

describe("architecture review email content", () => {
  it("renders the implementation estimate and booking link without package menus", () => {
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

    const content = buildArchitectureReviewEmailContent(report, {
      ctaLinks: {
        bookArchitectureCallUrl: "https://book.zokorp.com/architecture",
      },
    });

    expect(content.subject).toContain("estimate");
    expect(content.text).toContain("Implementation estimate:");
    expect(content.text).toContain("Estimated total (based on submitted materials):");
    expect(content.text).toContain("Book implementation follow-up: https://book.zokorp.com/architecture");
    expect(content.text).not.toContain("Engagement options:");
    expect(content.html).toContain("Implementation Estimate");
    expect(content.html).toContain("Book implementation follow-up");
    expect(content.html).toContain("Estimate Reference");
    expect(content.html).toContain("Assumptions and Exclusions");
    expect(content.html).not.toContain("Engagement Options");
    expect(content.html).not.toContain("Request scoped engagement");
  });

  it("keeps low-confidence reviews estimate-first while still showing the estimate block", () => {
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
    expect(content.text).toContain("Because the evidence confidence was low");
    expect(content.text).toContain("Implementation estimate:");
    expect(content.html).toContain("The estimate below is limited to the issues visible in the submitted material.");
  });

  it("lists each quoted rule line in the customer email", () => {
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

    expect(content.text).toContain("SEC-BASELINE-MISSING");
    expect(content.text).toContain("Compliance baseline mapping");
    expect(content.html).toContain("SEC-BASELINE-MISSING");
    expect(content.html).toContain("Compliance baseline mapping");
  });
});
