"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EmailVerificationResendFormProps = {
  defaultEmail?: string;
  submitLabel?: string;
};

export function EmailVerificationResendForm({
  defaultEmail = "",
  submitLabel = "Send verification email",
}: EmailVerificationResendFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify-email/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to send verification email right now.");
        return;
      }

      setStatusMessage(payload.message ?? "If that account is pending verification, a new email has been sent.");
    } catch {
      setError("Unable to send verification email right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="verification-email" className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Business email</span>
        <Input
          id="verification-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </label>

      <Button type="submit" disabled={isSubmitting} variant="secondary">
        {isSubmitting ? "Sending..." : submitLabel}
      </Button>

      {statusMessage ? <Alert tone="success">{statusMessage}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </form>
  );
}
