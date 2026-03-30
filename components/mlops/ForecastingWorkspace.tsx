"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  buildDemoRevenueSeries,
  buildRevenueForecastFromPoints,
  buildDemoRevenueCsv,
  type MLOpsForecastRun,
} from "@/lib/mlops-forecast";

type ForecastingWorkspaceProps = {
  signedIn: boolean;
  currentEmail: string | null;
  hasAccess: boolean;
};

type ApiResponse = MLOpsForecastRun & {
  auditId?: string;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function confidenceVariant(score: number) {
  if (score >= 75) {
    return "success";
  }

  if (score >= 50) {
    return "info";
  }

  return "warning";
}

export function ForecastingWorkspace({ signedIn, currentEmail, hasAccess }: ForecastingWorkspaceProps) {
  const demoPreview = useMemo(
    () =>
      buildRevenueForecastFromPoints(buildDemoRevenueSeries(), {
        sourceType: "demo",
        sourceName: "Demo revenue series",
      }),
    [],
  );

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<"upload" | "demo">("upload");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayResult = result ?? demoPreview;
  const showLockedState = !signedIn || !hasAccess;

  async function submitForecast(nextMode: "upload" | "demo") {
    setError(null);
    setMode(nextMode);

    if (nextMode === "upload" && !selectedFile) {
      setError("Choose a CSV or XLSX file first.");
      return;
    }

    setIsRunning(true);

    try {
      const formData = new FormData();
      formData.set("runMode", nextMode);

      if (nextMode === "upload" && selectedFile) {
        formData.set("file", selectedFile);
      }

      const response = await fetch("/api/tools/mlops-forecast", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as Partial<ApiResponse> & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Forecast request failed.");
        return;
      }

      setResult(data as ApiResponse);
    } catch {
      setError("Unexpected network error.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="animate-fade-up rounded-[calc(var(--radius-xl)+0.25rem)] p-6 md:p-7">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Forecasting Workspace</p>
              <h1 className="font-display mt-1 text-4xl font-semibold text-slate-900">
                Upload revenue data and get a simple deterministic forecast
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                Start with a CSV or XLSX upload, then get a straight-line forecast, confidence notes, and a compact
                planning view you can use without pretending the model is smarter than the data.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="brand">Upload-first</Badge>
              <Badge variant="secondary">Revenue forecasting</Badge>
              <Badge variant={confidenceVariant(displayResult.confidenceScore)}>
                Confidence {displayResult.confidenceScore}%
              </Badge>
            </div>
          </div>

          <div className="grid gap-2 text-sm text-slate-600 md:max-w-sm">
            <div className="rounded-2xl border border-border bg-slate-50/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Current access</p>
              <p className="mt-2 font-semibold text-slate-900">
                {showLockedState ? "Subscription required" : "Active subscription"}
              </p>
              <p className="mt-1 text-sm">
                {showLockedState
                  ? "Sign in and subscribe to run real forecasts."
                  : `Signed in as ${currentEmail ?? "your business email"}.`}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
          <div className="space-y-4">
            <Card tone="muted" className="rounded-3xl p-5">
              <CardHeader className="gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What to upload</p>
                <h2 className="font-display text-2xl font-semibold text-slate-900">CSV or Excel revenue history</h2>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                <p>
                  Include a date column and a revenue/value column. The parser looks for the first useful date and
                  amount columns automatically.
                </p>
                <ul className="space-y-1">
                  <li>Accepted formats: `.csv` and `.xlsx`</li>
                  <li>Best columns: `date`, `revenue`, `value`, `amount`, or similar</li>
                  <li>Output: 6-step forecast with ranges and confidence notes</li>
                </ul>
              </CardContent>
            </Card>

            {showLockedState ? (
              <Alert tone="warning">
                <AlertTitle>Subscription required</AlertTitle>
                <AlertDescription>
                  This workspace is wired for paid customer use. Subscribe first, then run the live forecast and keep
                  the output in your account history.
                </AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert tone="danger">
                <AlertTitle>Forecast failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Upload file</span>
              <input
                id="mlops-forecast-file"
                aria-label="Upload forecast data"
                name="file"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={showLockedState || isRunning}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  setMode("upload");
                  setError(null);
                }}
              />
              <label
                htmlFor="mlops-forecast-file"
                className={cn(
                  "focus-ring flex cursor-pointer items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition hover:border-slate-300",
                  showLockedState && "cursor-not-allowed opacity-75",
                  !selectedFile && "text-slate-500",
                )}
              >
                <span className="truncate">{selectedFile?.name ?? "No file selected yet"}</span>
                <span className="rounded-xl border border-border bg-background-elevated px-3 py-1.5 text-xs font-semibold text-slate-800">
                  Choose File
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" loading={isRunning} disabled={showLockedState} onClick={() => void submitForecast("upload")}>
                {isRunning && mode === "upload" ? "Running forecast..." : "Run forecast"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={showLockedState || isRunning}
                onClick={() => void submitForecast("demo")}
              >
                {isRunning && mode === "demo" ? "Loading demo..." : "Run demo forecast"}
              </Button>
              <Link href="/account" className={buttonVariants({ variant: "secondary" })}>
                Open account
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <Card tone="glass" className="rounded-3xl p-5">
              <CardHeader className="gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Preview</p>
                <h2 className="font-display text-2xl font-semibold text-slate-900">Demo forecast snapshot</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">{displayResult.summary}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span>Confidence</span>
                    <span>{displayResult.confidenceLabel}</span>
                  </div>
                  <Progress value={displayResult.confidenceScore} />
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Average revenue</p>
                    <p className="mt-2 font-display text-2xl font-semibold text-slate-900">
                      {formatUsd(displayResult.averageRevenue)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Last actual</p>
                    <p className="mt-2 font-display text-2xl font-semibold text-slate-900">
                      {formatUsd(displayResult.lastRevenue)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Trend</p>
                    <p className="mt-2 font-display text-2xl font-semibold text-slate-900">
                      {formatUsd(Math.abs(displayResult.trendPerPeriod))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl p-5">
              <CardHeader className="gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Built-in demo</p>
                <h3 className="font-display text-2xl font-semibold text-slate-900">Revenue growth example</h3>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                <p>
                  Use the demo to see the output shape before you upload your own data. The demo dataset is the same
                  one used in the client-side preview.
                </p>
                <div className="rounded-2xl border border-border bg-slate-50 p-4 font-mono text-xs text-slate-700">
                  <pre className="whitespace-pre-wrap">{buildDemoRevenueCsv()}</pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6 md:p-7">
        <CardHeader className="gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resulting forecast</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">What the customer sees after a run</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Observations</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900">{displayResult.observations}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Cadence</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900">{displayResult.cadenceLabel}</p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">History value</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900">
                {formatUsd(displayResult.totalRevenue)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-white p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Source</p>
              <p className="mt-2 font-display text-2xl font-semibold text-slate-900">{displayResult.sourceType}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">Confidence notes</p>
            <div className="grid gap-2">
              {displayResult.confidenceNotes.map((note) => (
                <div key={note} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border">
            <table className="min-w-full divide-y divide-border bg-white">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Forecast date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Expected revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Low</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">High</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayResult.forecastRows.map((row) => (
                  <tr key={row.dateISO}>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{row.dateISO}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatUsd(row.predictedRevenue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatUsd(row.lowerBoundRevenue)}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{formatUsd(row.upperBoundRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center gap-3">
          <Link href="/account" className={buttonVariants()}>
            View account activity
          </Link>
          <p className="text-sm text-slate-500">
            Runs are logged for account activity and audit review when you use the live workspace.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
