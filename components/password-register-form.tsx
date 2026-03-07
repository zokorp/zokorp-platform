"use client";

import { useState } from "react";

import { EmailVerificationResendForm } from "@/components/email-verification-resend-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PasswordRegisterFormProps = {
  callbackUrl: string;
};

export function PasswordRegisterForm({ callbackUrl }: PasswordRegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [verificationEmailSent, setVerificationEmailSent] = useState(true);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        verificationEmailSent?: boolean;
      };
      if (!response.ok) {
        setError(payload.error ?? "Registration failed.");
        return;
      }

      setRegisteredEmail(email.trim().toLowerCase());
      setVerificationEmailSent(payload.verificationEmailSent !== false);
      setSuccessMessage(payload.message ?? "Account created. Verify your email before signing in.");
      setPassword("");
    } catch {
      setError("Unable to register right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="mt-6 space-y-4">
        <Alert tone="success">{successMessage}</Alert>

        <Card className="rounded-2xl p-4">
          {verificationEmailSent ? (
            <p className="text-sm text-slate-700">
              Verification email sent to <span className="font-semibold text-slate-900">{registeredEmail}</span>.
            </p>
          ) : (
            <p className="text-sm text-slate-700">
              Account created for <span className="font-semibold text-slate-900">{registeredEmail}</span>, but the
              verification email did not send successfully.
            </p>
          )}
          <p className="mt-2 text-sm text-slate-600">
            Use that link first. After verification, sign in and continue to{" "}
            <span className="font-medium text-slate-900">{callbackUrl}</span>.
          </p>
        </Card>

        <Card className="rounded-2xl p-4">
          <p className="mb-3 text-sm font-medium text-slate-900">Need a fresh verification email?</p>
          <EmailVerificationResendForm defaultEmail={registeredEmail} submitLabel="Resend verification email" />
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label htmlFor="name" className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Name</span>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={120}
          placeholder="Your name"
        />
      </label>

      <label htmlFor="email" className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Business email</span>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </label>

      <label htmlFor="password" className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={12}
          autoComplete="new-password"
          placeholder="At least 12 chars, upper/lower/number/symbol"
        />
      </label>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </form>
  );
}
