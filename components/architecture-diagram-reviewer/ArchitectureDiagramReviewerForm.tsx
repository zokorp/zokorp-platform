"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildReviewReportFromEvidence,
  createEvidenceBundle,
  extractSvgEvidence,
  isStrictDiagramFile,
  parseLlmRefinement,
} from "@/lib/architecture-review/client";
import {
  generateArchitectureDiagramFromNarrative,
  makeGeneratedDiagramSvgFile,
} from "@/lib/architecture-review/diagram-generator";
import type {
  ArchitectureDiagramFormat,
  ArchitectureEngagementPreference,
  ArchitectureEnvironment,
  ArchitectureLifecycleStage,
  ArchitectureProvider,
  ArchitectureRegulatoryScope,
  ArchitectureWorkloadCriticality,
  LlmRefinement,
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

type ReviewProgressUpdate = {
  stage:
    | "validation"
    | "dimensions"
    | "ocr"
    | "svg-parse"
    | "rules"
    | "model-load"
    | "model-refinement"
    | "submit";
  message: string;
  fraction?: number;
  etaMs?: number | null;
  timeoutMs?: number | null;
  measurable?: boolean;
};

type ReviewProgressState = {
  stage: ReviewProgressUpdate["stage"];
  message: string;
  percent: number | null;
  etaMs: number | null;
  metric: "completion" | "timeout-budget" | "none";
  timeoutMs: number | null;
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

const WEBLLM_MODEL_LOAD_TIMEOUT_MS = 3 * 60 * 1000;
const WEBLLM_REFINEMENT_TIMEOUT_MS = 90 * 1000;

class TimeoutError extends Error {
  constructor(step: string, timeoutMs: number) {
    super(`${step} timed out after ${timeoutMs}ms`);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, step: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(step, timeoutMs));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function stripCodeFences(raw: string) {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function clampFraction(raw: number) {
  if (!Number.isFinite(raw)) {
    return 0;
  }

  if (raw < 0) {
    return 0;
  }

  if (raw > 1) {
    return 1;
  }

  return raw;
}

function computeEtaMsFromFraction(startedAtMs: number, fractionRaw: number) {
  const fraction = clampFraction(fractionRaw);
  if (fraction <= 0.02 || fraction >= 0.999) {
    return null;
  }

  const elapsedMs = Date.now() - startedAtMs;
  if (elapsedMs < 250) {
    return null;
  }

  const etaMs = Math.round(elapsedMs / fraction - elapsedMs);
  if (!Number.isFinite(etaMs) || etaMs < 0) {
    return null;
  }

  return etaMs;
}

function formatEta(etaMs: number | null) {
  if (etaMs === null) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.ceil(etaMs / 1000));
  if (totalSeconds <= 1) {
    return "<1s";
  }

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function buildWebLlmPrompt(input: {
  provider: ArchitectureProvider;
  paragraph: string;
  ocrText: string;
  serviceTokens: string[];
  deterministicFindings: Array<{
    ruleId: string;
    category: string;
    pointsDeducted: number;
    message: string;
    fix: string;
    evidence: string;
  }>;
}) {
  const payload = {
    provider: input.provider,
    paragraph: input.paragraph,
    ocrText: input.ocrText.slice(0, 4000),
    serviceTokens: input.serviceTokens,
    preliminaryFindings: input.deterministicFindings,
  };

  return [
    "Return JSON only. No markdown. No extra keys.",
    "Schema:",
    '{"flowNarrative":"string<=2000","findings":[{"ruleId":"string","category":"clarity|security|reliability|operations|performance|cost|sustainability","pointsDeducted":0,"message":"<=120","fix":"<=160","evidence":"<=240"}]}',
    "Rules:",
    "- Keep findings imperative and specific.",
    "- Keep pointsDeducted integer 0-100.",
    "- Keep 0-point findings only for optional recommendations.",
    "- Keep 0-20 findings.",
    "Input JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

function selectWebLlmModelIds(modelIds: string[]) {
  const smallInstruct = modelIds.filter((id) => /instruct/i.test(id) && /(1b|2b|3b|mini)/i.test(id));
  if (smallInstruct.length > 0) {
    return smallInstruct.slice(0, 3);
  }

  return modelIds.slice(0, 2);
}

async function safeUnloadEngine(engine: { unload: () => Promise<void> }) {
  try {
    await engine.unload();
  } catch {
    // no-op: cleanup failures should not break the user flow
  }
}

async function runWebLlmRefinement(input: {
  provider: ArchitectureProvider;
  paragraph: string;
  ocrText: string;
  serviceTokens: string[];
  deterministicFindings: Array<{
    ruleId: string;
    category: string;
    pointsDeducted: number;
    message: string;
    fix: string;
    evidence: string;
  }>;
  onProgress: (update: ReviewProgressUpdate) => void;
}): Promise<LlmRefinement | null> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    input.onProgress({
      stage: "model-refinement",
      message: "WebGPU is unavailable; using deterministic rules only.",
      measurable: false,
    });
    return null;
  }

  try {
    const webllm = await import("@mlc-ai/web-llm");
    const modelIds = selectWebLlmModelIds(webllm.prebuiltAppConfig.model_list.map((model) => model.model_id));

    if (modelIds.length === 0) {
      input.onProgress({
        stage: "model-load",
        message: "No local WebLLM model available; using deterministic rules only.",
        measurable: false,
      });
      return null;
    }

    let engine: Awaited<ReturnType<typeof webllm.CreateMLCEngine>> | null = null;
    let loadedModel: string | null = null;

    for (const modelId of modelIds) {
      try {
        const modelLoadStartedAt = Date.now();
        input.onProgress({
          stage: "model-load",
          message: `Loading local model (${modelId})...`,
          measurable: false,
          timeoutMs: WEBLLM_MODEL_LOAD_TIMEOUT_MS,
        });
        engine = await withTimeout(
          webllm.CreateMLCEngine(modelId, {
            initProgressCallback(progress) {
              if (typeof progress.progress === "number") {
                const normalizedFraction = clampFraction(progress.progress);
                const percentage = Math.round(normalizedFraction * 100);
                input.onProgress({
                  stage: "model-load",
                  message: `Loading local model (${modelId}) ${percentage}%`,
                  fraction: normalizedFraction,
                  etaMs: computeEtaMsFromFraction(modelLoadStartedAt, normalizedFraction),
                });
              }
            },
          }),
          WEBLLM_MODEL_LOAD_TIMEOUT_MS,
          `Model load (${modelId})`,
        );
        loadedModel = modelId;
        break;
      } catch (error) {
        if (error instanceof TimeoutError) {
          input.onProgress({
            stage: "model-load",
            message: `Model load timed out for ${modelId}; trying fallback model...`,
            measurable: false,
          });
        }
        continue;
      }
    }

    if (!engine || !loadedModel) {
      input.onProgress({
        stage: "model-load",
        message: "Model load failed; using deterministic rules only.",
        measurable: false,
      });
      return null;
    }

    const prompt = buildWebLlmPrompt({
      provider: input.provider,
      paragraph: input.paragraph,
      ocrText: input.ocrText,
      serviceTokens: input.serviceTokens,
      deterministicFindings: input.deterministicFindings,
    });

    input.onProgress({
      stage: "model-refinement",
      message: "Running local model refinement...",
      measurable: false,
      timeoutMs: WEBLLM_REFINEMENT_TIMEOUT_MS,
    });
    let completion: Awaited<ReturnType<typeof engine.chat.completions.create>> | null = null;
    try {
      completion = await withTimeout(
        engine.chat.completions.create({
          model: loadedModel,
          messages: [
            {
              role: "system",
              content:
                "You are a deterministic architecture reviewer assistant. Output strict JSON only, no markdown.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0,
          top_p: 1,
          max_tokens: 1100,
          response_format: { type: "json_object" },
        }),
        WEBLLM_REFINEMENT_TIMEOUT_MS,
        "Local model refinement",
      );
    } catch (error) {
      await safeUnloadEngine(engine);
      if (error instanceof TimeoutError) {
        input.onProgress({
          stage: "model-refinement",
          message: "Local model refinement timed out; using deterministic rules only.",
          measurable: false,
        });
        return null;
      }
      throw error;
    }

    const raw = completion.choices?.[0]?.message?.content;
    await safeUnloadEngine(engine);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(stripCodeFences(raw));
    return parseLlmRefinement(parsed);
  } catch {
    input.onProgress({
      stage: "model-refinement",
      message: "WebLLM refinement failed; using deterministic rules only.",
      measurable: false,
    });
    return null;
  }
}

function progressLabelFromOcr(message: { status: string; progress: number }) {
  const percent = Number.isFinite(message.progress) ? Math.round(message.progress * 100) : 0;

  if (!message.status) {
    return `Running OCR ${percent}%`;
  }

  return `OCR ${message.status} ${percent}%`;
}

async function readPngDimensions(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 24).arrayBuffer());
  if (bytes.length < 24) {
    throw new Error("image-header-too-short");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) {
    throw new Error("invalid-image-dimensions");
  }

  return {
    width,
    height,
  };
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
  const [speechSupported, setSpeechSupported] = useState(false);
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

  const [progress, setProgress] = useState<ReviewProgressState | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "fallback" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fallbackMailtoUrl, setFallbackMailtoUrl] = useState<string | null>(null);
  const [fallbackEmlToken, setFallbackEmlToken] = useState<string | null>(null);
  const stageStartedAtRef = useRef<Partial<Record<ReviewProgressUpdate["stage"], number>>>({});
  const generatedDiagramUrlRef = useRef<string | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const paragraphTooShort = paragraph.trim().length < 1;
  const paragraphTooLong = paragraph.trim().length > 2000;
  const fieldClassName =
    "focus-ring block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]";
  const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

  const canSubmit = useMemo(() => {
    if (!selectedFile) {
      return false;
    }

    if (paragraphTooShort || paragraphTooLong) {
      return false;
    }

    return status !== "running";
  }, [paragraphTooLong, paragraphTooShort, selectedFile, status]);

  function applyProgress(update: ReviewProgressUpdate) {
    const now = Date.now();
    if (!stageStartedAtRef.current[update.stage]) {
      stageStartedAtRef.current[update.stage] = now;
    }

    setProgress((previous) => {
      const sameStage = previous?.stage === update.stage;
      const startedAt = stageStartedAtRef.current[update.stage] ?? now;

      if (update.measurable === false || typeof update.fraction !== "number") {
        if (typeof update.timeoutMs === "number" && update.timeoutMs > 0) {
          const elapsedMs = Math.max(0, now - startedAt);
          const normalizedFraction = clampFraction(elapsedMs / update.timeoutMs);
          return {
            stage: update.stage,
            message: update.message,
            percent: Math.round(normalizedFraction * 100),
            etaMs: Math.max(0, update.timeoutMs - elapsedMs),
            metric: "timeout-budget",
            timeoutMs: update.timeoutMs,
          };
        }

        return {
          stage: update.stage,
          message: update.message,
          percent: null,
          etaMs: null,
          metric: "none",
          timeoutMs: null,
        };
      }

      const normalizedFraction = clampFraction(update.fraction);
      const proposedPercent = Math.round(normalizedFraction * 100);
      const percent =
        sameStage && typeof previous?.percent === "number"
          ? Math.max(previous.percent, proposedPercent)
          : proposedPercent;
      const etaMs = update.etaMs ?? computeEtaMsFromFraction(startedAt, normalizedFraction);

      return {
        stage: update.stage,
        message: update.message,
        percent,
        etaMs,
        metric: "completion",
        timeoutMs: null,
      };
    });
  }

  useEffect(() => {
    if (!progress || progress.metric !== "timeout-budget" || progress.timeoutMs === null || status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (!current || current.metric !== "timeout-budget" || current.timeoutMs === null) {
          return current;
        }

        const startedAt = stageStartedAtRef.current[current.stage];
        if (!startedAt) {
          return current;
        }

        const elapsedMs = Math.max(0, Date.now() - startedAt);
        const normalizedFraction = clampFraction(elapsedMs / current.timeoutMs);
        return {
          ...current,
          percent: Math.round(normalizedFraction * 100),
          etaMs: Math.max(0, current.timeoutMs - elapsedMs),
        };
      });
    }, 500);

    return () => window.clearInterval(timer);
  }, [progress, status]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ctor = (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
    setSpeechSupported(Boolean(ctor));
  }, []);

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
      // no-op: browser can throw when already stopped
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
    stageStartedAtRef.current = {};
    applyProgress({
      stage: "validation",
      message: "Validating diagram...",
      measurable: false,
    });
    setFallbackMailtoUrl(null);
    setFallbackEmlToken(null);

    const diagramValidation = await isStrictDiagramFile(selectedFile);
    if (!diagramValidation.ok) {
      setStatus("error");
      setProgress(null);
      setError(diagramValidation.error ?? "Only PNG or SVG files are allowed.");
      return;
    }

    const diagramFormat: ArchitectureDiagramFormat = diagramValidation.format;

    let ocrText = "";

    if (diagramFormat === "png") {
      try {
        applyProgress({
          stage: "dimensions",
          message: "Validating image dimensions...",
          measurable: false,
        });
        const dimensions = await readPngDimensions(selectedFile);
        if (dimensions.width < 600 || dimensions.height < 600) {
          setStatus("error");
          setProgress(null);
          setError("PNG is too small for reliable analysis. Upload a PNG at least 600x600.");
          return;
        }
      } catch {
        // Continue when dimension parsing is unavailable in the runtime.
        applyProgress({
          stage: "dimensions",
          message: "Image dimension check unavailable; continuing.",
          measurable: false,
        });
      }

      let ocrConfidence: number | null = null;

      try {
        const ocrStartedAt = Date.now();
        applyProgress({
          stage: "ocr",
          message: "Running OCR in your browser...",
          measurable: false,
        });
        const tesseract = await import("tesseract.js");
        const result = await tesseract.recognize(selectedFile, "eng", {
          logger(message) {
            if (message.status) {
              const fraction = Number.isFinite(message.progress) ? clampFraction(message.progress) : undefined;
              applyProgress({
                stage: "ocr",
                message: progressLabelFromOcr(message),
                fraction,
                etaMs:
                  typeof fraction === "number" ? computeEtaMsFromFraction(ocrStartedAt, fraction) : null,
              });
            }
          },
        });
        ocrText = (result.data.text || "").trim();
        ocrConfidence = typeof result.data.confidence === "number" ? result.data.confidence : null;
      } catch {
        setStatus("error");
        setProgress(null);
        setError("OCR failed in browser. Retry with a clearer PNG.");
        return;
      }

      if (ocrText.length < 40 || (ocrConfidence !== null && ocrConfidence < 45)) {
        // Do not hard-fail: some valid architecture diagrams are icon-heavy with tiny labels.
        applyProgress({
          stage: "ocr",
          message: "OCR text quality is low; continuing with paragraph-first analysis.",
          measurable: false,
        });
      }
    } else {
      try {
        applyProgress({
          stage: "svg-parse",
          message: "Parsing SVG labels in your browser...",
          measurable: false,
        });
        const svgEvidence = await extractSvgEvidence(selectedFile);
        if (svgEvidence.dimensions && (svgEvidence.dimensions.width < 400 || svgEvidence.dimensions.height < 400)) {
          setStatus("error");
          setProgress(null);
          setError("SVG canvas is too small for reliable analysis. Upload an SVG at least 400x400.");
          return;
        }
        ocrText = svgEvidence.text;
      } catch (error) {
        setStatus("error");
        setProgress(null);
        setError(error instanceof Error ? error.message : "SVG parsing failed. Upload a valid SVG diagram.");
        return;
      }

      if (ocrText.length < 20) {
        setStatus("error");
        setProgress(null);
        setError("SVG labels are too sparse to review reliably. Add labeled components and flows.");
        return;
      }
    }

    const evidenceBundle = createEvidenceBundle({
      provider,
      paragraph,
      ocrText,
      metadata: {
        diagramFormat,
        title,
        owner,
        lastUpdated,
        version,
        legend,
        workloadCriticality,
        regulatoryScope,
        environment,
        lifecycleStage,
        desiredEngagement,
      },
    });

    applyProgress({
      stage: "rules",
      message: "Running deterministic scoring rules...",
      measurable: false,
    });

    const deterministicOnlyReport = buildReviewReportFromEvidence({
      bundle: evidenceBundle,
      userEmail: "placeholder@example.com",
      quoteContext: {
        tokenCount: evidenceBundle.serviceTokens.length,
        ocrCharacterCount: evidenceBundle.ocrText.length,
        mode: "rules-only",
        workloadCriticality,
        desiredEngagement,
      },
    });

    let llmRefinement: LlmRefinement | null = null;
    let mode: "rules-only" | "webllm" = "rules-only";

    const detectedNonArchitectureInput = deterministicOnlyReport.findings.some(
      (finding) => finding.ruleId === "INPUT-NOT-ARCH-DIAGRAM",
    );
    if (detectedNonArchitectureInput) {
      setStatus("error");
      setProgress(null);
      setError(
        "This file does not appear to be an architecture diagram. No report was sent. Upload a system architecture diagram and retry.",
      );
      return;
    }

    llmRefinement = await runWebLlmRefinement({
      provider,
      paragraph,
      ocrText,
      serviceTokens: evidenceBundle.serviceTokens,
      deterministicFindings: deterministicOnlyReport.findings.map((finding) => ({
        ruleId: finding.ruleId,
        category: finding.category,
        pointsDeducted: finding.pointsDeducted,
        message: finding.message,
        fix: finding.fix,
        evidence: finding.evidence,
      })),
      onProgress: applyProgress,
    });

    if (llmRefinement) {
      mode = "webllm";
    }

    applyProgress({
      stage: "submit",
      message: "Finalizing report and sending metadata...",
      measurable: false,
    });

    const finalReport = buildReviewReportFromEvidence({
      bundle: evidenceBundle,
      userEmail: "placeholder@example.com",
      llmRefinement,
      quoteContext: {
        tokenCount: evidenceBundle.serviceTokens.length,
        ocrCharacterCount: evidenceBundle.ocrText.length,
        mode,
        workloadCriticality,
        desiredEngagement,
      },
    });

    try {
      const submitData = new FormData();
      submitData.append("report", JSON.stringify(finalReport));
      submitData.append(
        "metadata",
        JSON.stringify({
          title: title.trim() || undefined,
          owner: owner.trim() || undefined,
          lastUpdated: lastUpdated.trim() || undefined,
          version: version.trim() || undefined,
          legend: legend.trim() || undefined,
          paragraphInput: paragraph.trim(),
          diagramFormat,
          tokenCount: evidenceBundle.serviceTokens.length,
          ocrCharacterCount: evidenceBundle.ocrText.length,
          mode,
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">Browser-Native Analysis</p>
        <h3 className="font-display mt-2 text-3xl font-semibold">Architecture Diagram Reviewer</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/90 md:text-base">
          Upload a PNG or SVG, select cloud provider, and describe your architecture in one paragraph. The review runs
          deterministically with optional local model refinement, then emails results to your signed-in address.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/90">
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">PNG + SVG</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">OCR/parse in browser</span>
          <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1">No findings on page</span>
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
                  {generatedDiagramSummary.title} · {generatedDiagramSummary.nodes} nodes ·{" "}
                  {generatedDiagramSummary.edges} edges
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
                  <div className="overflow-hidden rounded-md border border-emerald-200 bg-white">
                    <object
                      data={generatedDiagramPreviewUrl}
                      type="image/svg+xml"
                      aria-label="Generated architecture diagram preview"
                      className="h-[280px] w-full"
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="font-semibold">Processing:</span> {progress.message}
              </p>
              {progress.percent !== null ? (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-sky-900">
                  {progress.percent}%
                </span>
              ) : null}
            </div>

            {progress.percent !== null ? (
              <div className="mt-2">
                <div className="h-2 overflow-hidden rounded-full bg-sky-100">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-[width] duration-300 ease-out"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-sky-800">
                  {progress.metric === "timeout-budget"
                    ? formatEta(progress.etaMs)
                      ? `Timeout budget ETA ${formatEta(progress.etaMs)}`
                      : "Timeout budget ETA calibrating..."
                    : formatEta(progress.etaMs)
                      ? `ETA ${formatEta(progress.etaMs)}`
                      : "ETA calibrating..."}
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-sky-800">ETA unavailable for this step.</p>
            )}
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
