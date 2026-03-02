"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  ValidationCheckStatus,
  ValidationProfile,
  ValidationReport,
  ValidationTargetOption,
} from "@/lib/zokorp-validator-engine";

type ValidatorResponse = {
  output: string;
  meta?: Record<string, unknown>;
  report?: ValidationReport;
  reviewedWorkbookBase64?: string;
  reviewedWorkbookFileName?: string;
  reviewedWorkbookMimeType?: string;
  remainingUses?: number;
  error?: string;
};

type ValidatorFormProps = {
  requiresAuth?: boolean;
  authUnavailable?: boolean;
  validationTargets?: ValidationTargetOption[];
};

const profileOptions: Array<{
  value: ValidationProfile;
  label: string;
  help: string;
}> = [
  {
    value: "FTR",
    label: "FTR Review",
    help: "Foundational readiness review for architecture, controls, testing, and risk evidence.",
  },
  {
    value: "SDP_SRP",
    label: "SDP/SRP Review",
    help: "Service/software readiness check for delivery operations, support, and controls.",
  },
  {
    value: "COMPETENCY",
    label: "Competency Review",
    help: "Competency evidence check for references, capabilities, staffing, and operational maturity.",
  },
];

export function ValidatorForm({
  requiresAuth = false,
  authUnavailable = false,
  validationTargets = [],
}: ValidatorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidatorResponse | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ValidationProfile>("FTR");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [targetSearch, setTargetSearch] = useState("");

  const statusBadgeClass: Record<ValidationCheckStatus, string> = {
    PASS: "border-emerald-300 bg-emerald-50 text-emerald-700",
    PARTIAL: "border-amber-300 bg-amber-50 text-amber-800",
    MISSING: "border-rose-300 bg-rose-50 text-rose-700",
  };

  const targetsByProfile = useMemo(() => {
    const grouped: Record<ValidationProfile, ValidationTargetOption[]> = {
      FTR: [],
      SDP_SRP: [],
      COMPETENCY: [],
    };

    for (const target of validationTargets) {
      grouped[target.profile].push(target);
    }

    return grouped;
  }, [validationTargets]);

  const activeTargets = targetsByProfile[selectedProfile];
  const selectedTarget = activeTargets.find((target) => target.id === selectedTargetId);
  const filteredTargets = useMemo(() => {
    if (!targetSearch.trim()) {
      return activeTargets;
    }

    const q = targetSearch.trim().toLowerCase();
    return activeTargets.filter((target) => {
      const haystack = `${target.label} ${target.domain ?? ""} ${target.partnerTypePath ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeTargets, targetSearch]);

  useEffect(() => {
    if (activeTargets.length === 0) {
      setSelectedTargetId("");
      setTargetSearch("");
      return;
    }

    const currentStillValid = activeTargets.some((target) => target.id === selectedTargetId);
    if (!currentStillValid) {
      setSelectedTargetId(activeTargets[0].id);
    }
  }, [activeTargets, selectedTargetId, selectedProfile]);

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

      if (!response.ok) {
        setResult({ output: "", error: data.error ?? "Validation request failed." });
        return;
      }

      setResult(data);
    } catch {
      setResult({ output: "", error: "Unexpected network error." });
    } finally {
      setIsLoading(false);
    }
  }

  function downloadReviewedWorkbook() {
    if (!result?.reviewedWorkbookBase64 || !result.reviewedWorkbookFileName) {
      return;
    }

    const binary = window.atob(result.reviewedWorkbookBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], {
      type:
        result.reviewedWorkbookMimeType ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.reviewedWorkbookFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
      <p className="mt-1 text-xs text-slate-500">
        Sensitive values like emails, phone numbers, and long account-like numbers are redacted before scoring output.
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
              onChange={(event) => {
                setSelectedProfile(event.target.value as ValidationProfile);
                setTargetSearch("");
              }}
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

        {activeTargets.length > 0 ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Checklist Target
            </span>
            {activeTargets.length > 12 ? (
              <input
                value={targetSearch}
                onChange={(event) => setTargetSearch(event.target.value)}
                placeholder="Filter checklist targets by name/domain"
                className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            ) : null}
            <select
              name="validationTargetId"
              value={selectedTargetId}
              onChange={(event) => setSelectedTargetId(event.target.value)}
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              required
            >
              {filteredTargets.length > 0 ? (
                filteredTargets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))
              ) : (
                <option value={selectedTargetId}>No matching target in current filter</option>
              )}
            </select>
            <p className="text-xs text-slate-500">
              Select the exact checklist type you are validating against.
              {targetSearch.trim() ? ` Showing ${filteredTargets.length} of ${activeTargets.length} targets.` : ""}
            </p>
            {targetSearch.trim() && filteredTargets.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No checklist targets match this filter. Clear the filter to see all options.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Checklist library targets are not loaded yet. The validator will use generic profile rules.
          </p>
        )}

        {selectedTarget ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>
              Target scope: <span className="font-semibold text-slate-800">{selectedTarget.label}</span>
              {selectedTarget.domain ? ` (${selectedTarget.domain})` : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-3">
              {selectedTarget.checklistUrl ? (
                <a
                  href={selectedTarget.checklistUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
                >
                  Checklist reference
                </a>
              ) : null}
              {selectedTarget.calibrationGuideUrl ? (
                <a
                  href={selectedTarget.calibrationGuideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-slate-400 underline-offset-2 hover:text-slate-900"
                >
                  Calibration guide
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

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

      {result?.error ? <p className="mt-3 text-sm text-red-600">{result.error}</p> : null}

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
              {result.report.target ? (
                <div className="mt-1 text-xs text-slate-500">
                  <p>Checklist target: {result.report.target.label}</p>
                  {result.report.rulepack ? (
                    <p>
                      Rulepack: {result.report.rulepack.id} (v{result.report.rulepack.version}) ·{" "}
                      {result.report.rulepack.ruleCount} checks
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            {typeof result.remainingUses === "number" ? (
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                Remaining uses: {result.remainingUses}
              </span>
            ) : null}
          </div>

          {result.reviewedWorkbookBase64 && result.reviewedWorkbookFileName ? (
            <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-900">
                Reviewed workbook is ready with row-level status/recommendations.
              </p>
              <button
                type="button"
                onClick={downloadReviewedWorkbook}
                className="focus-ring rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800"
              >
                Download Reviewed Excel
              </button>
            </div>
          ) : null}

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

          {result.report.processingNotes.length > 0 ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                Processing Notes
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-sky-900">
                {result.report.processingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.report.controlCalibration ? (
            <div className="space-y-3 rounded-md border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Control-by-Control Calibration
                </p>
                <p className="text-xs text-slate-500">
                  {result.report.controlCalibration.totalControls} controls analyzed
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  PASS: {result.report.controlCalibration.counts.PASS}
                </span>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                  PARTIAL: {result.report.controlCalibration.counts.PARTIAL}
                </span>
                <span className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                  MISSING: {result.report.controlCalibration.counts.MISSING}
                </span>
              </div>

              <div className="max-h-96 space-y-2 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
                {result.report.controlCalibration.controls.map((control) => (
                  <article key={`${control.sheetName}-${control.rowNumber}-${control.controlId}`} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {control.controlId} · {control.sheetName} row {control.rowNumber}
                      </p>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass[control.status]}`}>
                        {control.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Confidence: {control.confidence}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-semibold">Requirement:</span> {control.requirement}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-semibold">Current response:</span> {control.response || "No response provided."}
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      <span className="font-semibold">Recommendation:</span> {control.recommendation || "No recommendation."}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Missing signals: {control.missingSignals.length ? control.missingSignals.join(", ") : "none"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Suggested edit (no new facts): {control.suggestedEdit}
                    </p>
                  </article>
                ))}
              </div>
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
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Severity: {check.severity} · Weight: {check.weight.toFixed(1)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Matched keywords: {check.hitKeywords.length ? check.hitKeywords.join(", ") : "none"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Matched patterns: {check.hitPatterns.length ? check.hitPatterns.join(", ") : "none"}
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
