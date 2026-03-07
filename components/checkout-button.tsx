"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CheckoutButtonProps = {
  productSlug: string;
  priceId: string;
  label: string;
  requiresAuth?: boolean;
  authUnavailable?: boolean;
  billingUnavailable?: boolean;
};

export function CheckoutButton({
  productSlug,
  priceId,
  label,
  requiresAuth = false,
  authUnavailable = false,
  billingUnavailable = false,
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
        <Button type="button" disabled fullWidth variant="secondary">
          Checkout unavailable until login setup is complete
        </Button>
      </div>
    );
  }

  if (billingUnavailable) {
    return (
      <div className="space-y-2">
        <Button type="button" disabled fullWidth variant="secondary">
          Checkout unavailable while billing setup is being finalized
        </Button>
      </div>
    );
  }

  if (requiresAuth) {
    return (
      <div className="space-y-2">
        <Link
          href={`/login?callbackUrl=/software/${productSlug}`}
          className={cn(buttonVariants({ variant: "secondary", size: "md", fullWidth: true }))}
        >
          Sign in to continue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={onClick} disabled={isLoading} fullWidth>
        {isLoading ? "Redirecting..." : label}
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
