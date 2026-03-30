import { describe, expect, it } from "vitest";

import { buildValidationReport, formatValidationReport } from "@/lib/zokorp-validator-engine";

describe("zokorp validator engine", () => {
  it("routes thin FTR submissions into the new consultation-first launch-v1 checks", () => {
    const rawText = `
      Scope and objective for the release are defined with in-scope and out-of-scope systems.
      The architecture diagram and integration workflow are included for component mapping.
      Security controls cover IAM least privilege, encryption at rest, and audit logging.
      Test plan and QA validation results are attached with acceptance criteria.
      Risk mitigation register tracks blocker dependencies and issue owners.
      Final sign-off approved by technical owner and reviewer.
    `;

    const report = buildValidationReport({
      profile: "FTR",
      rawText,
      context: {
        sourceType: "pdf",
        filename: "sample-ftr.pdf",
        pages: 3,
      },
    });

    expect(report.profile).toBe("FTR");
    expect(report.score).toBeLessThan(60);
    expect(report.summary).toContain("Not FTR-ready");
    expect(report.checks.some((check) => check.id === "component_type_classified" && check.status === "MISSING")).toBe(true);
    expect(
      report.checks.some((check) => check.id === "required_artifacts_present_for_path" && check.status === "MISSING"),
    ).toBe(true);
    expect(report.documentMetrics.wordCount).toBeGreaterThan(20);
  });

  it("scores a strong customer-deployed FTR package with the PDF-backed rulepack", () => {
    const rawText = `
      Customer-Deployed software offering. We use the February 2026 FTR checklist and completed self-assessment
      with link, page 4, section INT-001, paragraph 2 pointers for required responses. The deployment guide includes
      use cases, a deployment overview, and a list of AWS resources created: Amazon VPC, public and private subnets,
      Application Load Balancer, EC2 instances, Amazon RDS, Amazon S3, IAM roles, and CloudWatch alarms.
      The architecture diagram uses AWS Architecture Icons and shows integrations, request flow, and data flow between
      the ALB, EC2 application tier, RDS, and S3. The guide warns operators not to use the root account and provides
      least-privilege IAM guidance with scoped roles and conditions. Evidence references are provided in the deployment
      guide appendix and section links.
    `;

    const report = buildValidationReport({
      profile: "FTR",
      rawText,
      target: {
        id: "ftr:software-offering",
        label: "Software Offering FTR",
        track: "ftr",
        serviceCategory: "software",
      },
      context: {
        sourceType: "pdf",
        filename: "customer-deployed-ftr-2026.pdf",
        pages: 4,
      },
    });

    expect(report.score).toBeGreaterThanOrEqual(85);
    expect(report.summary).toContain("Partially FTR-ready");
    expect(report.counts.MISSING).toBe(0);
    expect(report.checks.some((check) => check.id === "cd_intro_deployment_overview_and_resources" && check.status === "PASS")).toBe(true);
    expect(report.checks.some((check) => check.id === "cd_security_no_root_and_least_privilege_guidance")).toBe(true);
  });

  it("identifies major gaps for weak competency evidence", () => {
    const report = buildValidationReport({
      profile: "COMPETENCY",
      rawText: "Quick notes with minimal technical detail and no explicit references.",
      context: {
        sourceType: "spreadsheet",
        filename: "weak-input.xlsx",
        sheets: 1,
      },
    });

    expect(report.score).toBeLessThan(40);
    expect(report.counts.MISSING).toBeGreaterThanOrEqual(3);
    expect(report.topGaps.length).toBeGreaterThan(0);
  });

  it("formats a readable report string", () => {
    const report = buildValidationReport({
      profile: "SDP",
      rawText: "Service process includes support escalation and monitoring runbook.",
      context: {
        sourceType: "pdf",
        filename: "sdp.pdf",
        pages: 1,
      },
    });

    const formatted = formatValidationReport(report);
    expect(formatted).toContain("ZoKorpValidator Report (Service Delivery Program (SDP))");
    expect(formatted).toContain("Checklist results:");
  });

  it("keeps selected target metadata on FTR launch-v1 reports", () => {
    const report = buildValidationReport({
      profile: "FTR",
      rawText:
        "Customer-Deployed software offering with a 2026 checklist, deployment guide, and architecture diagram covering Amazon VPC, subnets, ALB, EC2, and RDS.",
      target: {
        id: "ftr:software-offering",
        label: "Software Offering FTR",
        track: "ftr",
        serviceCategory: "software",
        checklistUrl: "https://example.com/checklist",
        keywords: ["software", "customer-deployed"],
      },
      context: {
        sourceType: "pdf",
        filename: "lambda-ftr.pdf",
        pages: 1,
      },
    });

    expect(report.target?.label).toBe("Software Offering FTR");
    expect(report.rulepack.id).toContain("ftr::launch-v1");
    expect(report.checks.some((check) => check.id === "component_type_classified")).toBe(true);
  });
});
