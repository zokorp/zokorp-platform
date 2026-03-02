import path from "node:path";

import * as XLSX from "xlsx";

import type {
  ValidationCheckStatus,
  ValidationProfile,
  ValidationTargetContext,
  ValidationReport,
} from "@/lib/zokorp-validator-engine";

type ControlConfidence = "HIGH" | "MEDIUM" | "LOW";

type InternalControlItem = NonNullable<ValidationReport["controlCalibration"]>["controls"][number] & {
  _sheetRowIndex: number;
};

const MAX_CONTROLS_IN_API_RESPONSE = 300;
const MAX_INLINE_REVIEWED_WORKBOOK_BYTES = 2_500_000;

const MONTH_PATTERN = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

const SIGNAL_PATTERNS = {
  evidenceRef: /\b(https?:\/\/|ticket\s*#?\d+|jira|confluence|artifact|appendix|evidence|reference|doc(?:ument)?\s*id|s3:\/\/)\b/i,
  owner: /\b(owner|team|engineer|architect|lead|contact|approver|reviewer|responsible|raci)\b/i,
  date: /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i,
  metric: /\b\d+(?:\.\d+)?\s*(%|percent|hours?|days?|weeks?|months?|tickets?|incidents?|controls?|findings?|items?)\b/i,
  scope: /\b(scope|in[\s-]?scope|out[\s-]?of[\s-]?scope|boundary|environment|workload|region|account)\b/i,
};

type ColumnHints = {
  id: number | null;
  requirement: number | null;
  response: number[];
};

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsHint(header: string, hints: string[]) {
  return hints.some((hint) => header.includes(hint));
}

function detectHeaderRow(rows: string[][]) {
  const maxRow = Math.min(25, rows.length);
  let bestRow = 0;
  let bestScore = -1;

  const headerHintWords = [
    "control",
    "requirement",
    "criteria",
    "question",
    "evidence",
    "response",
    "comments",
    "status",
    "id",
  ];

  for (let rowIndex = 0; rowIndex < maxRow; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    let score = 0;

    for (const cell of row) {
      const normalized = normalizeHeader(cell);
      if (!normalized) {
        continue;
      }

      for (const word of headerHintWords) {
        if (normalized.includes(word)) {
          score += 1;
          break;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = rowIndex;
    }
  }

  return bestRow;
}

function detectColumns(headers: string[]): ColumnHints {
  const normalized = headers.map((header) => normalizeHeader(header));

  const idHints = ["control id", "requirement id", "criteria id", "control #", "item id", "id"];
  const requirementHints = [
    "requirement",
    "criteria",
    "control",
    "question",
    "validation",
    "description",
    "expectation",
  ];
  const responseHints = [
    "response",
    "answer",
    "partner response",
    "evidence",
    "comments",
    "justification",
    "notes",
    "details",
    "observation",
    "status",
  ];

  let id: number | null = null;
  let requirement: number | null = null;
  const response: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const value = normalized[index];
    if (!value) {
      continue;
    }

    if (id === null && containsHint(value, idHints)) {
      id = index;
      continue;
    }

    if (requirement === null && containsHint(value, requirementHints)) {
      requirement = index;
      continue;
    }

    if (containsHint(value, responseHints)) {
      response.push(index);
    }
  }

  return {
    id,
    requirement,
    response,
  };
}

function pickRequirement(cells: string[], columns: ColumnHints): string {
  if (columns.requirement !== null) {
    const direct = normalizeText(cells[columns.requirement]);
    if (direct) {
      return direct;
    }
  }

  let best = "";
  for (let index = 0; index < Math.min(cells.length, 8); index += 1) {
    if (columns.response.includes(index)) {
      continue;
    }

    const value = normalizeText(cells[index]);
    if (value.length > best.length) {
      best = value;
    }
  }

  return best;
}

function pickResponse(cells: string[], columns: ColumnHints): string {
  const values: string[] = [];

  for (const column of columns.response) {
    const value = normalizeText(cells[column]);
    if (value) {
      values.push(value);
    }
  }

  if (values.length === 0) {
    if (cells.length >= 3) {
      return normalizeText(cells[2]);
    }
    if (cells.length >= 2) {
      return normalizeText(cells[1]);
    }
  }

  return [...new Set(values)].join(" | ");
}

function pickControlId(cells: string[], columns: ColumnHints, rowNumber: number): string {
  if (columns.id !== null) {
    const explicit = normalizeText(cells[columns.id]);
    if (explicit) {
      return explicit;
    }
  }

  return `CTRL-${rowNumber}`;
}

function isLikelySectionHeading(requirement: string, response: string): boolean {
  if (response) {
    return false;
  }

  if (requirement.length < 8) {
    return true;
  }

  const upper = requirement.toUpperCase();
  const hasLetters = /[A-Z]/.test(upper);
  if (hasLetters && requirement === upper && requirement.length <= 80) {
    return true;
  }

  return false;
}

function clampCellValue(value: string, limit = 32000): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 3)}...`;
}

function recommendationForMissingSignals(missingSignals: string[]): string {
  const map: Record<string, string> = {
    length: "Expand the response with concrete technical detail grounded in existing project evidence.",
    evidence_ref: "Reference a specific artifact (document, ticket, appendix, or link) that supports this control.",
    owner: "Name the accountable owner/team for this control.",
    date: "Include review/update date so evidence recency is clear.",
    metric: "Add measurable evidence (counts, percentages, timelines, or outcomes).",
    scope: "State in-scope/out-of-scope boundaries for this control clearly.",
    reference_alignment:
      "Align wording with official checklist/calibration terms and map your response to matching criteria.",
  };

  const messages = missingSignals.map((signal) => map[signal]).filter(Boolean);
  return messages.slice(0, 3).join(" ");
}

function normalizeResponseForSuggestion(response: string): string {
  const cleaned = response
    .replace(/\s*\|\s*/g, "; ")
    .replace(/\s+/g, " ")
    .trim();

  return clampCellValue(cleaned, 2200);
}

function buildSuggestedEdit(input: {
  response: string;
  missingSignals: string[];
}): string {
  if (!input.response.trim()) {
    return "No response provided. Add factual evidence only from your own records: [scope], [owner], [evidence reference], [date], and [metric where available].";
  }

  const base = normalizeResponseForSuggestion(input.response);
  if (input.missingSignals.length === 0) {
    return base;
  }

  const addOns: string[] = [];
  if (input.missingSignals.includes("scope")) {
    addOns.push("[ADD SCOPE BOUNDARY]");
  }
  if (input.missingSignals.includes("owner")) {
    addOns.push("[ADD OWNER/TEAM]");
  }
  if (input.missingSignals.includes("evidence_ref")) {
    addOns.push("[ADD EVIDENCE REFERENCE]");
  }
  if (input.missingSignals.includes("date")) {
    addOns.push("[ADD REVIEW DATE]");
  }
  if (input.missingSignals.includes("metric")) {
    addOns.push("[ADD METRIC/OUTCOME]");
  }
  if (input.missingSignals.includes("reference_alignment")) {
    addOns.push("[ALIGN TO CHECKLIST TERMS]");
  }

  if (addOns.length === 0) {
    return base;
  }

  return clampCellValue(`${base} | Strengthen with: ${addOns.join(" ")}`, 30000);
}

function evaluateControl(input: {
  profile: ValidationProfile;
  requirement: string;
  response: string;
  referenceKeywords?: string[];
}): {
  status: ValidationCheckStatus;
  confidence: ControlConfidence;
  missingSignals: string[];
  recommendation: string;
  suggestedEdit: string;
} {
  const response = input.response.trim();
  const requirement = input.requirement.trim();

  if (!response) {
    const missing = ["length", "evidence_ref", "owner", "date"];
    return {
      status: "MISSING",
      confidence: "HIGH",
      missingSignals: missing,
      recommendation: recommendationForMissingSignals(missing),
      suggestedEdit: buildSuggestedEdit({ response, missingSignals: missing }),
    };
  }

  const missingSignals: string[] = [];

  if (response.length < 45) {
    missingSignals.push("length");
  }

  if (!SIGNAL_PATTERNS.evidenceRef.test(response)) {
    missingSignals.push("evidence_ref");
  }

  if (!SIGNAL_PATTERNS.owner.test(response)) {
    missingSignals.push("owner");
  }

  const hasDate = SIGNAL_PATTERNS.date.test(response) || MONTH_PATTERN.test(response);
  if (!hasDate) {
    missingSignals.push("date");
  }

  if (!SIGNAL_PATTERNS.metric.test(response)) {
    missingSignals.push("metric");
  }

  if (input.profile === "FTR" && !SIGNAL_PATTERNS.scope.test(`${requirement} ${response}`)) {
    missingSignals.push("scope");
  }

  if (input.referenceKeywords && input.referenceKeywords.length > 0) {
    const responseLower = response.toLowerCase();
    const hasReferenceAlignment = input.referenceKeywords.some(
      (keyword) => keyword.length >= 4 && responseLower.includes(keyword),
    );

    if (!hasReferenceAlignment) {
      missingSignals.push("reference_alignment");
    }
  }

  const uniqueMissing = [...new Set(missingSignals)];

  let status: ValidationCheckStatus;
  if (uniqueMissing.length === 0) {
    status = "PASS";
  } else if (uniqueMissing.length <= 2) {
    status = "PARTIAL";
  } else {
    status = "MISSING";
  }

  const confidence: ControlConfidence =
    status === "PASS" && response.length >= 120
      ? "HIGH"
      : status === "PASS" || status === "PARTIAL"
        ? "MEDIUM"
        : "LOW";

  return {
    status,
    confidence,
    missingSignals: uniqueMissing,
    recommendation: recommendationForMissingSignals(uniqueMissing),
    suggestedEdit: buildSuggestedEdit({ response, missingSignals: uniqueMissing }),
  };
}

function setCell(worksheet: XLSX.WorkSheet, row: number, column: number, value: string) {
  const address = XLSX.utils.encode_cell({ r: row, c: column });
  worksheet[address] = { t: "s", v: clampCellValue(value) };
}

function annotateWorksheet(input: {
  worksheet: XLSX.WorkSheet;
  headerRowIndex: number;
  controls: InternalControlItem[];
}) {
  const { worksheet, headerRowIndex, controls } = input;

  const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1");
  const statusColumn = range.e.c + 1;
  const recommendationColumn = statusColumn + 1;
  const suggestedColumn = recommendationColumn + 1;

  setCell(worksheet, headerRowIndex, statusColumn, "ZoKorp Auto Status");
  setCell(worksheet, headerRowIndex, recommendationColumn, "ZoKorp Auto Recommendation");
  setCell(worksheet, headerRowIndex, suggestedColumn, "ZoKorp Suggested Edit (No New Facts)");

  for (const control of controls) {
    setCell(worksheet, control._sheetRowIndex, statusColumn, control.status);
    setCell(worksheet, control._sheetRowIndex, recommendationColumn, control.recommendation || "No recommendation.");
    setCell(worksheet, control._sheetRowIndex, suggestedColumn, control.suggestedEdit || control.response || "");
  }

  range.e.c = Math.max(range.e.c, suggestedColumn);
  worksheet["!ref"] = XLSX.utils.encode_range(range);
}

function buildSummarySheetRows(controls: InternalControlItem[][]) {
  const rows: string[][] = [
    [
      "Sheet",
      "Row",
      "Control ID",
      "Status",
      "Confidence",
      "Requirement",
      "Current Response",
      "Recommendation",
      "Suggested Edit (No New Facts)",
    ],
  ];

  for (const sheetItems of controls) {
    for (const control of sheetItems) {
      rows.push([
        control.sheetName,
        String(control.rowNumber),
        control.controlId,
        control.status,
        control.confidence,
        control.requirement,
        control.response,
        control.recommendation,
        control.suggestedEdit,
      ]);
    }
  }

  return rows;
}

function parseWorksheetControls(input: {
  worksheet: XLSX.WorkSheet;
  sheetName: string;
  profile: ValidationProfile;
  referenceKeywords?: string[];
}) {
  const rowsRaw = XLSX.utils.sheet_to_json<unknown[]>(input.worksheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  const rows: string[][] = rowsRaw.map((row) => {
    if (!Array.isArray(row)) {
      return [];
    }

    return row.map((cell) => normalizeText(cell));
  });

  if (rows.length === 0) {
    return {
      headerRowIndex: 0,
      controls: [] as InternalControlItem[],
    };
  }

  const headerRowIndex = detectHeaderRow(rows);
  const headers = rows[headerRowIndex] ?? [];
  const columns = detectColumns(headers);

  const controls: InternalControlItem[] = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const cells = rows[rowIndex] ?? [];
    const requirement = pickRequirement(cells, columns);
    const response = pickResponse(cells, columns);

    if (!requirement) {
      continue;
    }

    if (isLikelySectionHeading(requirement, response)) {
      continue;
    }

    const controlId = pickControlId(cells, columns, rowIndex + 1);
    const review = evaluateControl({
      profile: input.profile,
      requirement,
      response,
      referenceKeywords: input.referenceKeywords,
    });

    controls.push({
      sheetName: input.sheetName,
      rowNumber: rowIndex + 1,
      _sheetRowIndex: rowIndex,
      controlId,
      requirement,
      response,
      status: review.status,
      confidence: review.confidence,
      missingSignals: review.missingSignals,
      recommendation: review.recommendation,
      suggestedEdit: review.suggestedEdit,
    });
  }

  return {
    headerRowIndex,
    controls,
  };
}

function createReviewedFileName(originalFilename: string) {
  const parsed = path.parse(originalFilename);
  const base = parsed.name || "checklist";
  return `${base}-zokorp-reviewed.xlsx`;
}

export function reviewChecklistWorkbook(input: {
  buffer: Buffer;
  filename: string;
  profile: ValidationProfile;
  target?: ValidationTargetContext;
  referenceKeywords?: string[];
}) {
  const workbook = XLSX.read(input.buffer, { type: "buffer" });
  const processingNotes: string[] = [];
  const controlsBySheet: InternalControlItem[][] = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toLowerCase() === "zokorp review") {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      continue;
    }

    const parsed = parseWorksheetControls({
      worksheet,
      sheetName,
      profile: input.profile,
      referenceKeywords: input.referenceKeywords,
    });

    if (parsed.controls.length === 0) {
      continue;
    }

    annotateWorksheet({
      worksheet,
      headerRowIndex: parsed.headerRowIndex,
      controls: parsed.controls,
    });

    controlsBySheet.push(parsed.controls);
  }

  const flattened = controlsBySheet.flat();

  if (flattened.length === 0) {
    processingNotes.push("No control-like rows were detected in the spreadsheet for calibration analysis.");

    return {
      controlCalibration: {
        totalControls: 0,
        counts: { PASS: 0, PARTIAL: 0, MISSING: 0 } as Record<ValidationCheckStatus, number>,
        controls: [],
      },
      reviewedWorkbookBase64: undefined,
      reviewedWorkbookFileName: undefined,
      reviewedWorkbookMimeType: undefined,
      processingNotes,
    };
  }

  const summaryRows = buildSummarySheetRows(controlsBySheet);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);

  const existingSummaryIndex = workbook.SheetNames.indexOf("ZoKorp Review");
  if (existingSummaryIndex >= 0) {
    workbook.SheetNames.splice(existingSummaryIndex, 1);
    delete workbook.Sheets["ZoKorp Review"];
  }

  XLSX.utils.book_append_sheet(workbook, summarySheet, "ZoKorp Review");

  const counts = flattened.reduce<Record<ValidationCheckStatus, number>>(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { PASS: 0, PARTIAL: 0, MISSING: 0 },
  );

  const workbookBase64 = XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
  });

  const workbookBytes = Math.floor((workbookBase64.length * 3) / 4);

  let reviewedWorkbookBase64: string | undefined;
  let reviewedWorkbookFileName: string | undefined;
  let reviewedWorkbookMimeType: string | undefined;

  if (workbookBytes <= MAX_INLINE_REVIEWED_WORKBOOK_BYTES) {
    reviewedWorkbookBase64 = workbookBase64;
    reviewedWorkbookFileName = createReviewedFileName(input.filename);
    reviewedWorkbookMimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    processingNotes.push(
      `Reviewed workbook generated but too large for inline download payload (${workbookBytes} bytes).`,
    );
  }

  let controls = flattened.map((item) => ({
    sheetName: item.sheetName,
    rowNumber: item.rowNumber,
    controlId: item.controlId,
    requirement: item.requirement,
    response: item.response,
    status: item.status,
    confidence: item.confidence,
    missingSignals: item.missingSignals,
    recommendation: item.recommendation,
    suggestedEdit: item.suggestedEdit,
  }));

  if (controls.length > MAX_CONTROLS_IN_API_RESPONSE) {
    processingNotes.push(
      `Control list truncated to first ${MAX_CONTROLS_IN_API_RESPONSE} rows for UI payload efficiency. Full details are in the reviewed workbook (ZoKorp Review tab).`,
    );
    controls = controls.slice(0, MAX_CONTROLS_IN_API_RESPONSE);
  }

  if (input.target) {
    processingNotes.push(
      `Control review aligned to selected checklist target: ${input.target.label} (${input.target.track.toUpperCase()}).`,
    );
  }
  if (input.referenceKeywords && input.referenceKeywords.length > 0) {
    processingNotes.push(
      `Reference-term alignment enabled with ${input.referenceKeywords.length} extracted checklist/calibration keywords.`,
    );
  }

  return {
    controlCalibration: {
      totalControls: flattened.length,
      counts,
      controls,
    },
    reviewedWorkbookBase64,
    reviewedWorkbookFileName,
    reviewedWorkbookMimeType,
    processingNotes,
  };
}
