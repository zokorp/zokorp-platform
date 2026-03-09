"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { extractPngTextEvidence, extractSvgEvidence, isStrictDiagramFile } from "@/lib/architecture-review/client";
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
  ArchitectureReviewPhase,
  ArchitectureWorkloadCriticality,
} from "@/lib/architecture-review/types";

type ArchitectureDiagramReviewerFormProps = {
  requiresAuth?: boolean;
  authUnavailable?: boolean;
};

type SubmitApiResponse =
  | {
      status: "queued";
      jobId: string;
      deliveryMode: null;
      phase: ArchitectureReviewPhase;
      progressPct: number;
      etaSeconds: number;
    }
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

type StatusApiResponse = {
  jobId: string;
  status: "queued" | "running" | "sent" | "fallback" | "rejected" | "failed";
  phase: ArchitectureReviewPhase;
  progressPct: number;
  etaSeconds: number;
  deliveryMode: "sent" | "fallback" | null;
  error?: string | null;
  reason?: string | null;
  fallback?: {
    mailtoUrl?: string | null;
    emlDownloadToken?: string | null;
    reason?: string | null;
  } | null;
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
  gtag?: (...args: unknown[]) => void;
};

const PHASE_LABELS: Record<ArchitectureReviewPhase, string> = {
  "upload-validate": "Validating submission",
  "diagram-precheck": "Checking architecture signals",
  ocr: "Collecting diagram evidence",
  rules: "Scoring deterministic findings",
  "llm-refine": "Finalizing report",
  "package-email": "Building delivery package",
  "send-fallback": "Delivering results",
  completed: "Completed",
};

const PHASE_DESCRIPTIONS: Record<ArchitectureReviewPhase, string> = {
  "upload-validate": "Checking file type, size, and whether the upload looks like architecture content.",
  "diagram-precheck": "Screening the diagram and narrative for obvious non-architecture or low-signal input.",
  ocr: "Using browser-extracted text and structure signals from the uploaded diagram.",
  rules: "Applying deterministic scoring for reliability, security, and operational readiness.",
  "llm-refine": "Finalizing the report package. New reviews no longer use a separate local-model phase.",
  "package-email": "Preparing the email-ready report, quote context, and delivery metadata.",
  "send-fallback": "Attempting delivery and preparing fallback options if email automation fails.",
  completed: "The review package is complete.",
};

const NON_ARCH_PRECHECK_TERMS = ["tradeline", "credit", "debt", "account number", "loan", "statement", "apr"];
const ARCH_PRECHECK_TERMS = ["architecture", "service", "api", "gateway", "database", "vpc", "subnet", "ingress"];
const INPUT_CHECKLIST = [
  "Directional request or data flow",
  "Named services, data stores, and trust boundaries",
  "Security, recovery, or operations notes where they exist",
  "One paragraph describing how the system works end to end",
];
const QUOTE_METHOD_ITEMS = [
  "$249 advisory baseline for the initial review call",
  "Each scored finding maps to a deterministic service line and fix-effort driver",
  "Confidence and score bands bound the core quote before package ranges are shown",
  "Low-confidence submissions stay diagnostic-first instead of inventing a large delivery scope",
];
const DELIVERY_PACKAGE_ITEMS = [
  "Overall score and analysis-confidence band",
  "Top deductions, optional recommendations, and service-line context",
  "Recommended next package: advisory review, remediation sprint, or implementation partner",
  "Fallback email actions if automated delivery is unavailable",
  "Ephemeral processing by default; archival is optional and explicit",
];

function trackAnalyticsEvent(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined") {
    return;
  }

  const maybeWindow = window as SpeechWindow;
  maybeWindow.gtag?.("event", name, params);
}

function formatEta(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remainingSeconds = safe % 60;

  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function inferDeviceClass() {
  if (typeof window === "undefined") {
    return "unknown" as const;
  }

  const width = window.innerWidth;
  if (width < 768) {
    return "mobile" as const;
  }

  if (width < 1024) {
    return "tablet" as const;
  }

  return "desktop" as const;
}

function collectSubmissionContext() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const url = new URL(window.location.href);
  return {
    utmSource: url.searchParams.get("utm_source") ?? undefined,
    utmMedium: url.searchParams.get("utm_medium") ?? undefined,
    utmCampaign: url.searchParams.get("utm_campaign") ?? undefined,
    landingPage: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || undefined,
    deviceClass: inferDeviceClass(),
  };
}

function quickNarrativePrecheck(paragraph: string) {
  const normalized = paragraph.toLowerCase();
  const nonArchHits = NON_ARCH_PRECHECK_TERMS.filter((term) => normalized.includes(term)).length;
  const archHits = ARCH_PRECHECK_TERMS.filter((term) => normalized.includes(term)).length;

  if (nonArchHits >= 3 && archHits <= 1) {
    return "This input looks non-architectural. Upload a system architecture diagram and description.";
  }

  return null;
}

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
  const [archiveForFollowup, setArchiveForFollowup] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<ArchitectureReviewPhase>("upload-validate");
  const [progressPct, setProgressPct] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "fallback" | "error" | "rejected">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fallbackMailtoUrl, setFallbackMailtoUrl] = useState<string | null>(null);
  const [fallbackEmlToken, setFallbackEmlToken] = useState<string | null>(null);

  const generatedDiagramUrlRef = useRef<string | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);

  const paragraphTooShort = paragraph.trim().length < 1;
  const paragraphTooLong = paragraph.trim().length > 2000;
  const fieldClassName =
    "focus-ring block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]";
  const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(((window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition));

  const canSubmit = useMemo(() => {
    if (!selectedFile || paragraphTooShort || paragraphTooLong) {
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

      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeJobId || status !== "running") {
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    let stopped = false;
    const jobId = activeJobId;

    async function pollStatus() {
      if (stopped) {
        return;
      }

      try {
        const response = await fetch(`/api/architecture-review-status?jobId=${encodeURIComponent(jobId)}`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as StatusApiResponse | { error: string };

        if (!response.ok || "error" in payload) {
          setStatus("error");
          setError("Unable to load processing status. Retry this review.");
          return;
        }

        setPhase(payload.phase);
        setProgressPct(clampPercent(payload.progressPct));
        setEtaSeconds(Math.max(0, Math.round(payload.etaSeconds)));

        if (payload.status === "sent") {
          setStatus("success");
          setActiveJobId(null);
          trackAnalyticsEvent("architecture_review_completed", {
            delivery_mode: "sent",
          });
          trackAnalyticsEvent("generate_lead", {
            form: "architecture-reviewer",
            delivery_mode: "sent",
          });
          return;
        }

        if (payload.status === "fallback") {
          setStatus("fallback");
          setActiveJobId(null);
          setFallbackMailtoUrl(payload.fallback?.mailtoUrl ?? null);
          setFallbackEmlToken(payload.fallback?.emlDownloadToken ?? null);
          trackAnalyticsEvent("generate_lead", {
            form: "architecture-reviewer",
            delivery_mode: "fallback",
          });
          return;
        }

        if (payload.status === "rejected") {
          setStatus("rejected");
          setActiveJobId(null);
          setError(payload.reason ?? "Uploaded file appears to be non-architecture content.");
          return;
        }

        if (payload.status === "failed") {
          setStatus("error");
          setActiveJobId(null);
          setError(payload.error ?? "Architecture review processing failed.");
        }
      } catch {
        setStatus("error");
        setError("Network error while polling review status.");
      }
    }

    void pollStatus();
    pollingIntervalRef.current = window.setInterval(() => {
      void pollStatus();
    }, 1300);

    return () => {
      stopped = true;
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [activeJobId, status]);

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
      // no-op
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

    const quickPrecheckError = quickNarrativePrecheck(paragraph.trim());
    if (quickPrecheckError) {
      setError(quickPrecheckError);
      return;
    }

    setStatus("running");
    setError(null);
    setFallbackMailtoUrl(null);
    setFallbackEmlToken(null);
    setPhase("upload-validate");
    setProgressPct(0);
    setEtaSeconds(0);

    const startedAtMs = performance.now();
    const startedAtISO = new Date().toISOString();

    const diagramValidation = await isStrictDiagramFile(selectedFile);
    if (!diagramValidation.ok) {
      setStatus("error");
      setError(diagramValidation.error ?? "Only PNG or SVG files are allowed.");
      return;
    }

    let clientPngOcrText: string | undefined;
    let clientSvgText: string | undefined;
    let clientSvgDimensions: { width: number; height: number } | undefined;

    if (diagramValidation.format === "png") {
      setPhase("ocr");
      setProgressPct(4);
      setEtaSeconds(45);
      try {
        clientPngOcrText = await extractPngTextEvidence(selectedFile, {
          onProgress: (progress) => {
            setPhase("ocr");
            setProgressPct(Math.max(4, Math.min(92, progress.percent)));
            setEtaSeconds(Math.max(3, Math.round(((100 - progress.percent) / 100) * 45)));
          },
        });
      } catch {
        setStatus("error");
        setError("Browser PNG text extraction failed. Retry with a clearer PNG or upload SVG.");
        return;
      }
    }

    const precheckMs = Math.max(0, Math.round(performance.now() - startedAtMs));

    if (diagramValidation.format === "svg") {
      try {
        const svgEvidence = await extractSvgEvidence(selectedFile);
        clientSvgText = svgEvidence.text;
        clientSvgDimensions = svgEvidence.dimensions ?? undefined;
        const normalizedSvgText = svgEvidence.text.toLowerCase();
        const nonArchHits = NON_ARCH_PRECHECK_TERMS.filter((term) => normalizedSvgText.includes(term)).length;
        const archHits = ARCH_PRECHECK_TERMS.filter((term) => normalizedSvgText.includes(term)).length;
        if (nonArchHits >= 4 && archHits <= 1) {
          setStatus("rejected");
          setError("Uploaded SVG appears non-architectural. No review was sent.");
          return;
        }
      } catch (validationError) {
        setStatus("error");
        setError(validationError instanceof Error ? validationError.message : "SVG parsing failed.");
        return;
      }
    }

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
          archiveForFollowup,
          submissionContext: collectSubmissionContext(),
          clientTiming: {
            startedAtISO,
            submittedAtISO: new Date().toISOString(),
            precheckMs,
            totalClientMs: Math.max(0, Math.round(performance.now() - startedAtMs)),
          },
          clientPngOcrText,
          clientSvgText,
          clientSvgDimensions,
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
        setError("error" in payload && payload.error ? payload.error : "Review submission failed. Please retry.");
        return;
      }

      if ("status" in payload && payload.status === "queued") {
        setActiveJobId(payload.jobId);
        setPhase(payload.phase);
        setProgressPct(clampPercent(payload.progressPct));
        setEtaSeconds(Math.max(0, Math.round(payload.etaSeconds)));
        trackAnalyticsEvent("architecture_review_started", {
          provider,
        });
        return;
      }

      // Backward compatibility for older responses
      if ("status" in payload && payload.status === "sent") {
        setStatus("success");
        trackAnalyticsEvent("architecture_review_completed", {
          delivery_mode: "sent",
        });
        return;
      }

      if ("status" in payload && payload.status === "fallback") {
        setStatus("fallback");
        setFallbackMailtoUrl(payload.mailtoUrl ?? null);
        setFallbackEmlToken(payload.emlDownloadToken ?? null);
        return;
      }

      setStatus("error");
      setError("Unexpected response from the review endpoint.");
    } catch {
      setStatus("error");
      setError("Network error while submitting review metadata.");
    }
  }

  if (authUnavailable) {
    return (
      <Card tone="muted" className="animate-fade-up rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Architecture Review</p>
          <h3 className="font-display text-2xl font-semibold text-slate-900">Architecture Diagram Reviewer</h3>
        </CardHeader>
        <CardContent>
          <Alert tone="warning">
            <AlertTitle>Authentication is disabled</AlertTitle>
            <AlertDescription>
              Password sign-in is currently unavailable. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (requiresAuth) {
    return (
      <Card tone="muted" className="animate-fade-up rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Architecture Review</p>
          <h3 className="font-display text-2xl font-semibold text-slate-900">Architecture Diagram Reviewer</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert tone="info">
            <AlertTitle>Business sign-in required</AlertTitle>
            <AlertDescription>
              Sign in with a business email to run this review. Results are delivered only by email.
            </AlertDescription>
          </Alert>
          <Link
            href="/login?callbackUrl=/software/architecture-diagram-reviewer"
            className={buttonVariants({ variant: "secondary" })}
          >
            Sign in to continue
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="surface animate-fade-up overflow-hidden rounded-2xl">
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-900 via-[#123c66] to-[#0f8ea9] px-6 py-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-amber-200/20 blur-2xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">Architecture Revenue Lead Engine</p>
        <h3 className="font-display mt-2 text-3xl font-semibold">Architecture Diagram Reviewer</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/90 md:text-base">
          Upload your architecture diagram, add one paragraph, and get a deterministic review delivered to your email.
          Findings stay off-page by design.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="brand" className="border-white/20 bg-white/12 text-white shadow-none">
            Free
          </Badge>
          <Badge variant="brand" className="border-white/20 bg-white/12 text-white shadow-none">
            Private
          </Badge>
          <Badge variant="brand" className="border-white/20 bg-white/12 text-white shadow-none">
            Email-only report in ~2 min
          </Badge>
          <Badge variant="brand" className="border-white/20 bg-white/12 text-white shadow-none">
            No findings on page
          </Badge>
        </div>
      </div>

      <div className="space-y-4 p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card tone="muted" className="rounded-2xl border border-slate-200 p-4">
            <CardHeader className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Best Input</p>
              <h4 className="font-display text-xl font-semibold text-slate-900">What improves the review</h4>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
              <ul className="space-y-2">
                {INPUT_CHECKLIST.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card tone="muted" className="rounded-2xl border border-slate-200 p-4">
            <CardHeader className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Quote Logic</p>
              <h4 className="font-display text-xl font-semibold text-slate-900">How pricing is assembled</h4>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6 text-slate-600">
              <ul className="space-y-2">
                {QUOTE_METHOD_ITEMS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card tone="muted" className="rounded-2xl border border-slate-200 p-4">
            <CardHeader className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Delivery</p>
              <h4 className="font-display text-xl font-semibold text-slate-900">What the email includes</h4>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
              <ul className="space-y-2">
                {DELIVERY_PACKAGE_ITEMS.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[0.45rem] h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/software/architecture-diagram-reviewer/benchmarks"
                className="inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
              >
                Review benchmark patterns
              </Link>
              <Link
                href="/software/architecture-diagram-reviewer/sample-report"
                className="inline-flex text-sm font-semibold text-sky-700 transition hover:text-sky-800"
              >
                View sample report
              </Link>
            </CardContent>
          </Card>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/85 p-4 md:p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Core Input</p>
            <p className="mt-2 text-sm text-slate-600">
              Upload the real diagram first. The sample generator stays available below if you need a quick SVG to test the workflow.
            </p>
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
              Generate Sample Diagram (Optional)
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Type or dictate an architecture narrative, then generate a provider-specific SVG that auto-attaches to this form. Use this for test submissions, not as a substitute for a real production diagram.
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
              <Button
                type="button"
                onClick={handleGenerateDiagram}
                size="sm"
              >
                Generate Diagram SVG
              </Button>
              <Button
                type="button"
                onClick={() => setGenerationNarrative(paragraph)}
                variant="secondary"
                size="sm"
              >
                Copy Description Here
              </Button>
              {speechSupported ? (
                isListening ? (
                  <Button
                    type="button"
                    onClick={stopDictation}
                    variant="destructive"
                    size="sm"
                  >
                    Stop Dictation
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={startDictation}
                    variant="secondary"
                    size="sm"
                  >
                    Start Dictation (Mobile)
                  </Button>
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
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      Download Generated SVG
                    </a>
                  ) : null}
                  <Button
                    type="button"
                    onClick={clearGeneratedDiagramPreview}
                    variant="secondary"
                    size="sm"
                  >
                    Clear Generated Diagram
                  </Button>
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

          <details className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
            <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Advanced Context (Improves Scoring Accuracy)
            </summary>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
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

            <label className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                type="checkbox"
                checked={archiveForFollowup}
                onChange={(event) => setArchiveForFollowup(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300"
              />
              <span className="space-y-1 text-sm text-slate-600">
                <span className="block font-medium text-slate-900">Allow archival for follow-up</span>
                <span className="block">
                  Off by default. If checked, ZoKorp may keep the uploaded diagram and report for follow-up work.
                  If left unchecked, the review stays on the ephemeral processing path and does not request external archival.
                </span>
              </span>
            </label>
          </details>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={!canSubmit}
              loading={status === "running"}
            >
              {status === "running" ? "Reviewing..." : "Run Review"}
            </Button>
            <p className="text-xs text-slate-500">
              Full findings and quote context are delivered by email only. This page stays limited to processing status and any fallback actions. By default the review uses the ephemeral path and does not request archival.
            </p>
          </div>
        </form>

        <div className="min-h-[168px]" aria-live="polite" aria-atomic="true">
          {status === "running" ? (
            <Card tone="glass" className="rounded-3xl p-5" role="status">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review in progress</p>
                    <h4 className="font-display text-2xl font-semibold text-slate-900">
                      Processing: {PHASE_LABELS[phase]}
                    </h4>
                    <p className="text-sm leading-6 text-slate-600">{PHASE_DESCRIPTIONS[phase]}</p>
                  </div>
                  <Badge variant="info">{clampPercent(progressPct)}%</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress
                  value={clampPercent(progressPct)}
                  tone="info"
                  aria-label={`Architecture review progress ${clampPercent(progressPct)} percent`}
                />
                <p className="text-sm text-sky-900">Estimated remaining time {formatEta(etaSeconds)}</p>
              </CardContent>
            </Card>
          ) : status === "success" ? (
            <Alert tone="success">
              <AlertTitle>Review complete</AlertTitle>
              <AlertDescription>Check your email for results.</AlertDescription>
            </Alert>
          ) : status === "fallback" ? (
            <Alert tone="warning">
              <AlertTitle>Automated delivery was unavailable.</AlertTitle>
              <AlertDescription>Use an email draft option below.</AlertDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                {fallbackMailtoUrl ? (
                  <a href={fallbackMailtoUrl} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Open email draft
                  </a>
                ) : null}
                {fallbackEmlToken ? (
                  <a
                    href={`/api/download-eml?token=${encodeURIComponent(fallbackEmlToken)}`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                  >
                    Download .eml
                  </a>
                ) : null}
              </div>
            </Alert>
          ) : (status === "error" || status === "rejected") && error ? (
            <Alert tone="danger">
              <AlertTitle>Review could not be completed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <Card tone="muted" className="rounded-3xl p-5">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Review status</p>
                <h4 className="font-display text-2xl font-semibold text-slate-900">Status updates will appear here</h4>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">
                  After you submit, this panel shows the active review stage, progress percentage, and any fallback delivery actions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
