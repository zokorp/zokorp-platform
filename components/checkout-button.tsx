"use client";

import Link from "next/link";
import { useState } from "react";

type CheckoutButtonProps = {
  productSlug: string;
  priceId: string;
  label: string;
  requiresAuth?: boolean;
  authUnavailable?: boolean;
};

export function CheckoutButton({
  productSlug,
  priceId,
  label,
  requiresAuth = false,
  authUnavailable = false,
}: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productSlug, priceId }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        if (response.status === 401) {
          setError("Please sign in before starting checkout.");
          return;
        }
        setError(data.error ?? "Unable to start checkout.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Unexpected network error.");
    } finally {
      setIsLoading(false);
    }
  }

  if (authUnavailable) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-md border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-500"
        >
          Checkout unavailable until login setup is complete
        </button>
      </div>
    );
  }

  if (requiresAuth) {
    return (
      <div className="space-y-2">
        <Link
          href={`/login?callbackUrl=/software/${productSlug}`}
          className="focus-ring inline-flex w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className="focus-ring w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Redirecting..." : label}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
