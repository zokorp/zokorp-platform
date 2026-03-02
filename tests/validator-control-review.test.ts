import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { reviewChecklistWorkbook } from "@/lib/validator-control-review";

describe("validator control review", () => {
  it("produces control-by-control calibration and reviewed workbook", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Control ID", "Requirement", "Partner Response"],
      [
        "C-001",
        "Define in-scope and out-of-scope boundaries.",
        "Scope includes prod and staging. Owner: platform team. Evidence: https://docs.example.com/ftr/1. Updated 2026-03-02. 95% control coverage.",
      ],
      ["C-002", "Document risk register with owner and mitigation.", "Risk register exists."],
      ["C-003", "Provide incident process and evidence references.", ""],
    ]);

    XLSX.utils.book_append_sheet(workbook, sheet, "Checklist");

    const buffer = Buffer.from(
      XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }),
    );

    const result = reviewChecklistWorkbook({
      buffer,
      filename: "sample-checklist.xlsx",
      profile: "FTR",
      target: {
        id: "ftr:sample",
        label: "Sample FTR",
        track: "ftr",
      },
    });

    expect(result.controlCalibration.totalControls).toBeGreaterThanOrEqual(3);
    expect(result.controlCalibration.counts.MISSING).toBeGreaterThanOrEqual(1);
    expect(result.controlCalibration.controls.length).toBeGreaterThanOrEqual(3);
    expect(result.controlCalibration.controls[0]?.suggestedEdit.length).toBeGreaterThan(0);
    expect(result.reviewedWorkbookBase64).toBeDefined();
    expect(result.reviewedWorkbookFileName).toContain("zokorp-reviewed.xlsx");
  });
});
