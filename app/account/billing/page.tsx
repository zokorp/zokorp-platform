import { redirect } from "next/navigation";

import { PortalButton } from "@/components/portal-button";
import { auth } from "@/lib/auth";

export default async function BillingPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/account/billing");
  }

  return (
    <div className="surface space-y-4 rounded-2xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Billing</p>
      <h1 className="font-display text-4xl font-semibold text-slate-900">Billing and Subscriptions</h1>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">
        Manage subscriptions, invoices, receipts, and payment methods using Stripe&apos;s hosted
        customer portal.
      </p>
      <PortalButton />
    </div>
  );
}
