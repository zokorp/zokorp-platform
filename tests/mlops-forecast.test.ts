import { describe, expect, it } from "vitest";

import {
  buildDemoRevenueCsv,
  buildDemoRevenueSeries,
  buildRevenueForecastFromPoints,
  buildRevenueForecastFromRows,
  parseRevenueCsvRows,
} from "@/lib/mlops-forecast";

describe("mlops forecast helpers", () => {
  it("builds a deterministic forecast from the bundled demo series", () => {
    const series = buildDemoRevenueSeries();
    const forecast = buildRevenueForecastFromPoints(series, {
      sourceName: "Demo revenue series",
      sourceType: "demo",
    });

    expect(forecast.sourceType).toBe("demo");
    expect(forecast.observations).toBe(series.length);
    expect(forecast.forecastRows).toHaveLength(6);
    expect(forecast.summary).toContain("Based on");
    expect(forecast.confidenceNotes.length).toBeGreaterThan(0);
  });

  it("parses CSV rows with date and revenue columns", () => {
    const parsed = parseRevenueCsvRows([
      "date,revenue",
      "2026-01-01,100",
      "2026-02-01,150",
      "2026-03-01,175",
    ].join("\n"));

    expect(parsed).toEqual([
      { dateISO: "2026-01-01", revenue: 100 },
      { dateISO: "2026-02-01", revenue: 150 },
      { dateISO: "2026-03-01", revenue: 175 },
    ]);
  });

  it("builds a forecast from workbook-style sheet rows", () => {
    const forecast = buildRevenueForecastFromRows(
      [
        {
          name: "Revenue",
          rows: [
            ["date", "value"],
            ["2026-01-01", "1000"],
            ["2026-02-01", "1200"],
            ["2026-03-01", "1350"],
          ],
        },
      ],
      "forecast.xlsx",
      "xlsx",
    );

    expect(forecast.sourceName).toBe("forecast.xlsx");
    expect(forecast.sourceType).toBe("xlsx");
    expect(forecast.forecastRows).toHaveLength(6);
    expect(forecast.totalRevenue).toBe(3550);
  });

  it("exposes the demo CSV used by the workspace", () => {
    const csv = buildDemoRevenueCsv();

    expect(csv).toContain("date,revenue");
    expect(csv.split("\n")).toHaveLength(buildDemoRevenueSeries().length + 1);
  });
});
