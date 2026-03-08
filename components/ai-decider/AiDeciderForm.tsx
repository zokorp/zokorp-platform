"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { isAllowedAiDeciderBusinessEmail } from "@/lib/ai-decider/input";
import { buildAiDeciderQuestions } from "@/lib/ai-decider/questions";
import { extractAiDeciderSignals } from "@/lib/ai-decider/signals";
import { aiDeciderSubmissionResponseSchema } from "@/lib/ai-decider/types";

type AiDeciderFormProps = {
  initialEmail?: string;
  initialName?: string;
  lockedEmail?: string;
};

type FormState = {
  email: string;
  fullName: string;
  companyName: string;
  roleTitle: string;
  website: string;
  narrativeInput: string;
  answers: Record<string, string>;
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

const INITIAL_STATE: FormState = {
  email: "",
  fullName: "",
  companyName: "",
  roleTitle: "",
  website: "",
  narrativeInput: "",
  answers: {},
};

const fieldClassName =
  "focus-ring block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]";
const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

const productHighlights = [
  {
    title: "Deterministic consulting logic",
    description: "No LLMs or paid AI services. The same inputs always produce the same memo.",
  },
  {
    title: "Adaptive follow-up questions",
    description: "The second step changes based on the workflow signals detected in your narrative.",
  },
  {
    title: "Email-only advisory memo",
    description: "The verdict, findings, blockers, and quote range are delivered to your verified business inbox.",
  },
] as const;

function unique(values: string[]) {
  return [...new Set(values)];
}

export function AiDeciderForm({
  initialEmail = "",
  initialName = "",
  lockedEmail = "",
}: AiDeciderFormProps) {
  const effectiveEmail = lockedEmail || initialEmail;
  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    email: effectiveEmail,
    fullName: initialName,
  });
  const [phase, setPhase] = useState<"intake" | "followup" | "success" | "fallback">("intake");
  const [status, setStatus] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [verdictLine, setVerdictLine] = useState("");
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);

  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const narrativeLength = form.narrativeInput.trim().length;
  const narrativeTooShort = narrativeLength < 80;
  const speechSupported =
    typeof window !== "undefined" &&
    Boolean(
      ((window as SpeechWindow).SpeechRecognition ??
        (window as SpeechWindow).webkitSpeechRecognition),
    );

  const signals = extractAiDeciderSignals(form.narrativeInput);
  const adaptiveQuestions = buildAiDeciderQuestions(signals);
  const signalChips = unique([
    ...signals.businessFunctions.slice(0, 2),
    ...signals.dataTypes.slice(0, 2),
    ...signals.desiredOutcomes.slice(0, 2),
    signals.riskLevel !== "low" ? `${signals.riskLevel} risk` : "",
  ]).filter(Boolean);

  useEffect(() => {
    return () => {
      if (!speechRecognitionRef.current) {
        return;
      }

      try {
        speechRecognitionRef.current.stop();
      } catch {
        // no-op cleanup
      }
    };
  }, []);

  useEffect(() => {
    if (!lockedEmail) {
      return;
    }

    setForm((current) => ({
      ...current,
      email: lockedEmail,
    }));
  }, [lockedEmail]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateAnswer(questionId: string, value: string) {
    setForm((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [questionId]: value,
      },
    }));
  }

  function appendNarrativeFromSpeech(rawTranscript: string) {
    const transcript = rawTranscript.replace(/\s+/g, " ").trim();
    if (!transcript) {
      return;
    }

    setForm((current) => ({
      ...current,
      narrativeInput: `${current.narrativeInput.trim()} ${transcript}`.trim(),
    }));
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
      setError("Speech input is unavailable in this browser.");
      return;
    }

    const ctor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!ctor) {
      setError("Speech input is unavailable in this browser.");
      return;
    }

    setError(null);

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
          setError(`Speech input failed (${payload.error}).`);
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
      setError("Speech input could not start. Retry after granting microphone access.");
      setIsListening(false);
    }
  }

  function validateIntake() {
    if (!form.email.trim()) {
      return "Enter your business email.";
    }

    if (!z.string().email().safeParse(form.email.trim()).success) {
      return "Enter a valid business email.";
    }

    if (!isAllowedAiDeciderBusinessEmail(form.email)) {
      return "Use your business email. Personal email domains are blocked for this diagnostic.";
    }

    if (!form.fullName.trim()) {
      return "Enter your full name.";
    }

    if (!form.companyName.trim()) {
      return "Enter your company name.";
    }

    if (!form.roleTitle.trim()) {
      return "Enter your role or title.";
    }

    if (narrativeTooShort) {
      return "Describe the business problem in more detail so I can size the right approach.";
    }

    return null;
  }

  function validateFollowup() {
    for (const question of adaptiveQuestions) {
      if (!form.answers[question.id]) {
        return `Answer this follow-up question before submitting: ${question.prompt}`;
      }
    }

    return null;
  }

  function handleContinue() {
    const validationError = validateIntake();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setPhase("followup");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const intakeError = validateIntake();
    if (intakeError) {
      setError(intakeError);
      setPhase("intake");
      return;
    }

    const followupError = validateFollowup();
    if (followupError) {
      setError(followupError);
      return;
    }

    setStatus("running");
    setError(null);
    setFallbackReason(null);

    try {
      const response = await fetch("/api/submit-ai-decider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          email: form.email.trim().toLowerCase(),
          fullName: form.fullName.trim(),
          companyName: form.companyName.trim(),
          roleTitle: form.roleTitle.trim(),
          website: form.website.trim(),
          narrativeInput: form.narrativeInput.trim(),
        }),
      });

      const payload = aiDeciderSubmissionResponseSchema.parse(await response.json());
      if ("error" in payload) {
        throw new Error(payload.error);
      }

      setVerdictLine(payload.verdictLine);
      if (payload.status === "fallback") {
        setFallbackReason(payload.reason);
        setPhase("fallback");
      } else {
        setPhase("success");
      }
      setStatus("idle");
    } catch (submissionError) {
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to submit AI Decider right now.",
      );
    }
  }

  if (phase === "success") {
    return (
      <section className="surface rounded-2xl p-6 md:p-7">
        <h2 className="font-display text-3xl font-semibold text-slate-900">Your analysis has been emailed.</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{verdictLine}</p>
      </section>
    );
  }

  if (phase === "fallback") {
    return (
      <section className="surface rounded-2xl p-6 md:p-7">
        <h2 className="font-display text-3xl font-semibold text-slate-900">Email delivery is temporarily unavailable.</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{verdictLine}</p>
        {fallbackReason ? <p className="mt-2 text-sm text-amber-700">{fallbackReason}</p> : null}
      </section>
    );
  }

  return (
    <section className="surface rounded-2xl p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Decider</p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-slate-900">
            Find out if your business problem actually needs AI
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
            Start from your verified business-email account, explain the problem in plain language, and answer the targeted
            follow-up questions. The full memo is emailed to you, not shown in the browser.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Deterministic logic only
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {productHighlights.map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
          </article>
        ))}
      </div>

      <form className="mt-7 space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          {lockedEmail ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 md:col-span-2">
              <p className={fieldLabelClassName}>Verified Business Email</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{form.email}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Results are sent only to the verified email on your signed-in account. To use a different inbox, sign out and verify that business email first.
              </p>
            </div>
          ) : (
            <label className="block">
              <span className={fieldLabelClassName}>Business Email</span>
              <input
                aria-label="Business email"
                className={`${fieldClassName} mt-1.5`}
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
            </label>
          )}
          <label className="block">
            <span className={fieldLabelClassName}>Full Name</span>
            <input
              aria-label="Full name"
              className={`${fieldClassName} mt-1.5`}
              name="fullName"
              type="text"
              value={form.fullName}
              onChange={(event) => updateField("fullName", event.target.value)}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClassName}>Company Name</span>
            <input
              aria-label="Company name"
              className={`${fieldClassName} mt-1.5`}
              name="companyName"
              type="text"
              value={form.companyName}
              onChange={(event) => updateField("companyName", event.target.value)}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClassName}>Role Or Title</span>
            <input
              aria-label="Role or title"
              className={`${fieldClassName} mt-1.5`}
              name="roleTitle"
              type="text"
              value={form.roleTitle}
              onChange={(event) => updateField("roleTitle", event.target.value)}
            />
          </label>
        </div>

        <label className="block">
          <span className={fieldLabelClassName}>Company Website (Optional)</span>
          <input
            aria-label="Company website or domain"
            className={`${fieldClassName} mt-1.5`}
            name="website"
            type="text"
            placeholder="example.com"
            value={form.website}
            onChange={(event) => updateField("website", event.target.value)}
          />
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className={fieldLabelClassName}>Business Narrative</p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                Describe the business problem, the current process, the data involved, and what outcome you want.
              </h3>
            </div>

            {speechSupported ? (
              <button
                className={`focus-ring rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  isListening
                    ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                type="button"
                onClick={isListening ? stopDictation : startDictation}
              >
                {isListening ? "Stop dictation" : "Use speech-to-text"}
              </button>
            ) : null}
          </div>

          <textarea
            aria-label="Business narrative"
            className={`${fieldClassName} mt-4 min-h-52 resize-y`}
            name="narrativeInput"
            placeholder="Tell me what the team is doing today, what systems are involved, what is repetitive or fragile, what data is available, and what improvement you actually want."
            value={form.narrativeInput}
            onChange={(event) => updateField("narrativeInput", event.target.value)}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <ul className="space-y-1 text-sm text-slate-600">
              <li>&ldquo;Our support team answers the same questions repeatedly.&rdquo;</li>
              <li>&ldquo;We manually review invoices and enter them into our ERP.&rdquo;</li>
              <li>&ldquo;We want to predict which customers will churn.&rdquo;</li>
              <li>&ldquo;Leadership wants an AI chatbot but we are not sure why.&rdquo;</li>
            </ul>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {narrativeLength} characters
            </div>
          </div>
        </div>

        {phase === "followup" ? (
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className={fieldLabelClassName}>Adaptive Follow-Up</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                  I picked {adaptiveQuestions.length} follow-up questions based on what you wrote.
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This keeps the diagnostic focused on the real delivery decision instead of making you fill
                  out a long generic questionnaire.
                </p>
              </div>
              <button
                className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                type="button"
                onClick={() => setPhase("intake")}
              >
                Edit narrative
              </button>
            </div>

            {signalChips.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {signalChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="space-y-4">
              {adaptiveQuestions.map((question) => (
                <fieldset key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <legend className="max-w-3xl text-base font-semibold text-slate-900">{question.prompt}</legend>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{question.help}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{question.whyAsked}</p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {question.options.map((option) => {
                      const checked = form.answers[question.id] === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`block cursor-pointer rounded-xl border px-4 py-3 transition ${
                            checked
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                          }`}
                        >
                          <input
                            className="sr-only"
                            type="radio"
                            name={question.id}
                            value={option.value}
                            checked={checked}
                            onChange={() => updateAnswer(question.id, option.value)}
                          />
                          <span className="block text-sm font-semibold">{option.label}</span>
                          <span className={`mt-1 block text-sm leading-6 ${checked ? "text-slate-200" : "text-slate-600"}`}>
                            {option.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {phase === "intake" ? (
            <button
              className="focus-ring rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="button"
              onClick={handleContinue}
            >
              Continue
            </button>
          ) : (
            <>
              <button
                className="focus-ring rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                type="button"
                onClick={() => setPhase("intake")}
              >
                Back
              </button>
              <button
                className="focus-ring rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                type="submit"
                disabled={status === "running"}
              >
                {status === "running" ? "Building your memo..." : "Email my analysis"}
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
