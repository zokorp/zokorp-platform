"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { extractSvgEvidence, isStrictDiagramFile } from "@/lib/architecture-review/client";
import {
  generateArchitectureDiagramFromNarrative,
  makeGeneratedDiagramSvgFile,
} from "@/lib/architecture-review/diagram-generator";
import type {
  ArchitectureEngagementPreference,
  ArchitectureEnvironment,
  ArchitectureLifecycleStage,
  ArchitectureProvider,
  ArchitectureRegulatoryScope,
  ArchitectureWorkloadCriticality,
} from "@/lib/architecture-review/types";

type ArchitectureDiagramReviewerFormProps = {
  requiresAuth?: boolean;
  authUnavailable?: boolean;
};

type SubmitApiResponse =
  | {
      status: "sent";
    }
  | {
      status: "fallback";
      reason?: string;
      mailtoUrl?: string | null;
      emlDownloadToken?: string;
    }
  | {
      error: string;
    };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function ArchitectureDiagramReviewerForm({
  requiresAuth = false,
  authUnavailable = false,
}: ArchitectureDiagramReviewerFormProps) {
  const [provider, setProvider] = useState<ArchitectureProvider>("aws");
  const [paragraph, setParagraph] = useState("");
  const [generationNarrative, setGenerationNarrative] = useState("");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedDiagramPreviewUrl, setGeneratedDiagramPreviewUrl] = useState<string | null>(null);
  const [generatedDiagramSummary, setGeneratedDiagramSummary] = useState<{
    title: string;
    nodes: number;
    edges: number;
    filename: string;
  } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [version, setVersion] = useState("");
  const [legend, setLegend] = useState("");
  const [workloadCriticality, setWorkloadCriticality] = useState<ArchitectureWorkloadCriticality>("standard");
  const [regulatoryScope, setRegulatoryScope] = useState<ArchitectureRegulatoryScope>("none");
  const [environment, setEnvironment] = useState<ArchitectureEnvironment>("prod");
  const [lifecycleStage, setLifecycleStage] = useState<ArchitectureLifecycleStage>("production");
  const [desiredEngagement, setDesiredEngagement] = useState<ArchitectureEngagementPreference>("hands-on-remediation");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [progress, setProgress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "fallback" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fallbackMailtoUrl, setFallbackMailtoUrl] = useState<string | null>(null);
  const [fallbackEmlToken, setFallbackEmlToken] = useState<string | null>(null);

  const generatedDiagramUrlRef = useRef<string | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const paragraphTooShort = paragraph.trim().length < 1;
  const paragraphTooLong = paragraph.trim().length > 2000;
  const fieldClassName =
    "focus-ring block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]";
  const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

  const speechSupported = typeof window !== "undefined" && Boolean(((window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition));

  const canSubmit = useMemo(() => {
    if (!selectedFile) {
      return false;
    }

    if (paragraphTooShort || paragraphTooLong) {
      return false;
    }

    return status !== "running";
  }, [paragraphTooLong, paragraphTooShort, selectedFile, status]);


  useEffect(() => {
    return () => {
      if (generatedDiagramUrlRef.current) {
        URL.revokeObjectURL(generatedDiagramUrlRef.current);
      }

      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // no-op cleanup
        }
      }
    };
  }, []);

  function clearGeneratedDiagramPreview() {
    const generatedFilename = generatedDiagramSummary?.filename;
    if (generatedDiagramUrlRef.current) {
      URL.revokeObjectURL(generatedDiagramUrlRef.current);
      generatedDiagramUrlRef.current = null;
    }

    setGeneratedDiagramPreviewUrl(null);
    setGeneratedDiagramSummary(null);
    if (generatedFilename && selectedFile?.name === generatedFilename) {
      setSelectedFile(null);
    }
  }

  function appendNarrativeFromSpeech(rawTranscript: string) {
    const transcript = rawTranscript.replace(/\s+/g, " ").trim();
    if (!transcript) {
      return;
    }

    setGenerationNarrative((current) => `${current.trim()} ${transcript}`.trim());
  }

  function stopDictation() {
    if (!speechRecognitionRef.current) {
      setIsListening(false);
      return;
    }

    try {
      speechRecognitionRef.current.stop();
    } catch {
      // browser can throw when already stopped
    }

    setIsListening(false);
  }

  function startDictation() {
    if (typeof window === "undefined") {
      setGenerationError("Speech input is unavailable in this browser.");
      return;
    }

    const ctor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    if (!ctor) {
      setGenerationError("Speech input is unavailable in this browser.");
      return;
    }

    setGenerationError(null);

    if (!speechRecognitionRef.current) {
      const recognition = new ctor();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: unknown) => {
        const payload = event as {
          results?: ArrayLike<{ isFinal?: boolean; 0?: { transcript?: string } }>;
          resultIndex?: number;
        };
        if (!payload.results) {
          return;
        }

        const startIndex = Math.max(0, payload.resultIndex ?? 0);
        for (let index = startIndex; index < payload.results.length; index += 1) {
          const result = payload.results[index];
          const transcript = result?.[0]?.transcript ?? "";
          if (result?.isFinal) {
            appendNarrativeFromSpeech(transcript);
          }
        }
      };
      recognition.onerror = (event: unknown) => {
        const payload = event as { error?: string };
        if (payload.error && payload.error !== "no-speech") {
          setGenerationError(`Speech input failed (${payload.error}).`);
        }
      };
      recognition.onend = () => {
        setIsListening(false);
      };

      speechRecognitionRef.current = recognition;
    }

    try {
      speechRecognitionRef.current.start();
      setIsListening(true);
    } catch {
      setGenerationError("Speech input could not start. Retry after granting microphone access.");
      setIsListening(false);
    }
  }

  function handleGenerateDiagram() {
    const narrative = generationNarrative.trim() || paragraph.trim();
    if (narrative.length < 12) {
      setGenerationError("Add at least one sentence before generating a diagram.");
      return;
    }

    try {
      const generated = generateArchitectureDiagramFromNarrative({
        provider,
        narrative,
      });
      const generatedFile = makeGeneratedDiagramSvgFile({
        provider,
        svg: generated.svg,
      });
      clearGeneratedDiagramPreview();
      const previewUrl = URL.createObjectURL(new Blob([generated.svg], { type: "image/svg+xml" }));
      generatedDiagramUrlRef.current = previewUrl;
      setGeneratedDiagramPreviewUrl(previewUrl);
      setGeneratedDiagramSummary({
        title: generated.title,
        nodes: generated.nodes.length,
        edges: generated.edges.length,
        filename: generatedFile.name,
      });
      setSelectedFile(generatedFile);
      setGenerationError(null);

      if (!paragraph.trim()) {
        setParagraph(narrative);
      }
      if (!title.trim()) {
        setTitle(generated.title);
      }
    } catch {
      setGenerationError("Unable to generate diagram from that narrative. Try a clearer architecture paragraph.");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Select a PNG or SVG diagram before submitting.");
      return;
    }

    if (paragraphTooShort || paragraphTooLong) {
      setError("Description must be between 1 and 2000 characters.");
      return;
    }

    setStatus("running");
    setError(null);
    setProgress("Validating diagram...");
    setFallbackMailtoUrl(null);
    setFallbackEmlToken(null);

    const diagramValidation = await isStrictDiagramFile(selectedFile);
    if (!diagramValidation.ok) {
      setStatus("error");
      setProgress(null);
      setError(diagramValidation.error ?? "Only PNG or SVG files are allowed.");
      return;
    }

    if (diagramValidation.format === "svg") {
      try {
        await extractSvgEvidence(selectedFile);
      } catch (validationError) {
        setStatus("error");
        setProgress(null);
        setError(validationError instanceof Error ? validationError.message : "SVG parsing failed. Upload a valid SVG diagram.");
        return;
      }
    }

    setProgress("Uploading diagram for server-side analysis...");

    try {
      const submitData = new FormData();
      submitData.append(
        "metadata",
        JSON.stringify({
          provider,
          title: title.trim() || undefined,
          owner: owner.trim() || undefined,
          lastUpdated: lastUpdated.trim() || undefined,
          version: version.trim() || undefined,
          legend: legend.trim() || undefined,
          paragraphInput: paragraph.trim(),
          diagramFormat: diagramValidation.format,
          workloadCriticality,
          regulatoryScope,
          environment,
          lifecycleStage,
          desiredEngagement,
        }),
      );
      submitData.append("diagram", selectedFile, selectedFile.name);

      const response = await fetch("/api/submit-architecture-review", {
        method: "POST",
        body: submitData,
      });

      const payload = (await response.json()) as SubmitApiResponse;

      if (!response.ok) {
        setStatus("error");
        setProgress(null);
        setError("error" in payload && payload.error ? payload.error : "Review submission failed. Please retry.");
        return;
      }

      if ("status" in payload && payload.status === "sent") {
        setStatus("success");
        setProgress(null);
        return;
      }

      if ("status" in payload && payload.status === "fallback") {
        setStatus("fallback");
        setProgress(null);
        setFallbackMailtoUrl(payload.mailtoUrl ?? null);
        setFallbackEmlToken(payload.emlDownloadToken ?? null);
        return;
      }

      setStatus("error");
      setProgress(null);
      setError("Unexpected response from the review endpoint.");
    } catch {
      setStatus("error");
      setProgress(null);
      setError("Network error while submitting review metadata.");
    }
  }

  if (authUnavailable) {
    return (
      <section className="surface-muted animate-fade-up rounded-2xl p-6">
        <div className="rounded-xl border border-slate-200 bg-white/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Architecture Review</p>
          <h3 className="font-display mt-2 text-2xl font-semibold text-slate-900">Architecture Diagram Reviewer</h3>
          <p className="mt-2 text-sm text-slate-700">
            Password sign-in is currently disabled. Set `AUTH_PASSWORD_ENABLED=true`.
          </p>
        </div>
      </section>
    );
  }

  if (requiresAuth) {
    return (
      <section className="surface-muted animate-fade-up rounded-2xl p-6">
        <div className="rounded-xl border border-slate-200 bg-white/75 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Architecture Review</p>
          <h3 className="font-display mt-2 text-2xl font-semibold text-slate-900">Architecture Diagram Reviewer</h3>
          <p className="mt-2 text-sm text-slate-700">
            Sign in with a business email to run this review. Results are delivered only by email.
          </p>
        </div>
        <Link
          href="/login?callbackUrl=/software/architecture-diagram-reviewer"
          className="focus-ring mt-4 inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Sign in to continue
        </Link>
      </section>
    );
  }

  return (
    <section className="surface animate-fade-up overflow-hidden rounded-2xl">
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-900 via-[#123c66] to-[#0f8ea9] px-6 py-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-amber-200/20 blur-2xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">Server-Validated Review</p>
        <h3 className="font-display mt-2 text-3xl font-semibold">Architecture Diagram Reviewer</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/90 md:text-base">
          Upload a PNG or SVG, select cloud provider, and describe your architecture in one paragraph. The server
          validates the uploaded file and recomputes scoring from the diagram before emailing results to your signed-in address.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/90">
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">PNG + SVG</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">Server-side analysis</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">Trusted scoring</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">Optional generated SVG</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">Email delivery</span>
        </div>
      </div>

      <div className="space-y-4 p-5 md:p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Generate Sample Diagram (Optional)
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Type or dictate a short architecture narrative, then generate a provider-specific SVG that auto-attaches
              to the review form.
            </p>

            <label className="mt-3 block space-y-2">
              <span className={fieldLabelClassName}>Generator Narrative</span>
              <textarea
                value={generationNarrative}
                onChange={(event) => setGenerationNarrative(event.target.value)}
                maxLength={2000}
                placeholder="Example: Users hit an API gateway, requests route to app services, data persists to a managed database, and monitoring captures logs/alerts."
                className={`${fieldClassName} min-h-28`}
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateDiagram}
                className="focus-ring rounded-md border border-slate-300 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Generate Diagram SVG
              </button>
              <button
                type="button"
                onClick={() => setGenerationNarrative(paragraph)}
                className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Copy Description Here
              </button>
              {speechSupported ? (
                isListening ? (
                  <button
                    type="button"
                    onClick={stopDictation}
                    className="focus-ring rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Stop Dictation
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startDictation}
                    className="focus-ring rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    Start Dictation (Mobile)
                  </button>
                )
              ) : null}
            </div>

            {generatedDiagramSummary ? (
              <div className="mt-3 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-900">
                  Generated diagram attached: {generatedDiagramSummary.filename}
                </p>
                <p className="text-xs text-emerald-800">
                  {generatedDiagramSummary.title} - {generatedDiagramSummary.nodes} nodes - {generatedDiagramSummary.edges} edges
                </p>
                <div className="flex flex-wrap gap-2">
                  {generatedDiagramPreviewUrl ? (
                    <a
                      href={generatedDiagramPreviewUrl}
                      download={generatedDiagramSummary.filename}
                      className="focus-ring inline-flex rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                    >
                      Download Generated SVG
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearGeneratedDiagramPreview}
                    className="focus-ring rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    Clear Generated Diagram
                  </button>
                </div>
                {generatedDiagramPreviewUrl ? (
                  <div className="overflow-hidden rounded-md border border-emerald-200 bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={generatedDiagramPreviewUrl}
                      alt="Generated architecture diagram preview"
                      className="h-[360px] w-full rounded object-contain md:h-[460px]"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {generationError ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {generationError}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/85 p-4 md:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Core Input</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className={fieldLabelClassName}>Cloud Provider</span>
                <select
                  name="provider"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as ArchitectureProvider)}
                  className={fieldClassName}
                  required
                >
                  <option value="aws">AWS</option>
                  <option value="azure">Azure</option>
                  <option value="gcp">GCP</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClassName}>Diagram File</span>
                <input
                  name="diagram"
                  type="file"
                  accept="image/png,image/svg+xml,.png,.svg"
                  required
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    if (nextFile) {
                      clearGeneratedDiagramPreview();
                    }
                    setSelectedFile(nextFile);
                  }}
                  className={fieldClassName}
                />
                <p className="text-xs text-slate-500">Only `image/png` and `image/svg+xml` files are accepted.</p>
                {selectedFile ? (
                  <p className="text-xs font-medium text-slate-700">Current file: {selectedFile.name}</p>
                ) : null}
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className={fieldLabelClassName}>Architecture Description (required)</span>
              <textarea
                name="description"
                value={paragraph}
                onChange={(event) => setParagraph(event.target.value)}
                minLength={1}
                maxLength={2000}
                required
                placeholder="Describe request/data flow, trust boundaries, and operational expectations in one paragraph."
                className={`${fieldClassName} min-h-32`}
              />
              <p className="text-xs text-slate-500">{paragraph.trim().length}/2000 characters</p>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Diagram Metadata (Improves Scoring Accuracy)
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className={fieldLabelClassName}>Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  placeholder="Payments API Production Architecture"
                  className={fieldClassName}
                />
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClassName}>Owner</span>
                <input
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  maxLength={160}
                  placeholder="Platform Team"
                  className={fieldClassName}
                />
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClassName}>Last Updated</span>
                <input
                  value={lastUpdated}
                  onChange={(event) => setLastUpdated(event.target.value)}
                  maxLength={60}
                  placeholder="2026-03-05"
                  className={fieldClassName}
                />
              </label>
              <label className="space-y-2">
                <span className={fieldLabelClassName}>Version</span>
                <input
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
                  maxLength={60}
                  placeholder="v1.0"
                  className={fieldClassName}
                />
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className={fieldLabelClassName}>Legend (optional)</span>
              <textarea
                value={legend}
                onChange={(event) => setLegend(event.target.value)}
                maxLength={600}
                placeholder="Example: solid arrow=request/response, dashed arrow=async event, dotted arrow=batch transfer"
                className={`${fieldClassName} min-h-24`}
              />
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className={fieldLabelClassName}>Workload Criticality</span>
                <select
                  value={workloadCriticality}
                  onChange={(event) => setWorkloadCriticality(event.target.value as ArchitectureWorkloadCriticality)}
                  className={fieldClassName}
                >
                  <option value="low">Low</option>
                  <option value="standard">Standard</option>
                  <option value="mission-critical">Mission-critical</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClassName}>Regulatory Scope</span>
                <select
                  value={regulatoryScope}
                  onChange={(event) => setRegulatoryScope(event.target.value as ArchitectureRegulatoryScope)}
                  className={fieldClassName}
                >
                  <option value="none">None</option>
                  <option value="soc2">SOC 2</option>
                  <option value="pci">PCI</option>
                  <option value="hipaa">HIPAA</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClassName}>Environment</span>
                <select
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value as ArchitectureEnvironment)}
                  className={fieldClassName}
                >
                  <option value="dev">Dev</option>
                  <option value="test">Test</option>
                  <option value="prod">Prod</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className={fieldLabelClassName}>Lifecycle Stage</span>
                <select
                  value={lifecycleStage}
                  onChange={(event) => setLifecycleStage(event.target.value as ArchitectureLifecycleStage)}
                  className={fieldClassName}
                >
                  <option value="early-design">Early design</option>
                  <option value="pre-prod">Pre-prod</option>
                  <option value="production">Production</option>
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className={fieldLabelClassName}>Desired Engagement</span>
                <select
                  value={desiredEngagement}
                  onChange={(event) => setDesiredEngagement(event.target.value as ArchitectureEngagementPreference)}
                  className={fieldClassName}
                >
                  <option value="hands-on-remediation">Hands-on remediation</option>
                  <option value="diagram-rebuild">Diagram rebuild</option>
                  <option value="review-call-only">Review call only</option>
                  <option value="ongoing-quarterly-reviews">Ongoing quarterly reviews</option>
                  <option value="architect-on-call">Architect-on-call</option>
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="focus-ring rounded-lg bg-gradient-to-r from-slate-900 to-[#174f7f] px-5 py-2.5 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-[#1d628f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "running" ? "Reviewing..." : "Run Review"}
            </button>
            <p className="text-xs text-slate-500">Results are delivered by email only and are not shown in this page.</p>
          </div>
        </form>

        {progress ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
            <span className="font-semibold">Processing:</span> {progress}
          </div>
        ) : null}

        {status === "success" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
            Review complete. Check your email for results.
          </div>
        ) : null}

        {status === "fallback" ? (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            <p>Automated delivery was unavailable. Use an email draft option below.</p>
            <div className="flex flex-wrap gap-2">
              {fallbackMailtoUrl ? (
                <a
                  href={fallbackMailtoUrl}
                  className="focus-ring inline-flex rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  Open email draft
                </a>
              ) : null}
              {fallbackEmlToken ? (
                <a
                  href={`/api/download-eml?token=${encodeURIComponent(fallbackEmlToken)}`}
                  className="focus-ring inline-flex rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  Download .eml
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {status === "error" && error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</div>
        ) : null}
      </div>
    </section>
  );
}
