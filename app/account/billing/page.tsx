import { redirect } from "next/navigation";

import { PortalButton } from "@/components/portal-button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function BillingPage() {
  const session = await auth();
  const billingPortalReady = Boolean(process.env.STRIPE_SECRET_KEY);

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/account/billing");
  }

  return (
    <Card tone="glass" className="animate-fade-up space-y-4 rounded-2xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Billing</p>
      <h1 className="font-display text-4xl font-semibold text-slate-900">Billing and Subscriptions</h1>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        Manage subscriptions, invoices, receipts, and payment methods using Stripe&apos;s hosted
        customer portal.
      </p>
      <p className="text-xs text-slate-500">
        For consultation or delivery status, use the account hub request timeline.
      </p>
      <PortalButton
        available={billingPortalReady}
        unavailableMessage="Stripe billing portal is not configured in this local environment yet."
      />
    </Card>
  );
}
