"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordSignInFormProps = {
  callbackUrl: string;
};

export function PasswordSignInForm({ callbackUrl }: PasswordSignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials or account is temporarily locked.");
        return;
      }

      if (result?.url) {
        window.location.href = result.url;
        return;
      }

      window.location.href = callbackUrl;
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
          autoComplete="current-password"
        />
      </label>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>

      {error ? <Alert tone="danger">{error}</Alert> : null}
    </form>
  );
}
