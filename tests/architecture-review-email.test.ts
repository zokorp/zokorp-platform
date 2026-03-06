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
    expect(content.text).toContain("Engagement options (deterministic):");
    expect(content.text).toContain("Quote basis:");
    expect(content.html).toContain("Recommended Engagement Options");
    expect(content.html).toContain("Rapid Remediation Sprint");
    expect(content.html).toContain("Architecture Partner Track");
    expect(content.html).toContain("Actionable Findings");
  });
});
