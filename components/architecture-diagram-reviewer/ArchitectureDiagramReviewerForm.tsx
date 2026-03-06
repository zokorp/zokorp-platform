"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  buildReviewReportFromEvidence,
  createEvidenceBundle,
  isStrictPngFile,
  parseLlmRefinement,
} from "@/lib/architecture-review/client";
import type { ArchitectureProvider, LlmRefinement } from "@/lib/architecture-review/types";

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
  onProgress: (message: string) => void;
}): Promise<LlmRefinement | null> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    input.onProgress("WebGPU is unavailable; using deterministic rules only.");
    return null;
  }

  try {
    const webllm = await import("@mlc-ai/web-llm");
    const modelIds = selectWebLlmModelIds(webllm.prebuiltAppConfig.model_list.map((model) => model.model_id));

    if (modelIds.length === 0) {
      input.onProgress("No local WebLLM model available; using deterministic rules only.");
      return null;
    }

    let engine: Awaited<ReturnType<typeof webllm.CreateMLCEngine>> | null = null;
    let loadedModel: string | null = null;

    for (const modelId of modelIds) {
      try {
        input.onProgress(`Loading local model (${modelId})...`);
        engine = await withTimeout(
          webllm.CreateMLCEngine(modelId, {
            initProgressCallback(progress) {
              if (typeof progress.progress === "number") {
                const percentage = Math.round(progress.progress * 100);
                input.onProgress(`Loading local model (${modelId}) ${percentage}%`);
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
          input.onProgress(`Model load timed out for ${modelId}; trying fallback model...`);
        }
        continue;
      }
    }

    if (!engine || !loadedModel) {
      input.onProgress("Model load failed; using deterministic rules only.");
      return null;
    }

    const prompt = buildWebLlmPrompt({
      provider: input.provider,
      paragraph: input.paragraph,
      ocrText: input.ocrText,
      serviceTokens: input.serviceTokens,
      deterministicFindings: input.deterministicFindings,
    });

    input.onProgress("Running local model refinement...");
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
        input.onProgress("Local model refinement timed out; using deterministic rules only.");
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
    input.onProgress("WebLLM refinement failed; using deterministic rules only.");
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

export function ArchitectureDiagramReviewerForm({
  requiresAuth = false,
  authUnavailable = false,
}: ArchitectureDiagramReviewerFormProps) {
  const [provider, setProvider] = useState<ArchitectureProvider>("aws");
  const [paragraph, setParagraph] = useState("");
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [version, setVersion] = useState("");
  const [legend, setLegend] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [progress, setProgress] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "fallback" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fallbackMailtoUrl, setFallbackMailtoUrl] = useState<string | null>(null);
  const [fallbackEmlToken, setFallbackEmlToken] = useState<string | null>(null);

  const paragraphTooShort = paragraph.trim().length < 1;
  const paragraphTooLong = paragraph.trim().length > 2000;

  const canSubmit = useMemo(() => {
    if (!selectedFile) {
      return false;
    }

    if (paragraphTooShort || paragraphTooLong) {
      return false;
    }

    return status !== "running";
  }, [paragraphTooLong, paragraphTooShort, selectedFile, status]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Select a PNG diagram before submitting.");
      return;
    }

    if (paragraphTooShort || paragraphTooLong) {
      setError("Description must be between 1 and 2000 characters.");
      return;
    }

    setStatus("running");
    setError(null);
    setProgress("Validating PNG...");
    setFallbackMailtoUrl(null);
    setFallbackEmlToken(null);

    const pngValidation = await isStrictPngFile(selectedFile);
    if (!pngValidation.ok) {
      setStatus("error");
      setProgress(null);
      setError(pngValidation.error ?? "Only PNG files are allowed.");
      return;
    }

    let ocrText = "";

    try {
      setProgress("Running OCR in your browser...");
      const tesseract = await import("tesseract.js");
      const result = await tesseract.recognize(selectedFile, "eng", {
        logger(message) {
          if (message.status) {
            setProgress(progressLabelFromOcr(message));
          }
        },
      });
      ocrText = (result.data.text || "").trim();
    } catch {
      setStatus("error");
      setProgress(null);
      setError("OCR failed in browser. Retry with a clearer PNG.");
      return;
    }

    const evidenceBundle = createEvidenceBundle({
      provider,
      paragraph,
      ocrText,
      metadata: {
        title,
        owner,
        lastUpdated,
        version,
        legend,
      },
    });

    setProgress("Running deterministic scoring rules...");

    const deterministicOnlyReport = buildReviewReportFromEvidence({
      bundle: evidenceBundle,
      userEmail: "placeholder@example.com",
    });

    let llmRefinement: LlmRefinement | null = null;
    let mode: "rules-only" | "webllm" = "rules-only";

    const detectedNonArchitectureInput = deterministicOnlyReport.findings.some(
      (finding) => finding.ruleId === "INPUT-NOT-ARCH-DIAGRAM",
    );
    if (detectedNonArchitectureInput) {
      setProgress("Detected non-architecture content; skipping local model and using deterministic rules.");
    } else {
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
        onProgress: setProgress,
      });
    }

    if (llmRefinement) {
      mode = "webllm";
    }

    setProgress("Finalizing report and sending metadata...");

    const finalReport = buildReviewReportFromEvidence({
      bundle: evidenceBundle,
      userEmail: "placeholder@example.com",
      llmRefinement,
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
          tokenCount: evidenceBundle.serviceTokens.length,
          ocrCharacterCount: evidenceBundle.ocrText.length,
          mode,
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
        setError("Review submission failed. Please retry.");
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
      <section className="surface-muted rounded-xl p-5">
        <h3 className="font-display text-2xl font-semibold text-slate-900">Architecture Diagram Reviewer</h3>
        <p className="mt-2 text-sm text-slate-700">
          Password sign-in is currently disabled. Set `AUTH_PASSWORD_ENABLED=true`.
        </p>
      </section>
    );
  }

  if (requiresAuth) {
    return (
      <section className="surface-muted rounded-xl p-5">
        <h3 className="font-display text-2xl font-semibold text-slate-900">Architecture Diagram Reviewer</h3>
        <p className="mt-2 text-sm text-slate-700">
          Sign in with a business email to run this review. Results are delivered only by email.
        </p>
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
    <section className="surface animate-fade-up rounded-xl p-5">
      <h3 className="font-display text-2xl font-semibold text-slate-900">Architecture Diagram Reviewer</h3>
      <p className="mt-2 text-sm text-slate-600">
        Upload a PNG, select cloud provider, and describe the architecture in one paragraph.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Processing stays in your browser (OCR + reasoning). The PNG file is never uploaded to this server.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Cloud Provider</span>
            <select
              name="provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value as ArchitectureProvider)}
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="aws">AWS</option>
              <option value="azure">Azure</option>
              <option value="gcp">GCP</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Diagram PNG</span>
            <input
              name="diagram"
              type="file"
              accept="image/png"
              required
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500">Only `image/png` files are accepted.</p>
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Architecture Description (required)
          </span>
          <textarea
            name="description"
            value={paragraph}
            onChange={(event) => setParagraph(event.target.value)}
            minLength={1}
            maxLength={2000}
            required
            placeholder="Describe request/data flow, trust boundaries, and operational expectations in one paragraph."
            className="focus-ring min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">{paragraph.trim().length}/2000 characters</p>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder="Payments API Production Architecture"
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Owner</span>
            <input
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              maxLength={160}
              placeholder="Platform Team"
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Last Updated</span>
            <input
              value={lastUpdated}
              onChange={(event) => setLastUpdated(event.target.value)}
              maxLength={60}
              placeholder="2026-03-05"
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Version</span>
            <input
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              maxLength={60}
              placeholder="v1.0"
              className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Legend (optional)</span>
          <textarea
            value={legend}
            onChange={(event) => setLegend(event.target.value)}
            maxLength={600}
            placeholder="Example: solid arrow=request/response, dashed arrow=async event, dotted arrow=batch transfer"
            className="focus-ring min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {status === "running" ? "Reviewing..." : "Run Review"}
        </button>
      </form>

      {progress ? (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {progress}
        </div>
      ) : null}

      {status === "success" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Review complete. Check your email for results.
        </div>
      ) : null}

      {status === "fallback" ? (
        <div className="mt-4 space-y-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
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
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
    </section>
  );
}
