import { describe, expect, it } from "vitest";

import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";
import { buildFallbackArchitectureEstimateSnapshot } from "@/lib/architecture-review/estimate-snapshot";

const CONSULTATION_BAND_FLOOR_USD = 650;
const CONSULTATION_BAND_CEILING_USD = 2_800;

// A realistic 60-89-score AWS submission with several high-hour `remediation-estimate` rules:
//   infrastructure_as_code_indicated      8-60h
//   single_instance_production_compute    6-40h
//   no_backup_strategy_for_stateful_data  4-40h
// Before the fix these summed to a four/five-figure unclamped auto-quote (ARCH-Q01 magnitude check).
function buildHighHourReport(overrides?: {
  analysisConfidenceOverride?: "low" | "medium" | "high";
}) {
  return buildArchitectureReviewReport({
    provider: "aws",
    flowNarrative:
      "Users reach an edge layer, application services process requests, and several stateful stores persist data.",
    findings: [
      {
        ruleId: "infrastructure_as_code_indicated",
        category: "operations",
        pointsDeducted: 5,
        message: "Production infrastructure is managed manually rather than as code.",
        fix: "Adopt Infrastructure as Code for networking, IAM, and core services; integrate with CI/CD.",
        evidence: "The submission does not show any IaC tooling for the production footprint.",
      },
      {
        ruleId: "single_instance_production_compute",
        category: "reliability",
        pointsDeducted: 6,
        message: "Production compute is a single point of failure.",
        fix: "Add redundancy and load balancing; adopt Auto Scaling.",
        evidence: "Only one serving instance is shown for production compute.",
      },
      {
        ruleId: "no_backup_strategy_for_stateful_data",
        category: "reliability",
        pointsDeducted: 5,
        message: "No backup strategy is described for stateful stores.",
        fix: "Define and validate automated backups for every stateful store.",
        evidence: "The diagram shows stateful stores without any backup/restore path.",
      },
    ],
    userEmail: "architect@acmecloud.com",
    generatedAtISO: "2026-03-24T00:00:00.000Z",
    analysisConfidenceOverride: overrides?.analysisConfidenceOverride,
  });
}

describe("architecture estimate clamp + confidence guardrail (ARCH-Q01/Q02/Q03)", () => {
  it("magnitude check: a high-hour 60-89 cluster is bounded to the documented ceiling", () => {
    const report = buildHighHourReport();

    // Land in a payable band (the bug requires 60-89 / >=90, not consultation-first <60).
    expect(report.overallScore).toBeGreaterThanOrEqual(60);

    const { snapshot } = buildFallbackArchitectureEstimateSnapshot(report);

    // ARCH-Q01: before the fix this was a four/five-figure sum; now it is clamped to the ceiling.
    expect(snapshot.policy.payableQuoteEnabled).toBe(true);
    expect(snapshot.totalUsd).toBeLessThanOrEqual(CONSULTATION_BAND_CEILING_USD);
    expect(snapshot.totalUsd).toBe(CONSULTATION_BAND_CEILING_USD);

    // The displayed per-finding lines must still sum exactly to the bounded headline total.
    const lineSum = snapshot.lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
    expect(lineSum).toBe(snapshot.totalUsd);
    for (const item of snapshot.lineItems) {
      expect(item.amountUsd).toBeLessThanOrEqual(CONSULTATION_BAND_CEILING_USD);
    }
  });

  it("applies the documented floor to a small remediation-sprint estimate", () => {
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Edge traffic reaches application services and a managed store.",
      findings: [
        {
          ruleId: "workload_objective_and_constraints_stated",
          category: "clarity",
          pointsDeducted: 15,
          message: "The workload objective and measurable constraints are not stated.",
          fix: "Collect a short requirements blurb (objective, users, load, data sensitivity, RTO/RPO).",
          evidence: "The narrative leaves the workload objective and constraints ambiguous.",
        },
      ],
      userEmail: "architect@acmecloud.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    expect(report.overallScore).toBeGreaterThanOrEqual(60);
    expect(report.overallScore).toBeLessThan(90);

    const { snapshot } = buildFallbackArchitectureEstimateSnapshot(report);

    expect(snapshot.policy.band).toBe("remediation-estimate");
    expect(snapshot.totalUsd).toBe(CONSULTATION_BAND_FLOOR_USD);
    const lineSum = snapshot.lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
    expect(lineSum).toBe(snapshot.totalUsd);
  });

  it("ARCH-Q03: a low-confidence review is forced consultation-first with no payable figure", () => {
    const report = buildHighHourReport({ analysisConfidenceOverride: "low" });
    expect(report.analysisConfidence).toBe("low");
    expect(report.overallScore).toBeGreaterThanOrEqual(60);

    const { snapshot } = buildFallbackArchitectureEstimateSnapshot(report);

    expect(snapshot.policy.band).toBe("consultation-only");
    expect(snapshot.policy.payableQuoteEnabled).toBe(false);
    expect(snapshot.totalUsd).toBe(0);
    expect(snapshot.lineItems).toHaveLength(0);
    // The score band label still reflects the real score, not "0-59".
    expect(snapshot.policy.scoreBandLabel).not.toBe("0-59");
  });

  it("ARCH-Q02: the stored consultationQuoteUSD equals the canonical (clamped) snapshot total", () => {
    const report = buildHighHourReport();
    const { snapshot } = buildFallbackArchitectureEstimateSnapshot(report);

    // Single source of truth: the persisted headline IS Formula B, clamped — not a divergent
    // Formula A figure. For the high-hour cluster that means the clamped ceiling, not a five-figure
    // legacy number.
    expect(report.consultationQuoteUSD).toBe(snapshot.totalUsd);
    expect(report.consultationQuoteUSD).toBe(CONSULTATION_BAND_CEILING_USD);
  });
});
