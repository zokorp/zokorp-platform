import pdfParse from "pdf-parse/lib/pdf-parse.js";

import { reviewChecklistWorkbook } from "@/lib/validator-control-review";
import { loadTargetReferenceMaterial } from "@/lib/validator-reference-material";
import { sanitizeValidatorText } from "@/lib/validator-sanitizer";
import { readXlsxWorkbookRows } from "@/lib/workbook";
import {
  buildValidationReport,
  formatValidationReport,
  type ValidationProfile,
  type ValidationTargetContext,
} from "@/lib/zokorp-validator-engine";

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function summarizeWorksheetRows(rows: string[][], maxRows = 300, maxCols = 30, maxChars = 24000): string {
  const lines: string[] = [];
  let totalChars = 0;

  for (let rowIndex = 0; rowIndex < rows.length && rowIndex < maxRows; rowIndex += 1) {
    const row = rows[rowIndex];
    const cells: string[] = [];
    const columnCount = Math.min(maxCols, row.length);

    for (let colIndex = 0; colIndex < columnCount; colIndex += 1) {
      const normalized = normalizeCellValue(row[colIndex]);
      if (!normalized) {
        continue;
      }

      cells.push(`C${colIndex + 1}: ${normalized}`);
    }

    if (cells.length === 0) {
      continue;
    }

    const line = `Row ${rowIndex + 1}: ${cells.join(" | ")}`;
    totalChars += line.length;
    if (totalChars > maxChars) {
      break;
    }

    lines.push(line);
  }

  return lines.join("\n");
}

export async function parseValidatorInput(input: {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  profile: ValidationProfile;
  target?: ValidationTargetContext;
  additionalContext?: string;
}) {
  const lower = input.filename.toLowerCase();
  const context = input.additionalContext?.trim();
  const referenceMaterial = await loadTargetReferenceMaterial(input.target);

  if (lower.endsWith(".pdf") || input.mimeType === "application/pdf") {
    const parsed = await pdfParse(input.buffer);
    const extractedText = parsed.text.replace(/\s+/g, " ").trim();
    const sanitized = sanitizeValidatorText(extractedText);
    const report = buildValidationReport({
      profile: input.profile,
      rawText: sanitized.text,
      target: input.target,
      context: {
        sourceType: "pdf",
        filename: input.filename,
        pages: parsed.numpages,
        additionalContext: context,
        processingNotes: [...referenceMaterial.notes, ...sanitized.notes],
      },
    });

    return {
      output: formatValidationReport(report),
      meta: {
        pages: parsed.numpages,
        words: sanitized.text.length ? sanitized.text.split(" ").length : 0,
        inputType: "pdf",
        profile: input.profile,
        targetId: input.target?.id,
        redactions: sanitized.counts,
      },
      report,
      reviewedWorkbookBase64: undefined,
      reviewedWorkbookFileName: undefined,
      reviewedWorkbookMimeType: undefined,
    };
  }

  let workbookSheets;
  try {
    workbookSheets = await readXlsxWorkbookRows(input.buffer);
  } catch {
    throw new Error("UNREADABLE_SPREADSHEET");
  }
  const sheetSummaries = workbookSheets.map((sheet) => {
    const summary = summarizeWorksheetRows(sheet.rows);
    return `Sheet: ${sheet.name}\n${summary || "No rows found."}`;
  });

  const output = sheetSummaries.join("\n\n---\n\n").slice(0, 120000);
  const sanitized = sanitizeValidatorText(output);
  let controlReview;
  try {
    controlReview = await reviewChecklistWorkbook({
      buffer: input.buffer,
      filename: input.filename,
      profile: input.profile,
      target: input.target,
      referenceKeywords: referenceMaterial.keywords,
    });
  } catch {
    throw new Error("UNREADABLE_SPREADSHEET");
  }
  const processingNotes = [...referenceMaterial.notes, ...sanitized.notes, ...controlReview.processingNotes];

  const report = buildValidationReport({
    profile: input.profile,
    rawText: sanitized.text,
    target: input.target,
    controlCalibration: controlReview.controlCalibration,
    context: {
      sourceType: "spreadsheet",
      filename: input.filename,
      sheets: workbookSheets.length,
      additionalContext: context,
      processingNotes,
    },
  });

  return {
    output: formatValidationReport(report),
    meta: {
      inputType: "spreadsheet",
      sheets: workbookSheets.length,
      profile: input.profile,
      targetId: input.target?.id,
      redactions: sanitized.counts,
      controlCalibrationTotal: controlReview.controlCalibration.totalControls,
    },
    report,
    reviewedWorkbookBase64: controlReview.reviewedWorkbookBase64,
    reviewedWorkbookFileName: controlReview.reviewedWorkbookFileName,
    reviewedWorkbookMimeType: controlReview.reviewedWorkbookMimeType,
  };
}
