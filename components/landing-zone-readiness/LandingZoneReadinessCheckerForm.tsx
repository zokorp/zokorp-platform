"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { z } from "zod";

import { CONSULTATION_CTA_PATH } from "@/lib/landing-zone-readiness/config";
import { isAllowedLandingZoneBusinessEmail } from "@/lib/landing-zone-readiness/input";
import {
  landingZoneReadinessAnswersBaseSchema,
  landingZoneReadinessAnswersSchema,
  landingZoneReadinessSubmissionResponseSchema,
} from "@/lib/landing-zone-readiness/types";

type FormState = {
  email: string;
  fullName: string;
  companyName: string;
  roleTitle: string;
  website: string;
  primaryCloud: "" | "aws" | "azure" | "gcp";
  secondaryCloud: "" | "aws" | "azure" | "gcp";
  numberOfEnvironments: "" | "1" | "2" | "3" | "4_plus";
  numberOfRegions: "" | "1" | "2_3" | "4_plus";
  employeeCount: "" | "1_25" | "26_100" | "101_500" | "500_plus";
  engineeringTeamSize: "" | "1_5" | "6_20" | "21_50" | "51_plus";
  handlesSensitiveData: boolean | null;
  hasSso: "" | "yes" | "partial" | "no";
  enforcesMfa: "" | "yes" | "partial" | "no";
  centralizedIdentity: "" | "yes" | "partial" | "no";
  breakGlassProcess: "" | "yes" | "partial" | "no";
  documentedRbac: "" | "yes" | "partial" | "no";
  serviceAccountHygiene: "" | "yes" | "partial" | "no";
  usesOrgHierarchy: "" | "yes" | "partial" | "no";
  separateCloudAccounts: "" | "yes" | "partial" | "no";
  sharedServicesModel: "" | "yes" | "partial" | "no";
  guardrailsPolicy: "" | "yes" | "partial" | "no";
  standardNetworkArchitecture: "" | "yes" | "partial" | "no";
  productionIsolation: "" | "yes" | "partial" | "no";
  ingressEgressControls: "" | "yes" | "partial" | "no";
  privateConnectivity: "" | "yes" | "partial" | "no";
  documentedDnsStrategy: "" | "yes" | "partial" | "no";
  networkCleanup: "" | "yes" | "partial" | "no";
  secretsManagement: "" | "yes" | "partial" | "no";
  keyManagement: "" | "yes" | "partial" | "no";
  baselineSecurityLogging: "" | "yes" | "partial" | "no";
  vulnerabilityScanning: "" | "yes" | "partial" | "no";
  privilegeReviews: "" | "yes" | "partial" | "no";
  patchingOwnership: "" | "yes" | "partial" | "no";
  centralizedLogs: "" | "yes" | "partial" | "no";
  metricsDashboards: "" | "yes" | "partial" | "no";
  alertingCoverage: "" | "yes" | "partial" | "no";
  runbooks: "" | "yes" | "partial" | "no";
  onCallOwnership: "" | "yes" | "partial" | "no";
  incidentResponseProcess: "" | "yes" | "partial" | "no";
  backupCoverage: "" | "yes" | "partial" | "no";
  restoreTesting: "" | "yes" | "partial" | "no";
  definedRecoveryTargets: "" | "yes" | "partial" | "no";
  crossRegionResilience: "" | "yes" | "partial" | "no";
  drDocumentation: "" | "yes" | "partial" | "no";
  infrastructureAsCode: "" | "yes" | "partial" | "no";
  changesViaCiCd: "" | "yes" | "partial" | "no";
  manualProductionChanges: "" | "blocked" | "emergency_only" | "allowed";
  codeReviewRequired: "" | "yes" | "partial" | "no";
  driftDetection: "" | "yes" | "partial" | "no";
  taggingStandard: "" | "yes" | "partial" | "no";
  budgetAlerts: "" | "yes" | "partial" | "no";
  resourceOwnership: "" | "yes" | "partial" | "no";
  lifecycleCleanup: "" | "yes" | "partial" | "no";
  nonProdShutdown: "" | "yes" | "partial" | "no";
  clearEnvironmentSeparation: "" | "yes" | "partial" | "no";
  biggestChallenge: string;
};

type LandingZoneReadinessCheckerFormProps = {
  initialEmail?: string;
  initialName?: string;
};

type StepDefinition = {
  id: string;
  title: string;
  description: string;
};

const STEPS: StepDefinition[] = [
  {
    id: "company",
    title: "Company",
    description: "Who you are, where results should go, and which cloud you use most.",
  },
  {
    id: "basics",
    title: "Basics",
    description: "A few size and environment questions so the score reflects the real operating context.",
  },
  {
    id: "identity",
    title: "Identity",
    description: "How access, account structure, and guardrails are handled today.",
  },
  {
    id: "network",
    title: "Network and security",
    description: "The core network and baseline security controls that make a landing zone usable.",
  },
  {
    id: "operations",
    title: "Operations and recovery",
    description: "Visibility, response readiness, backups, and recovery discipline.",
  },
  {
    id: "delivery",
    title: "Delivery and cost",
    description: "How changes reach production and how spend is kept under control.",
  },
];

const INITIAL_STATE: FormState = {
  email: "",
  fullName: "",
  companyName: "",
  roleTitle: "",
  website: "",
  primaryCloud: "",
  secondaryCloud: "",
  numberOfEnvironments: "",
  numberOfRegions: "",
  employeeCount: "",
  engineeringTeamSize: "",
  handlesSensitiveData: null,
  hasSso: "",
  enforcesMfa: "",
  centralizedIdentity: "",
  breakGlassProcess: "",
  documentedRbac: "",
  serviceAccountHygiene: "",
  usesOrgHierarchy: "",
  separateCloudAccounts: "",
  sharedServicesModel: "",
  guardrailsPolicy: "",
  standardNetworkArchitecture: "",
  productionIsolation: "",
  ingressEgressControls: "",
  privateConnectivity: "",
  documentedDnsStrategy: "",
  networkCleanup: "",
  secretsManagement: "",
  keyManagement: "",
  baselineSecurityLogging: "",
  vulnerabilityScanning: "",
  privilegeReviews: "",
  patchingOwnership: "",
  centralizedLogs: "",
  metricsDashboards: "",
  alertingCoverage: "",
  runbooks: "",
  onCallOwnership: "",
  incidentResponseProcess: "",
  backupCoverage: "",
  restoreTesting: "",
  definedRecoveryTargets: "",
  crossRegionResilience: "",
  drDocumentation: "",
  infrastructureAsCode: "",
  changesViaCiCd: "",
  manualProductionChanges: "",
  codeReviewRequired: "",
  driftDetection: "",
  taggingStandard: "",
  budgetAlerts: "",
  resourceOwnership: "",
  lifecycleCleanup: "",
  nonProdShutdown: "",
  clearEnvironmentSeparation: "",
  biggestChallenge: "",
};

const fieldClassName =
  "focus-ring block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]";
const fieldLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500";

const yesPartialNoOptions = [
  { value: "yes", label: "Yes", description: "This is in place and used consistently." },
  { value: "partial", label: "Partly", description: "It exists, but not everywhere or not reliably." },
  { value: "no", label: "No", description: "This is missing, informal, or we are not sure." },
] as const;

function firstIssueMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Please review the highlighted fields.";
}

function buildPayload(form: FormState) {
  return {
    ...form,
    email: form.email.trim().toLowerCase(),
    fullName: form.fullName.trim(),
    companyName: form.companyName.trim(),
    roleTitle: form.roleTitle.trim(),
    website: form.website.trim(),
    biggestChallenge: form.biggestChallenge.trim(),
    primaryCloud: form.primaryCloud || undefined,
    secondaryCloud: form.secondaryCloud || undefined,
  };
}

const stepValidators = [
  landingZoneReadinessAnswersBaseSchema.pick({
    email: true,
    fullName: true,
    companyName: true,
    roleTitle: true,
    website: true,
    primaryCloud: true,
    secondaryCloud: true,
  }),
  landingZoneReadinessAnswersBaseSchema.pick({
    numberOfEnvironments: true,
    numberOfRegions: true,
    employeeCount: true,
    engineeringTeamSize: true,
    handlesSensitiveData: true,
    clearEnvironmentSeparation: true,
  }),
  landingZoneReadinessAnswersBaseSchema.pick({
    hasSso: true,
    enforcesMfa: true,
    centralizedIdentity: true,
    breakGlassProcess: true,
    documentedRbac: true,
    serviceAccountHygiene: true,
    usesOrgHierarchy: true,
    separateCloudAccounts: true,
    sharedServicesModel: true,
    guardrailsPolicy: true,
  }),
  landingZoneReadinessAnswersBaseSchema.pick({
    standardNetworkArchitecture: true,
    productionIsolation: true,
    ingressEgressControls: true,
    privateConnectivity: true,
    documentedDnsStrategy: true,
    networkCleanup: true,
    secretsManagement: true,
    keyManagement: true,
    baselineSecurityLogging: true,
    vulnerabilityScanning: true,
    privilegeReviews: true,
    patchingOwnership: true,
  }),
  landingZoneReadinessAnswersBaseSchema.pick({
    centralizedLogs: true,
    metricsDashboards: true,
    alertingCoverage: true,
    runbooks: true,
    onCallOwnership: true,
    incidentResponseProcess: true,
    backupCoverage: true,
    restoreTesting: true,
    definedRecoveryTargets: true,
    crossRegionResilience: true,
    drDocumentation: true,
  }),
  landingZoneReadinessAnswersBaseSchema.pick({
    infrastructureAsCode: true,
    changesViaCiCd: true,
    manualProductionChanges: true,
    codeReviewRequired: true,
    driftDetection: true,
    taggingStandard: true,
    budgetAlerts: true,
    resourceOwnership: true,
    lifecycleCleanup: true,
    nonProdShutdown: true,
    biggestChallenge: true,
  }),
];

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
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function LandingZoneReadinessCheckerForm({
  initialEmail = "",
  initialName = "",
}: LandingZoneReadinessCheckerFormProps) {
  const [form, setForm] = useState<FormState>({
    ...INITIAL_STATE,
    email: initialEmail,
    fullName: initialName,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTrackedStart, setHasTrackedStart] = useState(false);
  const [result, setResult] = useState<
    | {
        status: "sent" | "fallback";
        overallScore: number;
        maturityBand: string;
        quoteTier: string;
        reason?: string;
      }
    | null
  >(null);

  function markStarted() {
    if (hasTrackedStart) {
      return;
    }

    setHasTrackedStart(true);
    trackAnalyticsEvent("landing_zone_form_started");
  }

  function setStringField<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    markStarted();
    setError(null);
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateCurrentStep() {
    const payload = buildPayload(form);
    const validator = stepValidators[currentStep];
    const parsed = validator.safeParse(payload);

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return false;
    }

    if (currentStep === 0 && !isAllowedLandingZoneBusinessEmail(payload.email)) {
      setError("Personal email domains are not allowed. Use your business email.");
      return false;
    }

    setError(null);
    return true;
  }

  async function nextStep() {
    if (!validateCurrentStep()) {
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
  }

  function previousStep() {
    setError(null);
    setCurrentStep((step) => Math.max(step - 1, 0));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = buildPayload(form);
    const parsed = landingZoneReadinessAnswersSchema.safeParse(payload);

    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error));
      return;
    }

    if (!isAllowedLandingZoneBusinessEmail(parsed.data.email)) {
      setError("Personal email domains are not allowed. Use your business email.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/submit-landing-zone-readiness", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsed.data),
      });

      const responseBody = (await response.json()) as unknown;
      const validated = landingZoneReadinessSubmissionResponseSchema.safeParse(responseBody);

      if (!validated.success) {
        setError("Unexpected response from the server. Please retry.");
        return;
      }

      if ("error" in validated.data) {
        setError(validated.data.error);
        return;
      }

      if (!response.ok) {
        setError("Unable to submit the readiness check.");
        return;
      }

      setResult(validated.data);
      trackAnalyticsEvent("landing_zone_form_completed", {
        overall_score: validated.data.overallScore,
      });
    } catch {
      setError("Network error while submitting the readiness check.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentStepMeta = STEPS[currentStep];

  if (result) {
    return (
      <section className="surface lift-card rounded-2xl p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Landing Zone Readiness Checker</p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-slate-900">
          {result.status === "sent" ? "Your results have been emailed" : "Submission received"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          Check your email for the full report. This page intentionally stays short and does not show the detailed findings.
        </p>
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {result.overallScore}/100 · {result.maturityBand} · {result.quoteTier}
        </div>
        {result.status === "fallback" && result.reason ? (
          <p className="mt-3 text-sm text-amber-700">{result.reason}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={CONSULTATION_CTA_PATH}
            onClick={() => trackAnalyticsEvent("landing_zone_consultation_cta_clicked")}
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
              setResult(null);
              setError(null);
            }}
            className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Run another check
          </button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="glass-surface rounded-2xl p-6 md:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Landing Zone Readiness Checker</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h2 className="font-display text-3xl font-semibold text-slate-900">Free cloud foundation check for real SMB environments</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Answer structured questions, get a deterministic readiness score, and receive the full report plus a quote by email.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Timing</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">About 4 to 7 minutes</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-600">
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Free</span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Business email only</span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Results by email</span>
          <span className="rounded-full border border-slate-300 bg-white px-3 py-1">Deterministic quote</span>
        </div>
      </section>

      <section className="surface lift-card rounded-2xl p-6 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Step {currentStep + 1} of {STEPS.length}
            </p>
            <h3 className="font-display mt-1 text-2xl font-semibold text-slate-900">{currentStepMeta.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{currentStepMeta.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STEPS.map((step, index) => (
              <span
                key={step.id}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                  index === currentStep
                    ? "border-slate-900 bg-slate-900 text-white"
                    : index < currentStep
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-slate-100 text-slate-600"
                }`}
              >
                {step.title}
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
              <span className={fieldLabelClassName}>Primary cloud</span>
              <select
                value={form.primaryCloud}
                onChange={(event) => setStringField("primaryCloud", event.target.value as FormState["primaryCloud"])}
                className={fieldClassName}
              >
                <option value="">Select one</option>
                <option value="aws">AWS</option>
                <option value="azure">Azure</option>
                <option value="gcp">GCP</option>
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
              </select>
            </label>
          </div>
        ) : null}

        {currentStep === 1 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className={fieldLabelClassName}>How many environments do you actively use?</span>
              <select
                value={form.numberOfEnvironments}
                onChange={(event) =>
                  setStringField("numberOfEnvironments", event.target.value as FormState["numberOfEnvironments"])
                }
                className={fieldClassName}
              >
                <option value="">Select one</option>
                <option value="1">One</option>
                <option value="2">Two</option>
                <option value="3">Three</option>
                <option value="4_plus">Four or more</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>How many regions are in scope?</span>
              <select
                value={form.numberOfRegions}
                onChange={(event) => setStringField("numberOfRegions", event.target.value as FormState["numberOfRegions"])}
                className={fieldClassName}
              >
                <option value="">Select one</option>
                <option value="1">One</option>
                <option value="2_3">Two to three</option>
                <option value="4_plus">Four or more</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Approximate employee count</span>
              <select
                value={form.employeeCount}
                onChange={(event) => setStringField("employeeCount", event.target.value as FormState["employeeCount"])}
                className={fieldClassName}
              >
                <option value="">Select one</option>
                <option value="1_25">1 to 25</option>
                <option value="26_100">26 to 100</option>
                <option value="101_500">101 to 500</option>
                <option value="500_plus">500+</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabelClassName}>Engineering team size</span>
              <select
                value={form.engineeringTeamSize}
                onChange={(event) =>
                  setStringField("engineeringTeamSize", event.target.value as FormState["engineeringTeamSize"])
                }
                className={fieldClassName}
              >
                <option value="">Select one</option>
                <option value="1_5">1 to 5</option>
                <option value="6_20">6 to 20</option>
                <option value="21_50">21 to 50</option>
                <option value="51_plus">51+</option>
              </select>
            </label>

            <QuestionCard
              label="Do you handle regulated or sensitive data?"
              detail="Examples: customer financial data, health information, regulated workloads, or high-sensitivity internal data."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard checked={form.handlesSensitiveData === true} label="Yes" description="Controls need to be stronger and more consistent.">
                    <input
                      type="radio"
                      name="handlesSensitiveData"
                      value="yes"
                      checked={form.handlesSensitiveData === true}
                      onChange={() => setStringField("handlesSensitiveData", true)}
                    />
                </ChoiceCard>
                <ChoiceCard checked={form.handlesSensitiveData === false} label="No" description="Still important, but the baseline is less demanding.">
                    <input
                      type="radio"
                      name="handlesSensitiveData"
                      value="no"
                      checked={form.handlesSensitiveData === false}
                      onChange={() => setStringField("handlesSensitiveData", false)}
                    />
                </ChoiceCard>
              </div>
            </QuestionCard>

            <QuestionCard
              label="Are dev, test/stage, and prod clearly separated?"
              detail="This means people, resources, and change paths are not blurred together."
            >
              <div className="grid gap-3 md:grid-cols-3">
                {yesPartialNoOptions.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    checked={form.clearEnvironmentSeparation === option.value}
                    label={option.label}
                    description={option.description}
                  >
                    <input
                      type="radio"
                      name="clearEnvironmentSeparation"
                      value={option.value}
                      checked={form.clearEnvironmentSeparation === option.value}
                      onChange={() => setStringField("clearEnvironmentSeparation", option.value)}
                    />
                  </ChoiceCard>
                ))}
              </div>
            </QuestionCard>
          </div>
        ) : null}

        {currentStep === 2 ? (
          <div className="mt-6 space-y-4">
            <QuestionCard label="Is SSO in place for workforce access?" detail="One company-controlled login path is easier to secure and offboard.">
              <div className="grid gap-3 md:grid-cols-3">
                {yesPartialNoOptions.map((option) => (
                  <ChoiceCard key={option.value} checked={form.hasSso === option.value} label={option.label} description={option.description}>
                    <input type="radio" name="hasSso" value={option.value} checked={form.hasSso === option.value} onChange={() => setStringField("hasSso", option.value)} />
                  </ChoiceCard>
                ))}
              </div>
            </QuestionCard>
            <QuestionCard label="Is MFA enforced?" detail="Especially for admins, production access, and console sign-in.">
              <div className="grid gap-3 md:grid-cols-3">
                {yesPartialNoOptions.map((option) => (
                  <ChoiceCard key={option.value} checked={form.enforcesMfa === option.value} label={option.label} description={option.description}>
                    <input type="radio" name="enforcesMfa" value={option.value} checked={form.enforcesMfa === option.value} onChange={() => setStringField("enforcesMfa", option.value)} />
                  </ChoiceCard>
                ))}
              </div>
            </QuestionCard>
            <QuestionCard label="Is identity managed centrally?" detail="For example, one identity source tied into your cloud roles and groups.">
              <div className="grid gap-3 md:grid-cols-3">
                {yesPartialNoOptions.map((option) => (
                  <ChoiceCard key={option.value} checked={form.centralizedIdentity === option.value} label={option.label} description={option.description}>
                    <input type="radio" name="centralizedIdentity" value={option.value} checked={form.centralizedIdentity === option.value} onChange={() => setStringField("centralizedIdentity", option.value)} />
                  </ChoiceCard>
                ))}
              </div>
            </QuestionCard>
            <QuestionCard label="Do you have a break-glass access process?" detail="Emergency access should be controlled, monitored, and rare.">
              <div className="grid gap-3 md:grid-cols-3">
                {yesPartialNoOptions.map((option) => (
                  <ChoiceCard key={option.value} checked={form.breakGlassProcess === option.value} label={option.label} description={option.description}>
                    <input type="radio" name="breakGlassProcess" value={option.value} checked={form.breakGlassProcess === option.value} onChange={() => setStringField("breakGlassProcess", option.value)} />
                  </ChoiceCard>
                ))}
              </div>
            </QuestionCard>
            <QuestionCard label="Is your RBAC model documented?" detail="People should know which roles exist and who is allowed into them.">
              <div className="grid gap-3 md:grid-cols-3">
                {yesPartialNoOptions.map((option) => (
                  <ChoiceCard key={option.value} checked={form.documentedRbac === option.value} label={option.label} description={option.description}>
                    <input type="radio" name="documentedRbac" value={option.value} checked={form.documentedRbac === option.value} onChange={() => setStringField("documentedRbac", option.value)} />
                  </ChoiceCard>
                ))}
              </div>
            </QuestionCard>
            <QuestionCard label="Is service account hygiene under control?" detail="Non-human identities should be reviewed, rotated, and tightly scoped.">
              <div className="grid gap-3 md:grid-cols-3">
                {yesPartialNoOptions.map((option) => (
                  <ChoiceCard key={option.value} checked={form.serviceAccountHygiene === option.value} label={option.label} description={option.description}>
                    <input type="radio" name="serviceAccountHygiene" value={option.value} checked={form.serviceAccountHygiene === option.value} onChange={() => setStringField("serviceAccountHygiene", option.value)} />
                  </ChoiceCard>
                ))}
              </div>
            </QuestionCard>
            <div className="grid gap-4 md:grid-cols-2">
              <QuestionCard label="Do you use org-level hierarchy?" detail="Examples: AWS Organizations, Azure Management Groups, GCP folders and projects.">
                <div className="grid gap-3">
                  {yesPartialNoOptions.map((option) => (
                    <ChoiceCard key={option.value} checked={form.usesOrgHierarchy === option.value} label={option.label} description={option.description}>
                      <input type="radio" name="usesOrgHierarchy" value={option.value} checked={form.usesOrgHierarchy === option.value} onChange={() => setStringField("usesOrgHierarchy", option.value)} />
                    </ChoiceCard>
                  ))}
                </div>
              </QuestionCard>
              <QuestionCard label="Are environments split by account, subscription, or project?" detail="This reduces blast radius and makes policy easier to apply.">
                <div className="grid gap-3">
                  {yesPartialNoOptions.map((option) => (
                    <ChoiceCard key={option.value} checked={form.separateCloudAccounts === option.value} label={option.label} description={option.description}>
                      <input type="radio" name="separateCloudAccounts" value={option.value} checked={form.separateCloudAccounts === option.value} onChange={() => setStringField("separateCloudAccounts", option.value)} />
                    </ChoiceCard>
                  ))}
                </div>
              </QuestionCard>
              <QuestionCard label="Is there a shared services model?" detail="Shared networking, identity, logging, and tooling should have clear boundaries and ownership.">
                <div className="grid gap-3">
                  {yesPartialNoOptions.map((option) => (
                    <ChoiceCard key={option.value} checked={form.sharedServicesModel === option.value} label={option.label} description={option.description}>
                      <input type="radio" name="sharedServicesModel" value={option.value} checked={form.sharedServicesModel === option.value} onChange={() => setStringField("sharedServicesModel", option.value)} />
                    </ChoiceCard>
                  ))}
                </div>
              </QuestionCard>
              <QuestionCard label="Are guardrails inherited from the top?" detail="Baseline policy should be applied centrally, not rebuilt by hand every time.">
                <div className="grid gap-3">
                  {yesPartialNoOptions.map((option) => (
                    <ChoiceCard key={option.value} checked={form.guardrailsPolicy === option.value} label={option.label} description={option.description}>
                      <input type="radio" name="guardrailsPolicy" value={option.value} checked={form.guardrailsPolicy === option.value} onChange={() => setStringField("guardrailsPolicy", option.value)} />
                    </ChoiceCard>
                  ))}
                </div>
              </QuestionCard>
            </div>
          </div>
        ) : null}

        {currentStep === 3 ? (
          <div className="mt-6 space-y-4">
            {[
              ["standardNetworkArchitecture", "Do you use a standard network pattern?", "Examples: hub-and-spoke or another repeatable design."],
              ["productionIsolation", "Is production isolated from non-prod?", "Traffic and admin paths should not be loosely shared."],
              ["ingressEgressControls", "Are ingress and egress controls defined?", "Entry and exit paths should be intentional, not broad and open."],
              ["privateConnectivity", "Do you use private connectivity where it is needed?", "Sensitive or internal traffic should avoid unnecessary public paths."],
              ["documentedDnsStrategy", "Is your DNS strategy documented?", "Ownership, naming, and public/private split should be clear."],
              ["networkCleanup", "Do you remove stale network objects?", "Unused rules, peers, routes, and test objects create drift and risk."],
              ["secretsManagement", "Do you use managed secrets storage?", "Secrets should not live in code, chat, or ad hoc config files."],
              ["keyManagement", "Is key management defined?", "Encryption keys should have clear ownership and lifecycle."],
              ["baselineSecurityLogging", "Is baseline security logging enabled?", "Control-plane, audit, and identity logs should be turned on."],
              ["vulnerabilityScanning", "Is vulnerability scanning running consistently?", "Hosts, images, and dependencies should be checked routinely."],
              ["privilegeReviews", "Do you review privileged access regularly?", "Admin rights should be reviewed instead of accumulating forever."],
              ["patchingOwnership", "Is patching ownership clear?", "Teams should know who patches what and how fast."],
            ].map(([field, label, detail]) => (
              <QuestionCard key={field} label={label} detail={detail}>
                <div className="grid gap-3 md:grid-cols-3">
                  {yesPartialNoOptions.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      checked={form[field as keyof FormState] === option.value}
                      label={option.label}
                      description={option.description}
                    >
                      <input
                        type="radio"
                        name={field}
                        value={option.value}
                        checked={form[field as keyof FormState] === option.value}
                        onChange={() => setStringField(field as keyof FormState, option.value as never)}
                      />
                    </ChoiceCard>
                  ))}
                </div>
              </QuestionCard>
            ))}
          </div>
        ) : null}

        {currentStep === 4 ? (
          <div className="mt-6 space-y-4">
            {[
              ["centralizedLogs", "Are logs centralized?", "Important logs should land in one searchable place."],
              ["metricsDashboards", "Do you have usable metrics dashboards?", "Teams should be able to see health without hunting around."],
              ["alertingCoverage", "Is alerting in place for real production risk?", "Alerts should map to service impact, not just noise."],
              ["runbooks", "Do you have runbooks?", "Simple outage and recovery instructions speed up response."],
              ["onCallOwnership", "Is on-call ownership clear?", "Every critical service needs a clear owner."],
              ["incidentResponseProcess", "Do you have an incident response process?", "People should know how incidents are declared and handled."],
              ["backupCoverage", "Do backups cover critical systems?", "The important data and configs need to be in scope."],
              ["restoreTesting", "Do you test restores?", "A backup without restore testing is not a recovery plan."],
              ["definedRecoveryTargets", "Are RTO and RPO defined?", "Recovery expectations should be explicit."],
              ["crossRegionResilience", "Do you have cross-region resilience where needed?", "Only where workload criticality actually requires it."],
              ["drDocumentation", "Is DR documented?", "Failover and restore steps should exist before an incident."],
            ].map(([field, label, detail]) => (
              <QuestionCard key={field} label={label} detail={detail}>
                <div className="grid gap-3 md:grid-cols-3">
                  {yesPartialNoOptions.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      checked={form[field as keyof FormState] === option.value}
                      label={option.label}
                      description={option.description}
                    >
                      <input
                        type="radio"
                        name={field}
                        value={option.value}
                        checked={form[field as keyof FormState] === option.value}
                        onChange={() => setStringField(field as keyof FormState, option.value as never)}
                      />
                    </ChoiceCard>
                  ))}
                </div>
              </QuestionCard>
            ))}
          </div>
        ) : null}

        {currentStep === 5 ? (
          <div className="mt-6 space-y-4">
            {[
              ["infrastructureAsCode", "Is infrastructure managed as code?", "This keeps environments repeatable and reviewable."],
              ["changesViaCiCd", "Do infrastructure changes go through CI/CD?", "Production change should have one normal path."],
              ["codeReviewRequired", "Is code review required for infrastructure changes?", "Direct merges and direct production edits are risky."],
              ["driftDetection", "Do you check for drift?", "Live changes should not silently diverge from code."],
              ["taggingStandard", "Do you have a tagging or labeling standard?", "Owner, environment, and cost center are the usual minimum."],
              ["budgetAlerts", "Are budgets and alerts set?", "Spend surprises usually happen when alerts are missing."],
              ["resourceOwnership", "Is resource ownership clear?", "Someone should own each major workload and high-cost group."],
              ["lifecycleCleanup", "Do you clean up stale resources?", "Old snapshots, disks, and test resources add cost and confusion."],
              ["nonProdShutdown", "Do you shut down non-prod when appropriate?", "Idle environments should not run forever by default."],
            ].map(([field, label, detail]) => (
              <QuestionCard key={field} label={label} detail={detail}>
                <div className="grid gap-3 md:grid-cols-3">
                  {yesPartialNoOptions.map((option) => (
                    <ChoiceCard
                      key={option.value}
                      checked={form[field as keyof FormState] === option.value}
                      label={option.label}
                      description={option.description}
                    >
                      <input
                        type="radio"
                        name={field}
                        value={option.value}
                        checked={form[field as keyof FormState] === option.value}
                        onChange={() => setStringField(field as keyof FormState, option.value as never)}
                      />
                    </ChoiceCard>
                  ))}
                </div>
              </QuestionCard>
            ))}

            <QuestionCard
              label="Can engineers change production directly outside the normal pipeline?"
              detail="Emergency-only access is better than regular direct changes."
            >
              <div className="grid gap-3 md:grid-cols-3">
                <ChoiceCard checked={form.manualProductionChanges === "blocked"} label="Blocked" description="Normal work goes through the pipeline.">
                    <input
                      type="radio"
                      name="manualProductionChanges"
                      value="blocked"
                      checked={form.manualProductionChanges === "blocked"}
                      onChange={() => setStringField("manualProductionChanges", "blocked")}
                    />
                </ChoiceCard>
                <ChoiceCard
                  checked={form.manualProductionChanges === "emergency_only"}
                  label="Emergency only"
                  description="Direct change exists, but only as a break-glass path."
                >
                    <input
                      type="radio"
                      name="manualProductionChanges"
                      value="emergency_only"
                      checked={form.manualProductionChanges === "emergency_only"}
                      onChange={() => setStringField("manualProductionChanges", "emergency_only")}
                    />
                </ChoiceCard>
                <ChoiceCard checked={form.manualProductionChanges === "allowed"} label="Allowed" description="Direct production changes still happen regularly.">
                    <input
                      type="radio"
                      name="manualProductionChanges"
                      value="allowed"
                      checked={form.manualProductionChanges === "allowed"}
                      onChange={() => setStringField("manualProductionChanges", "allowed")}
                    />
                </ChoiceCard>
              </div>
            </QuestionCard>

            <label className="block space-y-1">
              <span className={fieldLabelClassName}>What is the biggest cloud challenge your company is dealing with right now?</span>
              <textarea
                value={form.biggestChallenge}
                onChange={(event) => setStringField("biggestChallenge", event.target.value)}
                placeholder="Optional, but useful for tailoring the email and follow-up."
                className="focus-ring min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_0_rgba(255,255,255,0.65)_inset]"
              />
            </label>
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">The full report is emailed. It is not shown on this page.</div>
          <div className="flex flex-wrap gap-3">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={previousStep}
                className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Back
              </button>
            ) : null}
            {currentStep < STEPS.length - 1 ? (
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
                className="focus-ring rounded-md bg-gradient-to-r from-slate-900 to-[#174f7f] px-4 py-2 text-sm font-semibold text-white transition hover:from-slate-800 hover:to-[#1d628f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Emailing results..." : "Email my results"}
              </button>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}
