import ExcelJS from "exceljs";
import JSZip from "jszip";

export type WorkbookSheetRows = {
  name: string;
  rows: string[][];
};

const REQUIRED_XLSX_ARCHIVE_PARTS = ["[Content_Types].xml", "xl/workbook.xml"] as const;
const MAX_XLSX_ARCHIVE_ENTRIES = 300;
const MAX_XLSX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_XLSX_WORKSHEETS = 20;
const MAX_XLSX_TOTAL_ROWS = 10_000;
const MAX_XLSX_TOTAL_CELLS = 100_000;

type ZipObjectWithMetadata = JSZip.JSZipObject & {
  _data?: {
    uncompressedSize?: number;
  };
};

function zipEntryUncompressedSize(entry: JSZip.JSZipObject) {
  const size = (entry as ZipObjectWithMetadata)._data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) ? size : null;
}

async function preflightXlsxWorkbook(buffer: Buffer) {
  let archive: JSZip;

  try {
    archive = await JSZip.loadAsync(buffer, { createFolders: false });
  } catch {
    throw new Error("Invalid XLSX archive.");
  }

  const files = Object.values(archive.files).filter((entry) => !entry.dir);
  if (files.length === 0) {
    throw new Error("Invalid XLSX archive.");
  }

  for (const requiredPart of REQUIRED_XLSX_ARCHIVE_PARTS) {
    if (!archive.file(requiredPart)) {
      throw new Error("Invalid XLSX archive.");
    }
  }

  if (files.length > MAX_XLSX_ARCHIVE_ENTRIES) {
    throw new Error("XLSX archive contains too many files.");
  }

  const worksheetCount = files.filter(
    (entry) => entry.name.startsWith("xl/worksheets/") && entry.name.endsWith(".xml"),
  ).length;
  if (worksheetCount === 0) {
    throw new Error("Invalid XLSX archive.");
  }

  if (worksheetCount > MAX_XLSX_WORKSHEETS) {
    throw new Error("XLSX workbook exceeds worksheet limits.");
  }

  let totalUncompressedBytes = 0;
  for (const entry of files) {
    const knownSize = zipEntryUncompressedSize(entry);
    const entrySize = knownSize ?? (await entry.async("uint8array")).byteLength;

    totalUncompressedBytes += entrySize;
    if (totalUncompressedBytes > MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw new Error("XLSX archive is too large.");
    }
  }
}

function normalizeCellValue(value: ExcelJS.CellValue | null): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      if ("text" in value && typeof value.text === "string" && value.text.trim()) {
        return `${value.text} (${value.hyperlink})`;
      }
      return value.hyperlink;
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((chunk) => chunk.text).join("");
    }

    if ("result" in value && value.result !== null && value.result !== undefined) {
      return String(value.result);
    }

    if ("formula" in value && typeof value.formula === "string") {
      return value.formula;
    }
  }

  return String(value);
}

function cleanCellText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function readXlsxWorkbookRows(buffer: Buffer): Promise<WorkbookSheetRows[]> {
  await preflightXlsxWorkbook(buffer);

  const workbook = new ExcelJS.Workbook();
  const excelBuffer = buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);

  let totalRows = 0;
  let totalCells = 0;

  return workbook.worksheets.map((worksheet) => {
    const rowCount = Math.max(worksheet.rowCount, worksheet.actualRowCount);
    totalRows += rowCount;
    if (totalRows > MAX_XLSX_TOTAL_ROWS) {
      throw new Error("XLSX workbook exceeds row limits.");
    }

    const rows: string[][] = [];

    for (let rowNumber = 1; rowNumber <= rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const cellCount = Math.max(row.cellCount, row.actualCellCount);
      totalCells += cellCount;
      if (totalCells > MAX_XLSX_TOTAL_CELLS) {
        throw new Error("XLSX workbook exceeds cell limits.");
      }

      const cells: string[] = [];

      for (let cellNumber = 1; cellNumber <= cellCount; cellNumber += 1) {
        const cell = row.getCell(cellNumber);
        cells.push(cleanCellText(normalizeCellValue(cell.value)));
      }

      rows.push(cells);
    }

    return {
      name: worksheet.name,
      rows,
    };
  });
}

function columnToLetters(columnNumber: number) {
  let num = columnNumber;
  let letters = "";

  while (num > 0) {
    const remainder = (num - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    num = Math.floor((num - 1) / 26);
  }

  return letters;
}

export function encodeCellReference(input: { rowIndex: number; columnIndex: number }) {
  return `${columnToLetters(input.columnIndex + 1)}${input.rowIndex + 1}`;
}
