import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { reviewChecklistWorkbook } from "@/lib/validator-control-review";

describe("validator control review", () => {
  it("produces control-by-control calibration and applies the FTR-safe rewrite rules", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Checklist");

    sheet.addRow(["Control ID", "Requirement", "Partner Response"]);
    sheet.addRow([
      "C-001",
      "Provide deployment guide use cases with page/section/paragraph evidence pointers.",
      "See deployment guide for details.",
    ]);
    sheet.addRow([
      "C-002",
      "Sanitize examples so credentials are never embedded in documentation.",
      "AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF AWS_SECRET_ACCESS_KEY=abcd1234",
    ]);
    sheet.addRow([
      "C-003",
      "Provide an incident management plan with roles, triage steps, and customer communication.",
      "",
    ]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await reviewChecklistWorkbook({
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

    const pointerControl = result.controlCalibration.controls.find((control) => control.controlId === "C-001");
    const credentialControl = result.controlCalibration.controls.find((control) => control.controlId === "C-002");
    const incidentControl = result.controlCalibration.controls.find((control) => control.controlId === "C-003");

    expect(pointerControl?.suggestedEdit).toContain("Doc: [TBD], Page: [TBD], Section: [TBD], Paragraph: [TBD]");
    expect(credentialControl?.suggestedEdit).toContain("<REDACTED_AWS_ACCESS_KEY_ID>");
    expect(credentialControl?.suggestedEdit).toContain("Do not hardcode credentials");
    expect(incidentControl?.suggestedEdit).toContain("## Incident Management Plan");
    expect(pointerControl?.responseCell).toMatch(/^[A-Z]+[0-9]+$/);
    expect(result.reviewedWorkbookBase64).toBeDefined();
    expect(result.reviewedWorkbookFileName).toContain("zokorp-edit-guide.csv");
    expect(result.reviewedWorkbookMimeType).toContain("text/csv");
  });
});
