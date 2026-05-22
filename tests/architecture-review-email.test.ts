import { describe, expect, it } from "vitest";

import { buildArchitectureReviewEmailContent } from "@/lib/architecture-review/email";
import { getArchitectureReviewPricingCatalogEntry } from "@/lib/architecture-review/pricing-catalog";
import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";

describe("architecture review email content", () => {
  it("falls back to the working architecture follow-up booking URL when no booking URL is configured", () => {
    const previousBookingUrl = process.env.ARCH_REVIEW_BOOK_CALL_URL;
    delete process.env.ARCH_REVIEW_BOOK_CALL_URL;

    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Traffic enters through edge and application tiers before reaching private services and storage.",
      findings: [
        {
          ruleId: "internet_facing_endpoint_without_tls",
          category: "security",
          pointsDeducted: 5,
          message: "Public traffic is present without explicit TLS enforcement.",
          fix: "Terminate TLS with ACM at the public entry point and enforce HTTPS-only.",
          evidence: "The diagram shows internet-facing traffic but does not make HTTPS/TLS termination explicit.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-10T00:00:00.000Z",
    });

    const content = buildArchitectureReviewEmailContent(report);

    expect(content.text).toContain("https://calendly.com/zokorp/zokorp-discovery-call");
    expect(content.text).toContain("utm_medium=architecture-review-email");
    expect(content.html).toContain("https://calendly.com/zokorp/zokorp-discovery-call");
    expect(content.html).toContain("utm_medium=architecture-review-email");

    if (previousBookingUrl) {
      process.env.ARCH_REVIEW_BOOK_CALL_URL = previousBookingUrl;
    }
  });

  it("renders the implementation estimate and booking link without package menus", () => {
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Client requests enter through CloudFront and ALB before reaching private services and a managed database.",
      findings: [
        {
          ruleId: "internet_facing_endpoint_without_tls",
          category: "security",
          pointsDeducted: 5,
          message: "Public traffic is present without explicit TLS enforcement.",
          fix: "Terminate TLS with ACM at the public entry point and enforce HTTPS-only.",
          evidence: "The diagram shows internet-facing traffic but does not make HTTPS/TLS termination explicit.",
        },
        {
          ruleId: "centralized_application_logging",
          category: "operations",
          pointsDeducted: 6,
          message: "Application logs are not centralized.",
          fix: "Ship service logs to CloudWatch Logs with baseline retention and access controls.",
          evidence: "The submission does not show a centralized logging path for production services.",
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
        "Users enter through a public path and reach application services, but the written explanation stays light on requirements and operational detail.",
      findings: [
        {
          ruleId: "workload_objective_and_constraints_stated",
          category: "clarity",
          pointsDeducted: 1,
          message: "The workload objective is stated, but measurable constraints are thin.",
          fix: "Add objective, users, load, uptime, and recovery constraints.",
          evidence: "The narrative describes the workload but leaves key constraints implicit.",
        },
        {
          ruleId: "region_and_environment_boundaries_identified",
          category: "operations",
          pointsDeducted: 2,
          message: "Region and environment boundaries are only partially explicit.",
          fix: "Label the AWS Region and separate production from non-production boundaries.",
          evidence: "The submission references the workload but not a full Region/environment boundary.",
        },
        {
          ruleId: "waf_on_public_endpoints",
          category: "security",
          pointsDeducted: 3,
          message: "The public entry point exists, but WAF coverage is not explicit.",
          fix: "Attach AWS WAF to the public path with managed rules and rate limits.",
          evidence: "The diagram shows internet-facing traffic without naming WAF controls.",
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
    const ruleEntry = getArchitectureReviewPricingCatalogEntry("data_classification_and_compliance_noted");
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative:
        "Traffic enters through CloudFront and ALB, services run in private subnets, and stateful systems support the production workload.",
      findings: [
        {
          ruleId: "data_classification_and_compliance_noted",
          category: "security",
          pointsDeducted: 3,
          message: "Sensitive data is implied, but classification and compliance scope are not explicit.",
          fix: "Add a short data inventory with sensitivity and compliance scope.",
          evidence: "The submission mentions customer data without clearly classifying it.",
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

    expect(content.text).toContain("data_classification_and_compliance_noted");
    expect(content.text).toContain(ruleEntry!.serviceLine);
    expect(content.html).toContain("data_classification_and_compliance_noted");
    expect(content.html).toContain(ruleEntry!.serviceLine);
  });

  it("renders official source links for quoted architecture findings", () => {
    const ruleEntry = getArchitectureReviewPricingCatalogEntry("cloudtrail_multi_region_enabled");
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Requests traverse edge, application, and data tiers but audit coverage is still thin.",
      findings: [
        {
          ruleId: "cloudtrail_multi_region_enabled",
          category: "operations",
          pointsDeducted: 4,
          message: "CloudTrail coverage is not explicit for the AWS account in scope.",
          fix: "Enable a multi-Region CloudTrail trail with protected log delivery.",
          evidence: "The architecture does not show CloudTrail or log-archive coverage.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-09T02:30:00.000Z",
    });

    const content = buildArchitectureReviewEmailContent(report);
    const sourceLabel = ruleEntry!.officialSourceLinks[0]!.label;

    expect(content.text).toContain(sourceLabel);
    expect(content.html).toContain(sourceLabel);
  });

  it("shows the pay-now CTA only when the estimate is payable", () => {
    const payableReport = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Public traffic reaches edge and app tiers before writing to managed storage.",
      findings: [
        {
          ruleId: "internet_facing_endpoint_without_tls",
          category: "security",
          pointsDeducted: 5,
          message: "Public traffic is present without explicit TLS enforcement.",
          fix: "Terminate TLS with ACM at the public entry point and enforce HTTPS-only.",
          evidence: "The architecture shows internet-facing traffic without explicit TLS enforcement.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-09T03:00:00.000Z",
    });

    const payableContent = buildArchitectureReviewEmailContent(payableReport, {
      ctaLinks: {
        bookArchitectureCallUrl: "https://book.zokorp.com/architecture",
        payNowUrl: "https://app.zokorp.com/api/architecture-review/checkout?jobId=abc&estimateReferenceCode=est_123",
      },
    });

    expect(payableContent.text).toContain("Pay now:");
    expect(payableContent.html).toContain("Pay now");

    const consultationBaseReport = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Public HTTP traffic reaches a single production instance and the database is publicly exposed.",
      findings: [
        {
          ruleId: "internet_facing_endpoint_without_tls",
          category: "security",
          pointsDeducted: 12,
          message: "Public traffic is present without explicit TLS enforcement.",
          fix: "Terminate TLS with ACM at the public entry point and enforce HTTPS-only.",
          evidence: "The architecture shows internet-facing traffic without explicit TLS enforcement.",
        },
        {
          ruleId: "public_database_exposure",
          category: "security",
          pointsDeducted: 12,
          message: "A production database is publicly exposed.",
          fix: "Move the database behind private networking and restrict access paths.",
          evidence: "The architecture shows a publicly reachable database path.",
        },
        {
          ruleId: "single_instance_production_compute",
          category: "reliability",
          pointsDeducted: 10,
          message: "Production compute is single-instance only.",
          fix: "Add redundant compute capacity and define failover behavior.",
          evidence: "The architecture shows one production instance only.",
        },
        {
          ruleId: "cloudtrail_multi_region_enabled",
          category: "operations",
          pointsDeducted: 8,
          message: "Audit logging is not explicit.",
          fix: "Enable multi-Region CloudTrail with protected delivery.",
          evidence: "The architecture does not show CloudTrail or protected audit delivery.",
        },
        {
          ruleId: "centralized_application_logging",
          category: "operations",
          pointsDeducted: 8,
          message: "Application logging is missing.",
          fix: "Centralize application logs and define retention.",
          evidence: "The architecture does not show centralized application logging.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-09T03:10:00.000Z",
    });
    const consultationReport = {
      ...consultationBaseReport,
      overallScore: 55,
      quoteTier: "advisory-review" as const,
    };
    expect(consultationReport.overallScore).toBeLessThan(60);

    const consultationContent = buildArchitectureReviewEmailContent(consultationReport, {
      ctaLinks: {
        bookArchitectureCallUrl: "https://book.zokorp.com/architecture",
        payNowUrl: "https://app.zokorp.com/api/architecture-review/checkout?jobId=def&estimateReferenceCode=est_456",
      },
    });

    expect(consultationContent.text).not.toContain("Pay now:");
    expect(consultationContent.html).not.toContain(">Pay now<");
  });
});
