import { describe, expect, it } from "vitest";

import { buildValidatorEstimate } from "@/lib/validator-estimate-catalog";
import type { ValidationReport } from "@/lib/zokorp-validator-engine";

function createBaseReport(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    profile: "FTR",
    profileLabel: "FTR",
    overview: "Foundational technical readiness review.",
    score: 72,
    counts: { PASS: 2, PARTIAL: 2, MISSING: 0 },
    summary: "FTR validation indicates moderate readiness with targeted gaps.",
    topGaps: ["Self-assessment pointers are inconsistent."],
    rulepack: {
      id: "ftr::launch-v1",
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
        id: "self_assessment_complete_no_blanks",
        title: "Self-assessment is complete (required fields answered; links/page refs provided when requested)",
        description: "Checklist completeness and evidence pointers should be explicit.",
        status: "PARTIAL",
        severity: "IMPORTANT",
        weight: 4,
        hitKeywords: [],
        hitPatterns: [],
        evidence: "Evidence references are inconsistent.",
        guidance: "Fill missing checklist responses and add precise evidence pointers (link + page/section/paragraph).",
      },
      {
        id: "ph_support_plan_business_or_action_plan",
        title: "Partner-Hosted: AWS Business Support (or Partner-led Support) or action plan exists (SUP-001)",
        description: "Support coverage should be paired with an actionable escalation plan.",
        status: "PARTIAL",
        severity: "IMPORTANT",
        weight: 3,
        hitKeywords: ["support"],
        hitPatterns: [],
        evidence: "Support coverage is mentioned without a concrete escalation path.",
        guidance: "Document AWS support tier or create an action plan for issues requiring AWS Support, with escalation owners and steps.",
      },
    ],
    ...overrides,
  };
}

describe("validator estimate catalog", () => {
  it("builds a bounded FTR remediation estimate from the launch-v1 rule catalog", () => {
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

    expect(estimate.quoteUsd).toBe(575);
    expect(estimate.estimatedHoursTotal).toBe(5);
    expect(estimate.slaLabel).toBe("2-4 business days");
    expect(estimate.lineItems).toEqual([
      expect.objectContaining({
        ruleId: "self_assessment_complete_no_blanks",
        serviceLineLabel: "Complete FTR self-assessment with evidence pointers",
        amountUsd: 250,
        estimatedHours: 2,
      }),
      expect.objectContaining({
        ruleId: "ph_support_plan_business_or_action_plan",
        serviceLineLabel: "Document AWS support coverage + escalation plan",
        amountUsd: 250,
        estimatedHours: 2,
      }),
      expect.objectContaining({
        ruleId: "control-row-review",
        serviceLineLabel: "Control-row rewrite pass",
        amountUsd: 75,
        estimatedHours: 1,
      }),
    ]);
  });

  it("returns consultation-only output when a consultation-only FTR blocker fails", () => {
    const estimate = buildValidatorEstimate(
      createBaseReport({
        score: 42,
        counts: { PASS: 1, PARTIAL: 0, MISSING: 1 },
        checks: [
          {
            id: "required_artifacts_present_for_path",
            title: "Minimum artifact pack for the selected checklist path is present",
            description: "Core artifacts must be uploaded.",
            status: "MISSING",
            severity: "CRITICAL",
            weight: 6,
            hitKeywords: [],
            hitPatterns: [],
            evidence: "Missing architecture diagram.",
            guidance: "Upload the missing core artifacts (self-assessment, architecture diagram, and deployment guide if Customer-Deployed).",
          },
        ],
      }),
    );

    expect(estimate.quoteUsd).toBe(0);
    expect(estimate.estimatedHoursTotal).toBe(0);
    expect(estimate.slaLabel).toBe("Consultation required");
    expect(estimate.lineItems).toEqual([]);
    expect(estimate.summary).toContain("not safely auto-scopeable");
  });

  it("adds a polish floor package for high-scoring FTR submissions", () => {
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
