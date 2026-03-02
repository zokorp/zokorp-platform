"use client";

import Link from "next/link";
import { useState } from "react";

type ValidatorResponse = {
  output: string;
  meta?: Record<string, unknown>;
  remainingUses?: number;
  error?: string;
};

type ValidatorFormProps = {
  requiresAuth?: boolean;
  authUnavailable?: boolean;
};

export function ValidatorForm({ requiresAuth = false, authUnavailable = false }: ValidatorFormProps) {
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

      if (!response.ok && response.status === 401) {
        setResult({ output: "", error: "Please sign in before running ZoKorpValidator." });
        return;
      }

      if (!response.ok && response.status === 402) {
        setResult({ output: "", error: "Purchase a credit first, then run the validator." });
        return;
      }

      setResult(data);
    } catch {
      setResult({ output: "", error: "Unexpected network error." });
    } finally {
      setIsLoading(false);
    }
  }

  if (authUnavailable) {
    return (
      <section className="surface-muted rounded-xl p-5">
        <h3 className="font-display text-2xl font-semibold text-slate-900">Run ZoKorpValidator</h3>
        <p className="mt-2 text-sm text-slate-700">
          Login must be connected before this tool can process files.
        </p>
      </section>
    );
  }

  if (requiresAuth) {
    return (
      <section className="surface-muted rounded-xl p-5">
        <h3 className="font-display text-2xl font-semibold text-slate-900">Run ZoKorpValidator</h3>
        <p className="mt-2 text-sm text-slate-700">
          Sign in first, then purchase the correct validation credit and upload your file.
        </p>
        <Link
          href="/login?callbackUrl=/software/zokorp-validator"
          className="focus-ring mt-4 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Sign in to continue
        </Link>
      </section>
    );
  }

  return (
    <section className="surface rounded-xl p-5">
      <h3 className="font-display text-2xl font-semibold text-slate-900">Run ZoKorpValidator</h3>
      <p className="mt-2 text-sm text-slate-600">
        Upload one PDF or Excel file (.pdf, .xlsx, .xls). Processing runs server-side with entitlement checks.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input
          name="file"
          type="file"
          accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          required
          className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Processing..." : "Process File"}
        </button>
      </form>

      {result?.error ? <p className="text-sm text-red-600">{result.error}</p> : null}

      {result?.output ? (
        <div className="mt-4 space-y-2 rounded-md bg-slate-50 p-4">
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
