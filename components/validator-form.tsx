"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  profileCredits?: Record<ValidationProfile, number>;
};

const profileOptions: Array<{
  value: ValidationProfile;
  label: string;
  help: string;
}> = [
  {
    value: "FTR",
    label: "Foundational Technical Review (FTR)",
    help: "Foundational readiness review for either a service offering or software offering submission.",
  },
  {
    value: "SDP",
    label: "Service Delivery Program (SDP)",
    help: "Service-delivery readiness check for repeatability, support, and operational controls.",
  },
  {
    value: "SRP",
    label: "Service Ready Program (SRP)",
    help: "Service/software readiness check for release quality, support model, and control evidence.",
  },
  {
    value: "COMPETENCY",
    label: "Competency",
    help: "Competency evidence check for references, capabilities, staffing, and operational maturity.",
  },
];

function statusVariant(status: ValidationCheckStatus): "success" | "warning" | "danger" {
  switch (status) {
    case "PASS":
      return "success";
    case "PARTIAL":
      return "warning";
    case "MISSING":
      return "danger";
  }
}

export function ValidatorForm({
  requiresAuth = false,
  authUnavailable = false,
  validationTargets = [],
  profileCredits = { FTR: 0, SDP: 0, SRP: 0, COMPETENCY: 0 },
}: ValidatorFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ValidatorResponse | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ValidationProfile>("FTR");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [targetSearch, setTargetSearch] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  const targetsByProfile = useMemo(() => {
    const grouped: Record<ValidationProfile, ValidationTargetOption[]> = {
      FTR: [],
      SDP: [],
      SRP: [],
      COMPETENCY: [],
    };

    for (const target of validationTargets) {
      grouped[target.profile].push(target);
    }

    return grouped;
  }, [validationTargets]);

  const activeTargets = targetsByProfile[selectedProfile];

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

    if (!activeTargets.some((target) => target.id === selectedTargetId)) {
      setSelectedTargetId(activeTargets[0].id);
    }
  }, [activeTargets, selectedTargetId]);

  const selectedProfileCredits = profileCredits[selectedProfile] ?? 0;
  const submitDisabledReason =
    selectedProfileCredits > 0
      ? undefined
      : "No credits available for this review type. Purchase that tier, then retry.";

  const canSubmitNow =
    selectedProfileCredits > 0 &&
    Boolean(selectedTargetId) &&
    filteredTargets.length > 0 &&
    Boolean(selectedFileName) &&
    !isLoading;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedProfileCredits <= 0) {
      setResult({
        output: "",
        error: submitDisabledReason ?? "Purchase a credit first, then run the validator.",
      });
      return;
    }

    if (!selectedTargetId || filteredTargets.length === 0) {
      setResult({ output: "", error: "Select a checklist target before submitting." });
      return;
    }

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
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
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

  const downloadLabel =
    result?.reviewedWorkbookMimeType?.toLowerCase().includes("csv")
      ? "Download Edit Guide (CSV)"
      : "Download Reviewed Excel";

  const report = result?.report ?? null;
  const hasReviewedWorkbook = Boolean(result?.reviewedWorkbookBase64 && result?.reviewedWorkbookFileName);
  const remainingUses = result?.remainingUses;
  const rawOutput = result?.output ?? "";
  const actionableChecks = report?.checks.filter((check) => check.status !== "PASS") ?? [];
  const calibrationControls = report?.controlCalibration?.controls ?? [];

  if (authUnavailable) {
    return (
      <Card tone="muted" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Validator Access</p>
          <h3 className="font-display text-2xl font-semibold text-slate-900">Run ZoKorpValidator</h3>
        </CardHeader>
        <CardContent>
          <Alert tone="warning">
            <AlertTitle>Authentication required</AlertTitle>
            <AlertDescription>Login must be connected before this tool can process files.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (requiresAuth) {
    return (
      <Card tone="muted" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Validator Access</p>
          <h3 className="font-display text-2xl font-semibold text-slate-900">Run ZoKorpValidator</h3>
        </CardHeader>
        <CardContent>
          <Alert tone="info">
            <AlertTitle>Sign in first</AlertTitle>
            <AlertDescription>
              Sign in first, then purchase the correct validation credit and upload your file.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Link href="/login?callbackUrl=/software/zokorp-validator" className={buttonVariants()}>
            Sign in to continue
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="animate-fade-up rounded-[calc(var(--radius-xl)+0.25rem)] p-5 md:p-6">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Validation Workflow</p>
              <h3 className="font-display text-3xl font-semibold text-slate-900">Run ZoKorpValidator</h3>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Upload one PDF or Excel file (.pdf, .xlsx). Processing runs server-side with entitlement checks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Selected credits: {selectedProfileCredits}</Badge>
              <Badge variant="outline">FTR {profileCredits.FTR}</Badge>
              <Badge variant="outline">SDP {profileCredits.SDP}</Badge>
              <Badge variant="outline">SRP {profileCredits.SRP}</Badge>
              <Badge variant="outline">Competency {profileCredits.COMPETENCY}</Badge>
            </div>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Sensitive values like emails, phone numbers, and long account-like numbers are redacted before scoring output.
            Each run uses 1 credit from the selected profile wallet.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Validation Profile
                </span>
                <Select
                  name="validationProfile"
                  value={selectedProfile}
                  onChange={(event) => {
                    setSelectedProfile(event.target.value as ValidationProfile);
                    setTargetSearch("");
                  }}
                  required
                >
                  {profileOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <p className="text-xs leading-5 text-slate-500">
                  {profileOptions.find((option) => option.value === selectedProfile)?.help}
                </p>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Optional Context
                </span>
                <Textarea
                  name="additionalContext"
                  maxLength={1200}
                  className="min-h-28"
                  placeholder="Examples: “Service Offering FTR for AI advisory with 3 consultants and a fixed 6-week scope.” “Prioritize IAM least privilege, evidence references, and owner accountability.” “Flag controls missing measurable outcomes or review dates.”"
                />
                <p className="text-xs leading-5 text-slate-500">
                  Optional. Add review priorities like control ownership, test evidence quality, risk mitigations, or approval traceability.
                </p>
              </label>
            </div>

            {activeTargets.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Checklist Target
                  </span>
                  <Badge variant="secondary">
                    {filteredTargets.length} of {activeTargets.length} available
                  </Badge>
                </div>

                {activeTargets.length > 12 ? (
                  <Input
                    value={targetSearch}
                    onChange={(event) => setTargetSearch(event.target.value)}
                    placeholder="Filter checklist targets by name or domain"
                  />
                ) : null}

                <Select
                  name="validationTargetId"
                  value={selectedTargetId}
                  onChange={(event) => setSelectedTargetId(event.target.value)}
                  required
                >
                  {filteredTargets.length > 0 ? (
                    filteredTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.label}
                      </option>
                    ))
                  ) : (
                    <option value="">No matching target in current filter</option>
                  )}
                </Select>

                <p className="text-xs leading-5 text-slate-500">
                  Select the exact checklist type you are validating against.
                  {targetSearch.trim() ? ` Showing ${filteredTargets.length} of ${activeTargets.length} targets.` : ""}
                </p>

                {targetSearch.trim() && filteredTargets.length === 0 ? (
                  <Alert tone="warning">
                    <AlertTitle>No matching targets</AlertTitle>
                    <AlertDescription>
                      Clear the current filter to see the full checklist target list for this profile.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : (
              <Alert tone="warning">
                <AlertTitle>Checklist targets unavailable</AlertTitle>
                <AlertDescription>
                  Checklist targets are unavailable for this profile right now.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Upload Checklist</span>
              <input
                id="validator-file"
                aria-label="Upload checklist"
                name="file"
                type="file"
                accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setSelectedFileName(file?.name ?? "");
                }}
              />
              <label
                htmlFor="validator-file"
                className={cn(
                  "focus-ring flex cursor-pointer items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm shadow-[var(--shadow-soft)] transition hover:border-slate-300",
                  !selectedFileName && "text-slate-500",
                )}
              >
                <span className="truncate">{selectedFileName || "No file selected yet"}</span>
                <span className="rounded-xl border border-border bg-background-elevated px-3 py-1.5 text-xs font-semibold text-slate-800">
                  Choose File
                </span>
              </label>
            </div>

            {selectedProfileCredits <= 0 ? (
              <Alert tone="warning">
                <AlertTitle>No credits available</AlertTitle>
                <AlertDescription>
                  {submitDisabledReason ?? "Purchase a credit first, then run the validator."}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={isLoading} disabled={!canSubmitNow}>
                {isLoading ? "Processing..." : "Process File"}
              </Button>
              <p className="text-xs text-slate-500">Results stay on this page and include downloadable edit guidance when available.</p>
            </div>
          </form>
        </CardContent>
      </Card>

      {result?.error ? (
        <Alert tone="danger">
          <AlertTitle>Validation failed</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      ) : null}

      {report ? (
        <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5 md:p-6">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Validation Report</p>
                <h4 className="font-display text-3xl font-semibold text-slate-900">
                  {report.profileLabel} · Score {report.score}%
                </h4>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">{report.summary}</p>
                {report.target ? (
                  <div className="text-xs leading-5 text-slate-500">
                    <p>Checklist target: {report.target.label}</p>
                    <p>
                      Rulepack: {report.rulepack.id} (v{report.rulepack.version}) · {report.rulepack.ruleCount} checks
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="brand">Score {report.score}%</Badge>
                {typeof remainingUses === "number" ? (
                  <Badge variant="secondary">Remaining uses: {remainingUses}</Badge>
                ) : null}
                <Badge variant="success">PASS {report.counts.PASS}</Badge>
                <Badge variant="warning">PARTIAL {report.counts.PARTIAL}</Badge>
                <Badge variant="danger">MISSING {report.counts.MISSING}</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {hasReviewedWorkbook ? (
              <Alert tone="success">
                <AlertTitle>Reviewed workbook ready</AlertTitle>
                <AlertDescription>
                  Download the edit guide and copy suggested values into the original checklist&apos;s Partner Response cells.
                </AlertDescription>
                <div className="mt-3">
                  <Button type="button" variant="secondary" onClick={downloadReviewedWorkbook}>
                    {downloadLabel}
                  </Button>
                </div>
              </Alert>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Source</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{report.documentMetrics.sourceType}</p>
                <p className="mt-1 text-xs text-slate-500">{report.documentMetrics.filename}</p>
              </div>
              <div className="rounded-2xl border border-border bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Document size</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {report.documentMetrics.wordCount.toLocaleString()} words
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.documentMetrics.characterCount.toLocaleString()} characters
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-white/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Control review</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {report.controlCalibration ? `${report.controlCalibration.totalControls} controls` : "Not available"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {report.controlCalibration ? "Row-level calibration included" : "High-level checklist scoring only"}
                </p>
              </div>
            </div>

            <Tabs defaultValue="recommendations" className="space-y-4">
              <TabsList className="w-full justify-start" aria-label="Validator report sections">
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
                <TabsTrigger value="calibration">Calibration</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>

              <TabsContent value="recommendations" className="space-y-4">
                {report.topGaps.length > 0 ? (
                  <Card className="rounded-3xl p-5">
                    <CardHeader>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Priority Improvements</p>
                      <h5 className="font-display text-2xl font-semibold text-slate-900">What to fix first</h5>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3 text-sm text-slate-700">
                        {report.topGaps.map((gap) => (
                          <li key={gap} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 leading-6 text-amber-900">
                            {gap}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : (
                  <Alert tone="neutral">
                    <AlertTitle>No priority gaps surfaced</AlertTitle>
                    <AlertDescription>
                      The validator did not identify high-priority checklist issues in this run.
                    </AlertDescription>
                  </Alert>
                )}

                <Card className="rounded-3xl p-5">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Check Findings</p>
                    <h5 className="font-display text-2xl font-semibold text-slate-900">Non-pass checklist checks</h5>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {actionableChecks.length > 0 ? (
                      actionableChecks.map((check) => (
                        <article key={check.id} className="rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow-soft)]">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">{check.title}</p>
                              <p className="text-sm leading-6 text-slate-600">{check.description}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={statusVariant(check.status)}>{check.status}</Badge>
                              <Badge variant="secondary">{check.severity}</Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            <span className="font-semibold">Guidance:</span> {check.guidance}
                          </p>
                          {check.evidence ? (
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                              <span className="font-semibold text-slate-700">Evidence:</span> {check.evidence}
                            </p>
                          ) : null}
                        </article>
                      ))
                    ) : (
                      <p className="text-sm leading-6 text-slate-600">
                        All high-level checklist checks passed in this run.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="calibration" className="space-y-4">
                {report.controlCalibration ? (
                  <Card className="rounded-3xl p-5">
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Control-by-Control Calibration</p>
                          <h5 className="font-display text-2xl font-semibold text-slate-900">
                            {report.controlCalibration.totalControls} controls analyzed
                          </h5>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="success">PASS {report.controlCalibration.counts.PASS}</Badge>
                          <Badge variant="warning">PARTIAL {report.controlCalibration.counts.PARTIAL}</Badge>
                          <Badge variant="danger">MISSING {report.controlCalibration.counts.MISSING}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {calibrationControls.map((control) => (
                        <article
                          key={`${control.sheetName}-${control.rowNumber}-${control.controlId}`}
                          className="rounded-2xl border border-border bg-white p-4 shadow-[var(--shadow-soft)]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {control.controlId} · {control.sheetName} row {control.rowNumber}
                              </p>
                              {control.responseCell ? (
                                <p className="text-xs text-slate-500">
                                  Partner Response cell: <span className="font-mono">{control.responseCell}</span>
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={statusVariant(control.status)}>{control.status}</Badge>
                              <Badge variant="secondary">Confidence {control.confidence}</Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            <span className="font-semibold">Requirement:</span> {control.requirement}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            <span className="font-semibold text-slate-700">Current response:</span>{" "}
                            {control.response || "No response provided."}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-amber-900">
                            <span className="font-semibold">Recommendation:</span> {control.recommendation || "No recommendation."}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            Missing signals: {control.missingSignals.length ? control.missingSignals.join(", ") : "none"}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-slate-600">
                            Suggested edit (no new facts): {control.suggestedEdit}
                          </p>
                        </article>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <Alert tone="neutral">
                    <AlertTitle>No calibration details</AlertTitle>
                    <AlertDescription>
                      This run returned the high-level checklist score without the row-level control calibration view.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <Card className="rounded-3xl p-5">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How to read this result</p>
                    <h5 className="font-display text-2xl font-semibold text-slate-900">Scoring context</h5>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                    <p>
                      The <span className="font-semibold text-slate-900">Score {report.score}%</span> is based on{" "}
                      {report.rulepack.ruleCount} high-level checklist readiness checks.
                    </p>
                    {report.controlCalibration ? (
                      <p>
                        The <span className="font-semibold text-slate-900">Control-by-Control Calibration</span> is a stricter row-level
                        audit of {report.controlCalibration.totalControls} controls and can show many missing items even when the
                        high-level score is strong.
                      </p>
                    ) : null}
                    <p>
                      Profile overview: <span className="text-slate-900">{report.overview}</span>
                    </p>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl p-5">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Processing Notes</p>
                    <h5 className="font-display text-2xl font-semibold text-slate-900">Validator context and metadata</h5>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {report.processingNotes.length > 0 ? (
                      <ul className="space-y-3 text-sm text-slate-700">
                        {report.processingNotes.map((note) => (
                          <li key={note} className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 leading-6 text-sky-900">
                            {note}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-6 text-slate-600">No additional processing notes were returned for this run.</p>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Rulepack</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{report.rulepack.id}</p>
                        <p className="mt-1 text-xs text-slate-500">Version {report.rulepack.version}</p>
                      </div>
                      <div className="rounded-2xl border border-border bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Checklist target</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {report.target?.label ?? "No explicit target metadata"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{report.target?.track ?? "General review"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="raw">
                <Card className="rounded-3xl p-5">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Raw Output</p>
                    <h5 className="font-display text-2xl font-semibold text-slate-900">Full validator response text</h5>
                  </CardHeader>
                  <CardContent>
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-border bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                      {rawOutput}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
