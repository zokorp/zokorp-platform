"use client";

import { useState } from "react";

type ValidatorResponse = {
  output: string;
  meta?: Record<string, unknown>;
  remainingUses?: number;
  error?: string;
};

export function ValidatorForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidatorResponse | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/tools/zokorp-validator", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ValidatorResponse;
      setResult(data);
    } catch {
      setResult({ output: "", error: "Unexpected network error." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="text-lg font-semibold text-slate-900">Run ZoKorpValidator</h3>
      <p className="text-sm text-slate-600">
        Upload one PDF or Excel file (.pdf, .xlsx, .xls). Processing runs server-side with entitlement checks.
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          name="file"
          type="file"
          accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          required
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Processing..." : "Process File"}
        </button>
      </form>

      {result?.error ? <p className="text-sm text-red-600">{result.error}</p> : null}

      {result?.output ? (
        <div className="space-y-2 rounded-md bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Output</p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-sm text-slate-700">{result.output}</pre>
          {typeof result.remainingUses === "number" ? (
            <p className="text-xs text-slate-500">Remaining uses: {result.remainingUses}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
