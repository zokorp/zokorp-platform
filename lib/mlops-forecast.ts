import type { WorkbookSheetRows } from "@/lib/workbook";

export type MLOpsForecastSourceType = "csv" | "xlsx" | "demo";

export type MLOpsForecastPoint = {
  dateISO: string;
  revenue: number;
};

export type MLOpsForecastRow = {
  dateISO: string;
  predictedRevenue: number;
  lowerBoundRevenue: number;
  upperBoundRevenue: number;
};

export type MLOpsForecastRun = {
  sourceType: MLOpsForecastSourceType;
  sourceName: string;
  observations: number;
  startDateISO: string;
  endDateISO: string;
  cadenceLabel: string;
  averageRevenue: number;
  lastRevenue: number;
  totalRevenue: number;
  trendPerPeriod: number;
  confidenceScore: number;
  confidenceLabel: "high" | "medium" | "low";
  summary: string;
  confidenceNotes: string[];
  forecastRows: MLOpsForecastRow[];
};

type RevenueForecastContext = {
  sourceType: MLOpsForecastSourceType;
  sourceName: string;
};

const DEMO_REVENUE_SERIES: MLOpsForecastPoint[] = [
  { dateISO: "2025-10-01", revenue: 42000 },
  { dateISO: "2025-11-01", revenue: 43800 },
  { dateISO: "2025-12-01", revenue: 45100 },
  { dateISO: "2026-01-01", revenue: 46800 },
  { dateISO: "2026-02-01", revenue: 48300 },
  { dateISO: "2026-03-01", revenue: 49900 },
  { dateISO: "2026-04-01", revenue: 51200 },
  { dateISO: "2026-05-01", revenue: 52800 },
  { dateISO: "2026-06-01", revenue: 54100 },
  { dateISO: "2026-07-01", revenue: 55800 },
  { dateISO: "2026-08-01", revenue: 57000 },
  { dateISO: "2026-09-01", revenue: 58900 },
];

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function toUtcDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00.000Z`);
}

function toDateISO(date: Date) {
  return date.toISOString().slice(0, 10);
}

function cleanHeaderCell(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseNumberCell(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const negative = trimmed.startsWith("(") && trimmed.endsWith(")");
  const normalized = trimmed.replace(/[,$\s]/g, "").replace(/[()]/g, "");
  const numeric = Number.parseFloat(normalized);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return negative ? -numeric : numeric;
}

function parseDateCell(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10) - 1;
    const day = Number.parseInt(isoMatch[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);
  if (slashMatch) {
    const first = Number.parseInt(slashMatch[1], 10);
    const second = Number.parseInt(slashMatch[2], 10);
    let year = Number.parseInt(slashMatch[3], 10);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    const month = first > 12 ? second - 1 : first - 1;
    const day = first > 12 ? first : second;
    const date = new Date(Date.UTC(year, month, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseRows(rows: string[][]): MLOpsForecastPoint[] {
  const meaningfulRows = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (meaningfulRows.length === 0) {
    throw new Error("No revenue rows were found.");
  }

  const firstRow = meaningfulRows[0].map(cleanHeaderCell);
  const dateHeaderCandidates = new Set(["date", "day", "period", "timestamp", "month"]);
  const valueHeaderCandidates = new Set(["revenue", "value", "amount", "sales", "income", "bookings"]);

  let dateColumn = 0;
  let valueColumn = 1;
  let startRow = 0;

  const detectedDateIndex = firstRow.findIndex((cell) => dateHeaderCandidates.has(cell));
  const detectedValueIndex = firstRow.findIndex((cell) => valueHeaderCandidates.has(cell));

  if (detectedDateIndex >= 0 && detectedValueIndex >= 0) {
    dateColumn = detectedDateIndex;
    valueColumn = detectedValueIndex;
    startRow = 1;
  }

  const points: MLOpsForecastPoint[] = [];

  for (let rowIndex = startRow; rowIndex < meaningfulRows.length; rowIndex += 1) {
    const row = meaningfulRows[rowIndex];
    const dateValue = row[dateColumn] ?? "";
    const revenueValue = row[valueColumn] ?? "";

    const parsedDate = parseDateCell(dateValue);
    const parsedRevenue = parseNumberCell(revenueValue);

    if (!parsedDate || parsedRevenue === null) {
      continue;
    }

    points.push({
      dateISO: toDateISO(parsedDate),
      revenue: parsedRevenue,
    });
  }

  const deduped = new Map<string, number>();
  for (const point of points) {
    deduped.set(point.dateISO, (deduped.get(point.dateISO) ?? 0) + point.revenue);
  }

  return [...deduped.entries()]
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
    .map(([dateISO, revenue]) => ({
      dateISO,
      revenue,
    }));
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance);
}

function linearRegression(values: number[]) {
  if (values.length < 2) {
    return { slope: 0, intercept: values[0] ?? 0 };
  }

  const xMean = (values.length - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < values.length; index += 1) {
    const x = index;
    numerator += (x - xMean) * (values[index] - yMean);
    denominator += (x - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function cadenceForPoints(points: MLOpsForecastPoint[]) {
  if (points.length < 2) {
    return { label: "insufficient history", stepDays: 30, irregular: false };
  }

  const gaps = points
    .slice(1)
    .map((point, index) => {
      const current = toUtcDate(point.dateISO).getTime();
      const previous = toUtcDate(points[index].dateISO).getTime();
      return Math.max(1, Math.round((current - previous) / (24 * 60 * 60 * 1000)));
    })
    .filter((gap) => gap > 0);

  const gapMedian = median(gaps);
  const gapSpread = gaps.length > 0 ? Math.max(...gaps) - Math.min(...gaps) : 0;
  const irregular = gaps.length > 1 && gapSpread > Math.max(2, gapMedian * 0.5);

  if (gapMedian <= 2) {
    return { label: irregular ? "daily, slightly irregular" : "daily", stepDays: 1, irregular };
  }

  if (gapMedian <= 9) {
    return { label: irregular ? "weekly, slightly irregular" : "weekly", stepDays: 7, irregular };
  }

  if (gapMedian <= 20) {
    return { label: irregular ? "biweekly, slightly irregular" : "biweekly", stepDays: 14, irregular };
  }

  return { label: irregular ? "monthly, slightly irregular" : "monthly", stepDays: Math.max(28, Math.round(gapMedian)), irregular };
}

function confidenceBand(values: number[], predicted: number, confidenceScore: number) {
  const volatility = standardDeviation(values);
  const baseBand = Math.max(predicted * 0.06, volatility * 0.9, 150);
  const multiplier = confidenceScore >= 75 ? 0.7 : confidenceScore >= 50 ? 1 : 1.25;
  return Math.max(100, baseBand * multiplier);
}

function confidenceNotesForPoints(input: {
  points: MLOpsForecastPoint[];
  cadenceLabel: string;
  irregular: boolean;
  slope: number;
  confidenceScore: number;
}) {
  const notes: string[] = [];

  if (input.points.length < 6) {
    notes.push("History is short, so this is a directional forecast rather than a statistically strong one.");
  }

  if (input.irregular) {
    notes.push(`Input cadence is uneven, so the model uses a ${input.cadenceLabel} step size.`);
  }

  const values = input.points.map((point) => point.revenue);
  const volatility = values.length > 1 && mean(values) > 0 ? standardDeviation(values) / mean(values) : 0;

  if (volatility >= 0.35) {
    notes.push("Revenue volatility is high, so the forecast band is intentionally wider.");
  }

  if (input.slope > 0) {
    notes.push("The underlying trend is upward across the uploaded history.");
  } else if (input.slope < 0) {
    notes.push("The underlying trend is downward across the uploaded history.");
  } else {
    notes.push("The trend is essentially flat across the uploaded history.");
  }

  if (input.confidenceScore >= 75) {
    notes.push("Confidence is solid enough for planning, but not for automatic decision-making.");
  } else if (input.confidenceScore >= 50) {
    notes.push("Confidence is moderate; use the forecast for planning and sanity checks.");
  } else {
    notes.push("Confidence is low; treat the numbers as a rough starting point only.");
  }

  return notes.slice(0, 4);
}

function buildSummaryText(input: {
  observations: number;
  startDateISO: string;
  endDateISO: string;
  cadenceLabel: string;
  averageRevenue: number;
  trendPerPeriod: number;
  confidenceLabel: "high" | "medium" | "low";
}) {
  const direction =
    input.trendPerPeriod > 0 ? "up" : input.trendPerPeriod < 0 ? "down" : "flat";

  return [
    `Based on ${input.observations} points from ${input.startDateISO} to ${input.endDateISO}, the series is moving ${direction} on a ${input.cadenceLabel} cadence.`,
    `Average revenue is ${formatUsd(input.averageRevenue)} per period, and the deterministic trend is ${formatUsd(Math.abs(input.trendPerPeriod))} ${direction === "flat" ? "per period" : `per ${input.cadenceLabel.replace(/\s.*$/, "")}`}.`,
    `Confidence is ${input.confidenceLabel}, so this is a planning baseline rather than a promise.`,
  ].join(" ");
}

export function buildDemoRevenueSeries() {
  return DEMO_REVENUE_SERIES.map((point) => ({ ...point }));
}

export function buildDemoRevenueCsv() {
  const rows = [["date", "revenue"], ...DEMO_REVENUE_SERIES.map((point) => [point.dateISO, String(point.revenue)])];
  return rows.map((row) => row.join(",")).join("\n");
}

export function parseRevenueCsvRows(text: string) {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);

  return parseRows(rows);
}

export function buildRevenueForecastFromPoints(
  points: MLOpsForecastPoint[],
  context: RevenueForecastContext,
): MLOpsForecastRun {
  const normalizedPoints = [...points]
    .map((point) => ({
      dateISO: point.dateISO,
      revenue: Number.isFinite(point.revenue) ? point.revenue : 0,
    }))
    .sort((left, right) => left.dateISO.localeCompare(right.dateISO));

  if (normalizedPoints.length === 0) {
    throw new Error("No revenue points were found.");
  }

  const revenueValues = normalizedPoints.map((point) => point.revenue);
  const { slope, intercept } = linearRegression(revenueValues);
  const cadence = cadenceForPoints(normalizedPoints);
  const averageRevenue = mean(revenueValues);
  const totalRevenue = revenueValues.reduce((total, value) => total + value, 0);
  const lastRevenue = revenueValues[revenueValues.length - 1] ?? 0;
  const confidenceScoreBase = Math.min(100, Math.round(
    Math.min(30, normalizedPoints.length * 3) +
      (cadence.irregular ? 8 : 18) +
      (normalizedPoints.length >= 8 ? 16 : normalizedPoints.length >= 5 ? 12 : 6) +
      (averageRevenue > 0 ? Math.max(0, 18 - Math.min(18, standardDeviation(revenueValues) / Math.max(1, averageRevenue) * 35)) : 0),
  ));
  const confidenceScore = Math.max(18, confidenceScoreBase);
  const confidenceLabel: MLOpsForecastRun["confidenceLabel"] =
    confidenceScore >= 75 ? "high" : confidenceScore >= 50 ? "medium" : "low";
  const confidenceNotes = confidenceNotesForPoints({
    points: normalizedPoints,
    cadenceLabel: cadence.label,
    irregular: cadence.irregular,
    slope,
    confidenceScore,
  });

  const startDateISO = normalizedPoints[0]?.dateISO ?? "1970-01-01";
  const endDateISO = normalizedPoints[normalizedPoints.length - 1]?.dateISO ?? startDateISO;
  const lastDate = toUtcDate(endDateISO);
  const forecastRows: MLOpsForecastRow[] = [];
  const variance = standardDeviation(revenueValues);

  for (let index = 1; index <= 6; index += 1) {
    const predictedRevenue = Math.max(0, Math.round(intercept + slope * (revenueValues.length - 1 + index)));
    const band = confidenceBand(revenueValues, predictedRevenue, confidenceScore);
    const forecastDate = new Date(lastDate.getTime() + cadence.stepDays * index * 24 * 60 * 60 * 1000);

    forecastRows.push({
      dateISO: toDateISO(forecastDate),
      predictedRevenue,
      lowerBoundRevenue: Math.max(0, Math.round(predictedRevenue - band - variance * 0.15)),
      upperBoundRevenue: Math.max(predictedRevenue, Math.round(predictedRevenue + band + variance * 0.15)),
    });
  }

  return {
    sourceType: context.sourceType,
    sourceName: context.sourceName,
    observations: normalizedPoints.length,
    startDateISO,
    endDateISO,
    cadenceLabel: cadence.label,
    averageRevenue: Math.round(averageRevenue),
    lastRevenue: Math.round(lastRevenue),
    totalRevenue: Math.round(totalRevenue),
    trendPerPeriod: Math.round(slope),
    confidenceScore,
    confidenceLabel,
    summary: buildSummaryText({
      observations: normalizedPoints.length,
      startDateISO,
      endDateISO,
      cadenceLabel: cadence.label,
      averageRevenue,
      trendPerPeriod: slope,
      confidenceLabel,
    }),
    confidenceNotes,
    forecastRows,
  };
}

export function buildRevenueForecastFromRows(rows: WorkbookSheetRows[], sourceName: string, sourceType: MLOpsForecastSourceType) {
  const points = rows.flatMap((sheet) => parseRows(sheet.rows));

  if (points.length === 0) {
    throw new Error("No revenue points were found.");
  }

  return buildRevenueForecastFromPoints(points, {
    sourceName,
    sourceType,
  });
}
