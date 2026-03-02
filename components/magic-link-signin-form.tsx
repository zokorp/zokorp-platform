"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type MagicLinkSignInFormProps = {
  callbackUrl: string;
};

export function MagicLinkSignInForm({ callbackUrl }: MagicLinkSignInFormProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn("email", {
        email,
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setError("Could not send sign-in link. Please try again.");
        return;
      }

      setMessage("Sign-in link sent. Please check your inbox.");
    } catch {
      setError("Unexpected error while requesting sign-in link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label htmlFor="email" className="block text-sm font-medium text-slate-700">
        Work email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        autoComplete="email"
        placeholder="consulting@zokorp.com"
        className="focus-ring block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending link..." : "Send magic sign-in link"}
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
