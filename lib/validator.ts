import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

function summarizeWorksheetRows(sheet: XLSX.WorkSheet, maxRows = 5): string {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const picked = rows.slice(0, maxRows);
  return picked
    .map((row, index) => `Row ${index + 1}: ${JSON.stringify(row)}`)
    .join("\n");
}

export async function parseValidatorInput(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}) {
  const lower = input.filename.toLowerCase();

  if (lower.endsWith(".pdf") || input.mimeType === "application/pdf") {
    const parser = new PDFParse({ data: input.buffer });
    const parsed = await parser.getText();
    await parser.destroy();

    const text = parsed.text.replace(/\s+/g, " ").trim();

    return {
      output: text.slice(0, 8000) || "No text extracted from PDF.",
      meta: {
        pages: parsed.total,
        words: text.length ? text.split(" ").length : 0,
        inputType: "pdf",
      },
    };
  }

  const workbook = XLSX.read(input.buffer, { type: "buffer" });
  const sheetSummaries = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const summary = summarizeWorksheetRows(sheet);

    return `Sheet: ${name}\n${summary || "No rows found."}`;
  });

  const output = sheetSummaries.join("\n\n---\n\n").slice(0, 8000);

  return {
    output: output || "No text extracted from spreadsheet.",
    meta: {
      inputType: "spreadsheet",
      sheets: workbook.SheetNames.length,
    },
  };
}
