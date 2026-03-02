"use client";

import Link from "next/link";
import { useState } from "react";

import type {
  ValidationCheckStatus,
  ValidationProfile,
  ValidationReport,
} from "@/lib/zokorp-validator-engine";

type ValidatorResponse = {
  output: string;
  meta?: Record<string, unknown>;
  report?: ValidationReport;
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
  const [selectedProfile, setSelectedProfile] = useState<ValidationProfile>("FTR");

  const profileOptions: Array<{
    value: ValidationProfile;
    label: string;
    help: string;
  }> = [
    {
      value: "FTR",
      label: "FTR Review",
      help: "Fast foundational readiness check for architecture, controls, and testing evidence.",
    },
    {
      value: "SDP_SRP",
      label: "SDP/SRP Review",
      help: "Service delivery/process readiness check for operational consistency and support model.",
    },
    {
      value: "COMPETENCY",
      label: "Competency Review",
      help: "Competency evidence check for case studies, capabilities, and operational maturity.",
    },
  ];

  const statusBadgeClass: Record<ValidationCheckStatus, string> = {
    PASS: "border-emerald-300 bg-emerald-50 text-emerald-700",
    PARTIAL: "border-amber-300 bg-amber-50 text-amber-800",
    MISSING: "border-rose-300 bg-rose-50 text-rose-700",
  };

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
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Validation Profile
            </span>
            <select
              name="validationProfile"
              value={selectedProfile}
              onChange={(event) => setSelectedProfile(event.target.value as ValidationProfile)}
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              required
            >
              {profileOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              {profileOptions.find((option) => option.value === selectedProfile)?.help}
            </p>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Optional Context
            </span>
            <textarea
              name="additionalContext"
              maxLength={1200}
              placeholder="Example: Focus on IAM policy evidence and incident response readiness."
              className="focus-ring min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

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

      {result?.report ? (
        <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Validation Report
              </p>
              <h4 className="font-display text-xl font-semibold text-slate-900">
                {result.report.profileLabel} · Score {result.report.score}%
              </h4>
              <p className="mt-1 text-sm text-slate-600">{result.report.summary}</p>
            </div>

            {typeof result.remainingUses === "number" ? (
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Remaining uses: {result.remainingUses}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
              PASS: {result.report.counts.PASS}
            </span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
              PARTIAL: {result.report.counts.PARTIAL}
            </span>
            <span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
              MISSING: {result.report.counts.MISSING}
            </span>
          </div>

          {result.report.topGaps.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Priority Improvements
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-900">
                {result.report.topGaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            {result.report.checks.map((check) => (
              <article key={check.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-slate-900">{check.title}</h5>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass[check.status]}`}>
                    {check.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{check.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Matched keywords: {check.hitKeywords.length ? check.hitKeywords.join(", ") : "none"}
                </p>
                {check.evidence ? (
                  <p className="mt-2 text-xs text-slate-600">Evidence: {check.evidence}</p>
                ) : null}
              </article>
            ))}
          </div>

          <details className="rounded-md border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              View raw output
            </summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
              {result.output}
            </pre>
          </details>
        </div>
      ) : result?.output ? (
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
