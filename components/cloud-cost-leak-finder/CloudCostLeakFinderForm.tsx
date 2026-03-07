"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";

import {
  getCloudCostLeakFinderQuestion,
  selectCloudCostLeakFinderFollowUpQuestions,
  validateCloudCostLeakFinderFollowUpAnswers,
} from "@/lib/cloud-cost-leak-finder/adaptive";
import { CONSULTATION_CTA_PATH } from "@/lib/cloud-cost-leak-finder/config";
import { narrativeValidationMessage, normalizeFreeText, isAllowedCloudCostBusinessEmail } from "@/lib/cloud-cost-leak-finder/input";
import { extractCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import {
  cloudCostLeakFinderAnswersSchema,
  cloudCostLeakFinderSubmissionResponseSchema,
  type CloudProvider,
  type FollowUpQuestionId,
} from "@/lib/cloud-cost-leak-finder/types";

type CloudCostLeakFinderFormProps = {
  initialEmail?: string;
  initialName?: string;
};

type FormState = {
  email: string;
  fullName: string;
  companyName: string;
  roleTitle: string;
  website: string;
  primaryCloud: "" | CloudProvider;
  secondaryCloud: "" | CloudProvider;
  narrativeInput: string;
  billingSummaryInput: string;
  adaptiveAnswers: Partial<Record<FollowUpQuestionId, string>>;
};

const INITIAL_STATE: FormState = {
  email: "",
  fullName: "",
  companyName: "",
  roleTitle: "",
  website: "",
  primaryCloud: "",
  secondaryCloud: "",
  narrativeInput: "",
  billingSummaryInput: "",
  adaptiveAnswers: {},
};

const fieldClassName =
  "focus-ring block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]";
const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";
const STEP_TITLES = ["Company", "Cost story", "Follow-up"] as const;
const BASELINE_QUESTION_IDS: FollowUpQuestionId[] = [
  "monthlySpendBand",
  "workloadScope",
  "ownershipClarity",
  "budgetsAlerts",
  "customerCriticality",
];

const narrativeExamples = [
  "We run a SaaS app on AWS and our bill keeps rising even though usage is mostly flat.",
  "We have dev, test, and prod environments but I think non-prod is running 24/7.",
  "We are on Azure and pay for VMs, storage, and databases, but I do not know which parts are oversized.",
  "Our Kubernetes and database costs seem high and we are not sure if it is bad architecture or just growth.",
  "Leadership wants cloud costs reduced, but we need to know what to fix first without breaking production.",
] as const;

const productHighlights = [
  {
    title: "Narrative-first review",
    description: "Describe the environment in plain English first. The tool only asks a short set of relevant follow-ups after that.",
  },
  {
    title: "Billing paste is optional",
    description: "Rough service lists, copied cost rows, or top-spend notes all help. Perfect CSV is not required.",
  },
  {
    title: "Deterministic advisory memo",
    description: "You get a structured email with likely waste, first actions, savings range, and a consulting quote. No AI scoring.",
  },
] as const;

function trackAnalyticsEvent(name: string, params?: Record<string, string | number>) {
  if (typeof window === "undefined") {
    return;
  }

  const maybeWindow = window as Window & {
    gtag?: (...args: unknown[]) => void;
  };

  maybeWindow.gtag?.("event", name, params);
}

function ChoiceCard({
  checked,
  label,
  description,
  children,
}: {
  checked: boolean;
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <label
      className={`block rounded-xl border p-3 transition ${
        checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-900"
      }`}
    >
      <div className="flex items-start gap-3">
        {children}
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className={`mt-1 text-xs leading-5 ${checked ? "text-slate-200" : "text-slate-600"}`}>{description}</p>
        </div>
      </div>
    </label>
  );
}

function QuestionCard({
  label,
  detail,
  children,
}: {
  label: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function looksLikeWebsite(value: string) {
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(value.trim());
}

function buildPayload(form: FormState) {
  return {
    email: form.email.trim().toLowerCase(),
    fullName: form.fullName.trim(),
    companyName: form.companyName.trim(),
    roleTitle: form.roleTitle.trim(),
    website: form.website.trim(),
    primaryCloud: form.primaryCloud,
    secondaryCloud: form.secondaryCloud || undefined,
    narrativeInput: normalizeFreeText(form.narrativeInput),
    billingSummaryInput: form.billingSummaryInput.trim(),
    adaptiveAnswers: Object.fromEntries(
      Object.entries(form.adaptiveAnswers)
        .filter((entry): entry is [FollowUpQuestionId, string] => Boolean(entry[1]?.trim()))
        .map(([key, value]) => [key, value.trim()]),
    ) as Partial<Record<FollowUpQuestionId, string>>,
  };
}

export function CloudCostLeakFinderForm({
  initialEmail = "",
  initialName = "",
}: CloudCostLeakFinderFormProps) {
  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    email: initialEmail,
    fullName: initialName,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);
  const [hasTrackedAdaptiveStart, setHasTrackedAdaptiveStart] = useState(false);
  const [hasTrackedBillingSummaryPaste, setHasTrackedBillingSummaryPaste] = useState(false);
  const [result, setResult] = useState<
    | {
        status: "sent" | "fallback";
        verdictHeadline: string;
        savingsRangeLine?: string;
        reason?: string;
      }
    | null
  >(null);

  useEffect(() => {
    trackAnalyticsEvent("cloud_cost_leak_finder_page_viewed");
  }, []);

  function markStarted() {
    if (hasTrackedStart) {
      return;
    }

    setHasTrackedStart(true);
    trackAnalyticsEvent("cloud_cost_leak_finder_form_started");
  }

  function setStringField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    markStarted();
    setError(null);
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const payload = buildPayload(form);
  const adaptiveQuestionSource =
    form.primaryCloud && payload.narrativeInput
      ? cloudCostLeakFinderAnswersSchema.safeParse({
          ...payload,
          primaryCloud: payload.primaryCloud,
        })
      : null;
  const adaptiveQuestions =
    adaptiveQuestionSource?.success
      ? selectCloudCostLeakFinderFollowUpQuestions(extractCloudCostSignals(adaptiveQuestionSource.data))
      : BASELINE_QUESTION_IDS.map((id) => getCloudCostLeakFinderQuestion(id));

  function validateCompanyStep() {
    if (!payload.email) {
      return "Enter your business email.";
    }

    if (!z.string().email().safeParse(payload.email).success) {
      return "Enter a valid business email address.";
    }

    if (!isAllowedCloudCostBusinessEmail(payload.email)) {
      return "Personal email domains are not allowed. Use your business email.";
    }

    if (!payload.fullName) {
      return "Enter your full name.";
    }

    if (!payload.companyName) {
      return "Enter your company name.";
    }

    if (!payload.roleTitle) {
      return "Enter your role or title.";
    }

    if (!payload.website) {
      return "Enter your company website or domain.";
    }

    if (!looksLikeWebsite(payload.website)) {
      return "Enter a valid company website or domain.";
    }

    if (!payload.primaryCloud) {
      return "Select the primary cloud provider.";
    }

    if (payload.secondaryCloud && payload.secondaryCloud === payload.primaryCloud) {
      return "Choose a different secondary cloud or leave it blank.";
    }

    return null;
  }

  function validateStoryStep() {
    if (!payload.narrativeInput) {
      return "Describe your cloud environment before continuing.";
    }

    const narrativeMessage = narrativeValidationMessage(payload.narrativeInput);
    if (narrativeMessage) {
      return narrativeMessage;
    }

    if (payload.billingSummaryInput.length > 0 && !hasTrackedBillingSummaryPaste) {
      setHasTrackedBillingSummaryPaste(true);
      trackAnalyticsEvent("cloud_cost_leak_finder_billing_summary_pasted");
    }

    return null;
  }

  function validateFollowUpStep() {
    return validateCloudCostLeakFinderFollowUpAnswers(adaptiveQuestions, payload.adaptiveAnswers);
  }

  async function nextStep() {
    const stepError =
      currentStep === 0 ? validateCompanyStep() : currentStep === 1 ? validateStoryStep() : validateFollowUpStep();

    if (stepError) {
      setError(stepError);
      return;
    }

    if (currentStep === 1 && !hasTrackedAdaptiveStart) {
      setHasTrackedAdaptiveStart(true);
      trackAnalyticsEvent("cloud_cost_leak_finder_adaptive_follow_up_started");
    }

    setError(null);
    setCurrentStep((step) => Math.min(step + 1, STEP_TITLES.length - 1));
  }

  function previousStep() {
    setError(null);
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const stepError = validateFollowUpStep();
    if (stepError) {
      setError(stepError);
      return;
    }

    const submissionPayload = {
      ...payload,
      adaptiveAnswers: Object.fromEntries(
        adaptiveQuestions
          .map((question) => [question.id, payload.adaptiveAnswers[question.id]])
          .filter((entry): entry is [FollowUpQuestionId, string] => Boolean(entry[1])),
      ),
    };

    const parsed = cloudCostLeakFinderAnswersSchema.safeParse(submissionPayload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Please review the required fields and try again.");
      return;
    }

    if (!isAllowedCloudCostBusinessEmail(parsed.data.email)) {
      setError("Personal email domains are not allowed. Use your business email.");
      return;
    }

    const narrativeMessage = narrativeValidationMessage(parsed.data.narrativeInput);
    if (narrativeMessage) {
      setError(narrativeMessage);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/submit-cloud-cost-leak-finder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const responseBody = (await response.json()) as unknown;
      const validated = cloudCostLeakFinderSubmissionResponseSchema.safeParse(responseBody);

      if (!validated.success) {
        setError("Unexpected response from the server. Please retry.");
        return;
      }

      if ("error" in validated.data) {
        setError(validated.data.error);
        return;
      }

      if (!response.ok) {
        setError("Unable to submit the cost review right now.");
        return;
      }

      setResult(validated.data);
      trackAnalyticsEvent("cloud_cost_leak_finder_form_completed");
      if (validated.data.status === "sent") {
        trackAnalyticsEvent("cloud_cost_leak_finder_email_sent");
      }
    } catch {
      setError("Network error while submitting the cost review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="surface lift-card rounded-2xl p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cloud Cost Leak Finder</p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-slate-900">
          {result.status === "sent" ? "Your cost review has been emailed." : "Submission received"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{result.verdictHeadline}</p>
        {result.savingsRangeLine ? (
          <p className="mt-2 text-sm font-semibold text-slate-900">{result.savingsRangeLine}</p>
        ) : null}
        {result.status === "fallback" && result.reason ? (
          <p className="mt-3 text-sm text-amber-700">{result.reason}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={CONSULTATION_CTA_PATH}
            onClick={() => trackAnalyticsEvent("cloud_cost_leak_finder_consultation_cta_clicked")}
            className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Book consultation
          </Link>
          <button
            type="button"
            onClick={() => {
              setForm({
                ...INITIAL_STATE,
                email: form.email,
                fullName: form.fullName,
              });
              setCurrentStep(0);
              setError(null);
              setResult(null);
              setHasTrackedAdaptiveStart(false);
              setHasTrackedBillingSummaryPaste(false);
            }}
            className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Run another review
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="glass-surface rounded-2xl p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Cloud Cost Leak Finder</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl font-semibold text-slate-900">Find where your cloud bill is leaking money.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Describe the environment, paste whatever cost summary you have, answer a short set of relevant follow-up
              questions, and get the full advisory memo by email.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Timing</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">About 3 to 5 minutes</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Free</span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Business email only</span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Results by email</span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Deterministic memo</span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">No AI scoring</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {productHighlights.map((highlight) => (
            <div key={highlight.title} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">{highlight.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{highlight.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface lift-card rounded-2xl p-6 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Step {currentStep + 1} of {STEP_TITLES.length}
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold text-slate-900">{STEP_TITLES[currentStep]}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {currentStep === 0
                ? "Where results should go, which cloud matters most, and who this review is for."
                : currentStep === 1
                  ? "Describe the environment in plain English. The follow-up questions only appear after this step."
                  : "A short adaptive set of questions based on the narrative and billing clues you already gave."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STEP_TITLES.map((title, index) => (
              <span
                key={title}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  index === currentStep
                    ? "border-slate-900 bg-slate-900 text-white"
                    : index < currentStep
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-slate-100 text-slate-600"
                }`}
              >
                {title}
              </span>
            ))}
          </div>
        </div>

        {currentStep === 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Business email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setStringField("email", event.target.value)}
                autoComplete="email"
                className={fieldClassName}
                placeholder="you@company.com"
              />
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Full name</span>
              <input
                value={form.fullName}
                onChange={(event) => setStringField("fullName", event.target.value)}
                autoComplete="name"
                className={fieldClassName}
                placeholder="Jane Doe"
              />
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Company name</span>
              <input
                value={form.companyName}
                onChange={(event) => setStringField("companyName", event.target.value)}
                className={fieldClassName}
                placeholder="Acme Cloud"
              />
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Role or title</span>
              <input
                value={form.roleTitle}
                onChange={(event) => setStringField("roleTitle", event.target.value)}
                className={fieldClassName}
                placeholder="CTO"
              />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className={fieldLabelClassName}>Company website or domain</span>
              <input
                value={form.website}
                onChange={(event) => setStringField("website", event.target.value)}
                className={fieldClassName}
                placeholder="acmecloud.com"
              />
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Primary cloud provider</span>
              <select
                value={form.primaryCloud}
                onChange={(event) => setStringField("primaryCloud", event.target.value as FormState["primaryCloud"])}
                className={fieldClassName}
              >
                <option value="">Select one</option>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">GCP</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Secondary cloud (optional)</span>
              <select
                value={form.secondaryCloud}
                onChange={(event) => setStringField("secondaryCloud", event.target.value as FormState["secondaryCloud"])}
                className={fieldClassName}
              >
                <option value="">None</option>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">GCP</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        ) : null}

        {currentStep === 1 ? (
          <div className="mt-6 space-y-5">
            <label className="space-y-1">
              <span className={fieldLabelClassName}>
                Describe your cloud environment, what you think is driving cost, what workloads you run, and what is frustrating you most.
              </span>
              <textarea
                value={form.narrativeInput}
                onChange={(event) => setStringField("narrativeInput", event.target.value)}
                className={`${fieldClassName} min-h-44`}
                placeholder="Tell us what is in the environment, what keeps getting expensive, and what you want clarified first."
              />
            </label>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Helpful examples</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {narrativeExamples.map((example) => (
                  <li key={example}>&quot;{example}&quot;</li>
                ))}
              </ul>
            </div>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>
                Optional: paste your top services, rough monthly spend, or a cost summary from AWS / Azure / GCP.
              </span>
              <textarea
                value={form.billingSummaryInput}
                onChange={(event) => setStringField("billingSummaryInput", event.target.value)}
                className={`${fieldClassName} min-h-36`}
                placeholder={"EC2 $4,200\nRDS $2,100\nNAT Gateway $650\nS3 $400"}
              />
              <p className="text-xs leading-5 text-slate-500">
                Rough human-pasted text is fine. Service names with dollar amounts, copied billing rows, and simple CSV-like
                lines all work.
              </p>
            </label>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="mt-6 space-y-4">
            {adaptiveQuestions.map((question) => (
              <QuestionCard key={question.id} label={question.label} detail={question.detail}>
                <div className="grid gap-3 md:grid-cols-3">
                  {question.options.map((option) => {
                    const checked = form.adaptiveAnswers[question.id] === option.value;
                    return (
                      <ChoiceCard
                        key={`${question.id}-${option.value}`}
                        checked={checked}
                        label={option.label}
                        description={option.description}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.value}
                          checked={checked}
                          onChange={(event) => {
                            markStarted();
                            setError(null);
                            setForm((current) => ({
                              ...current,
                              adaptiveAnswers: {
                                ...current.adaptiveAnswers,
                                [question.id]: event.target.value,
                              },
                            }));
                          }}
                          className="mt-1 size-4"
                        />
                      </ChoiceCard>
                    );
                  })}
                </div>
              </QuestionCard>
            ))}
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {currentStep > 0 ? (
            <button
              type="button"
              onClick={previousStep}
              className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Back
            </button>
          ) : null}

          {currentStep < STEP_TITLES.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Next step
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Emailing review..." : "Email my cost review"}
            </button>
          )}
        </div>
      </section>
    </form>
  );
}
