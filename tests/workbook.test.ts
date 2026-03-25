import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { readXlsxWorkbookRows } from "@/lib/workbook";

async function buildWorkbookBuffer(
  populate: (workbook: ExcelJS.Workbook) => void,
) {
  const workbook = new ExcelJS.Workbook();
  populate(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

describe("readXlsxWorkbookRows", () => {
  it("rejects malformed XLSX archives before ExcelJS parsing", async () => {
    const validBuffer = await buildWorkbookBuffer((workbook) => {
      workbook.addWorksheet("Sheet 1").addRow(["hello"]);
    });

    const archive = await JSZip.loadAsync(validBuffer);
    archive.remove("xl/workbook.xml");
    const malformedBuffer = await archive.generateAsync({ type: "nodebuffer" });

    await expect(readXlsxWorkbookRows(malformedBuffer)).rejects.toThrow("Invalid XLSX archive.");
  });

  it("rejects workbooks that exceed worksheet limits", async () => {
    const oversizedBuffer = await buildWorkbookBuffer((workbook) => {
      for (let index = 0; index < 21; index += 1) {
        workbook.addWorksheet(`Sheet ${index + 1}`).addRow([`row-${index + 1}`]);
      }
    });

    await expect(readXlsxWorkbookRows(oversizedBuffer)).rejects.toThrow("worksheet limits");
  });

  it("rejects workbooks that exceed parsed row limits", async () => {
    const oversizedBuffer = await buildWorkbookBuffer((workbook) => {
      const sheet = workbook.addWorksheet("Sheet 1");
      for (let index = 0; index < 10_001; index += 1) {
        sheet.addRow([`row-${index + 1}`]);
      }
    });

    await expect(readXlsxWorkbookRows(oversizedBuffer)).rejects.toThrow("row limits");
  });
});
