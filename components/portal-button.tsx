"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type PortalButtonProps = {
  available?: boolean;
  unavailableMessage?: string;
};

export function PortalButton({
  available = true,
  unavailableMessage = "Billing portal setup is still in progress. Please try again shortly.",
}: PortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!available) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        if (response.status === 401) {
          setError("Please sign in first.");
          return;
        }
        if (response.status === 400) {
          setError(data.error ?? "Billing portal is not available for this account yet.");
          return;
        }
        setError(data.error ?? "Unable to open billing portal.");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Unexpected network error.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" onClick={onClick} disabled={isLoading || !available}>
        {isLoading ? "Opening..." : "Open Stripe Billing Portal"}
      </Button>
      {!available ? <Alert tone="warning">{unavailableMessage}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
