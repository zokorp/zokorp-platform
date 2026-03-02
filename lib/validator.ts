import * as XLSX from "xlsx";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

import {
  buildValidationReport,
  formatValidationReport,
  type ValidationProfile,
} from "@/lib/zokorp-validator-engine";

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
  profile: ValidationProfile;
  additionalContext?: string;
}) {
  const lower = input.filename.toLowerCase();
  const context = input.additionalContext?.trim();

  if (lower.endsWith(".pdf") || input.mimeType === "application/pdf") {
    const parsed = await pdfParse(input.buffer);
    const text = parsed.text.replace(/\s+/g, " ").trim();
    const report = buildValidationReport({
      profile: input.profile,
      rawText: text,
      context: {
        sourceType: "pdf",
        filename: input.filename,
        pages: parsed.numpages,
        additionalContext: context,
      },
    });

    return {
      output: formatValidationReport(report),
      meta: {
        pages: parsed.numpages,
        words: text.length ? text.split(" ").length : 0,
        inputType: "pdf",
        profile: input.profile,
      },
      report,
    };
  }

  const workbook = XLSX.read(input.buffer, { type: "buffer" });
  const sheetSummaries = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const summary = summarizeWorksheetRows(sheet);

    return `Sheet: ${name}\n${summary || "No rows found."}`;
  });

  const output = sheetSummaries.join("\n\n---\n\n").slice(0, 8000);
  const report = buildValidationReport({
    profile: input.profile,
    rawText: output,
    context: {
      sourceType: "spreadsheet",
      filename: input.filename,
      sheets: workbook.SheetNames.length,
      additionalContext: context,
    },
  });

  return {
    output: formatValidationReport(report),
    meta: {
      inputType: "spreadsheet",
      sheets: workbook.SheetNames.length,
      profile: input.profile,
    },
    report,
  };
}
