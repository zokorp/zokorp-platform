import { describe, expect, it } from "vitest";

import { buildValidatorEstimate } from "@/lib/validator-estimate-catalog";
import type { ValidationReport } from "@/lib/zokorp-validator-engine";

function createBaseReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    profile: "FTR",
    profileLabel: "FTR",
    overview: "Foundational technical readiness review.",
    score: 72,
    counts: { PASS: 2, PARTIAL: 1, MISSING: 1 },
    summary: "FTR validation indicates moderate readiness with targeted gaps.",
    topGaps: ["Scope is unclear."],
    rulepack: {
      id: "ftr::default",
      version: "2026.03.02",
      ruleCount: 4,
    },
    processingNotes: [],
    documentMetrics: {
      sourceType: "pdf",
      filename: "validator.pdf",
      wordCount: 900,
      characterCount: 5800,
    },
    checks: [
      {
        id: "scope",
        title: "Scope and objectives are defined",
        description: "Scope should be explicit.",
        status: "MISSING",
        severity: "CRITICAL",
        weight: 1.2,
        hitKeywords: [],
        hitPatterns: [],
        evidence: null,
        guidance: "Add in-scope and out-of-scope boundaries.",
      },
      {
        id: "approval",
        title: "Review/approval trail exists",
        description: "Approval trail should exist.",
        status: "PARTIAL",
        severity: "IMPORTANT",
        weight: 1,
        hitKeywords: ["approved"],
        hitPatterns: [],
        evidence: "Approved by owner",
        guidance: "Add dates and reviewer sign-off.",
      },
    ],
    ...overrides,
  };
}

describe("validator estimate catalog", () => {
  it("builds a line-itemed estimate with rule-based pricing and control-row effort", () => {
    const estimate = buildValidatorEstimate(
      createBaseReport({
        controlCalibration: {
          totalControls: 4,
          counts: { PASS: 2, PARTIAL: 1, MISSING: 1 },
          controls: [
            {
              sheetName: "Checklist",
              rowNumber: 2,
              controlId: "CTRL-1",
              requirement: "Requirement 1",
              response: "Weak response",
              status: "MISSING",
              confidence: "HIGH",
              missingSignals: ["scope"],
              recommendation: "Clarify the requirement.",
              suggestedEdit: "Clearer response",
            },
            {
              sheetName: "Checklist",
              rowNumber: 3,
              controlId: "CTRL-2",
              requirement: "Requirement 2",
              response: "Partial response",
              status: "PARTIAL",
              confidence: "MEDIUM",
              missingSignals: ["approval"],
              recommendation: "Add reviewer sign-off.",
              suggestedEdit: "Add sign-off date",
            },
          ],
        },
      }),
    );

    expect(estimate.quoteUsd).toBe(300);
    expect(estimate.estimatedHoursTotal).toBe(3.5);
    expect(estimate.slaLabel).toBe("1-2 business days");
    expect(estimate.lineItems).toEqual([
      expect.objectContaining({
        ruleId: "scope",
        serviceLineLabel: "Scope and objectives rewrite",
        amountUsd: 175,
        estimatedHours: 2,
      }),
      expect.objectContaining({
        ruleId: "approval",
        serviceLineLabel: "Approval trail cleanup",
        amountUsd: 50,
        estimatedHours: 0.5,
      }),
      expect.objectContaining({
        ruleId: "control-row-review",
        serviceLineLabel: "Control-row rewrite pass",
        amountUsd: 75,
        estimatedHours: 1,
      }),
    ]);
  });

  it("adds a polish floor package for high-scoring submissions", () => {
    const estimate = buildValidatorEstimate(
      createBaseReport({
        score: 96,
        counts: { PASS: 4, PARTIAL: 0, MISSING: 0 },
        checks: [],
      }),
    );

    expect(estimate.quoteUsd).toBe(250);
    expect(estimate.estimatedHoursTotal).toBe(2);
    expect(estimate.lineItems).toEqual([
      expect.objectContaining({
        ruleId: "submission-polish",
        serviceLineLabel: "Submission polish pass",
      }),
    ]);
  });
});
