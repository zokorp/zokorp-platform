"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ServiceRequestType = "CONSULTATION" | "DELIVERY" | "SUPPORT";

const requestTypeOptions: Array<{ value: ServiceRequestType; label: string }> = [
  { value: "CONSULTATION", label: "Consultation" },
  { value: "DELIVERY", label: "Service Delivery" },
  { value: "SUPPORT", label: "Support" },
];

const budgetOptions = [
  "Under $5k",
  "$5k - $15k",
  "$15k - $50k",
  "$50k+",
  "Undecided",
];

type SubmissionResponse = {
  id: string;
  trackingCode: string;
  status: string;
};

type ServiceRequestPanelProps = {
  signedIn?: boolean;
};

export function ServiceRequestPanel({ signedIn = false }: ServiceRequestPanelProps) {
  const [isSignedIn, setIsSignedIn] = useState(signedIn);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function syncSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { user?: { email?: string } };
        if (isMounted) {
          setIsSignedIn(Boolean(data.user?.email));
        }
      } catch {
        // Keep static fallback state if session endpoint is unavailable.
      }
    }

    void syncSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return "Submitting request...";
    }

    return "Submit service request";
  }, [isSubmitting]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSignedIn) {
      setError("Please sign in first so your service request can be tracked in your account.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);

    const body = {
      type: String(formData.get("type") ?? "") as ServiceRequestType,
      title: String(formData.get("title") ?? "").trim(),
      summary: String(formData.get("summary") ?? "").trim(),
      preferredStart: String(formData.get("preferredStart") ?? "").trim() || undefined,
      budgetRange: String(formData.get("budgetRange") ?? "").trim() || undefined,
    };

    setIsSubmitting(true);
    setTrackingCode(null);
    setError(null);

    try {
      const response = await fetch("/api/services/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Partial<SubmissionResponse> & { error?: string };

      if (!response.ok) {
        if (response.status === 401) {
          setError("Please sign in first so your service request can be tracked in your account.");
          return;
        }

        setError(data.error ?? "Unable to submit request right now.");
        return;
      }

      setTrackingCode(data.trackingCode ?? null);
      form.reset();
    } catch {
      setError("Unexpected network error while submitting request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section id="service-request" className="surface lift-card rounded-2xl p-6 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Service Hub</p>
          <h2 className="font-display mt-1 text-3xl font-semibold text-slate-900">Request consultation or delivery</h2>
        </div>
        <Badge variant="secondary">
          Tracked in account
        </Badge>
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        Submit what you need and ZoKorp will triage, schedule, and update status in your account timeline.
      </p>

      {!isSignedIn ? (
        <Alert tone="info" className="mt-5">
          <p>Sign in to submit a request and track milestones from your account.</p>
          <Link
            href="/login?callbackUrl=/services"
            className={`${buttonVariants({ size: "sm" })} mt-3`}
          >
            Sign in
          </Link>
        </Alert>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Request type</span>
          <Select
            name="type"
            defaultValue="CONSULTATION"
            required
          >
            {requestTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Preferred start date</span>
          <Input
            type="date"
            name="preferredStart"
          />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Request title</span>
          <Input
            name="title"
            required
            minLength={8}
            maxLength={120}
            placeholder="Example: FTR readiness consultation for AI advisory offering"
          />
        </label>

        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">What do you need?</span>
          <Textarea
            name="summary"
            required
            minLength={30}
            maxLength={2400}
            placeholder="Describe scope, goals, timelines, and any constraints."
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Budget range</span>
          <Select
            name="budgetRange"
            defaultValue="Undecided"
          >
            {budgetOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex items-end">
          <Button type="submit" disabled={isSubmitting || !isSignedIn}>
            {submitLabel}
          </Button>
        </div>
      </form>

      {trackingCode ? (
        <Alert tone="success" className="mt-4">
          Request submitted. Tracking code: <span className="font-mono font-semibold">{trackingCode}</span>. You can
          track updates in your account.
          <div className="mt-2">
            <Link
              href="/account"
              className="text-xs font-semibold text-emerald-900 underline underline-offset-2"
            >
              Open account timeline
            </Link>
          </div>
        </Alert>
      ) : null}

      {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
    </section>
  );
}
