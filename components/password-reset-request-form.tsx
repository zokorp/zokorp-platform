"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/password/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not start reset flow.");
        return;
      }

      setMessage(payload.message ?? "If that account exists, a reset email was sent.");
      setSubmittedEmail(email.trim());
    } catch {
      setError("Network error while requesting reset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startAnotherRequest() {
    setMessage(null);
    setError(null);
    setSubmittedEmail(null);
  }

  return (
    <div className="mt-6 space-y-4">
      {message ? (
        <Alert tone="success">
          <p className="font-medium">Reset email requested</p>
          <p>{message}</p>
          {submittedEmail ? <p className="mt-2 text-sm">Requested for: {submittedEmail}</p> : null}
          <div className="mt-4">
            <Button type="button" variant="secondary" onClick={startAnotherRequest}>
              Send another reset link
            </Button>
          </div>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label htmlFor="reset-email" className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Business email</span>
            <Input
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@company.com"
            />
          </label>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
