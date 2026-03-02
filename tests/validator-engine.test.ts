import { describe, expect, it } from "vitest";

import { buildValidationReport, formatValidationReport } from "@/lib/zokorp-validator-engine";

describe("zokorp validator engine", () => {
  it("scores FTR text with recognizable evidence keywords", () => {
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
    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(report.counts.PASS).toBeGreaterThanOrEqual(4);
    expect(report.documentMetrics.wordCount).toBeGreaterThan(20);
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
      profile: "SDP_SRP",
      rawText: "Service process includes support escalation and monitoring runbook.",
      context: {
        sourceType: "pdf",
        filename: "sdp.pdf",
        pages: 1,
      },
    });

    const formatted = formatValidationReport(report);
    expect(formatted).toContain("ZoKorpValidator Report (SDP/SRP)");
    expect(formatted).toContain("Checklist results:");
  });
});
