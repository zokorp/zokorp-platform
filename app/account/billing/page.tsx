import { redirect } from "next/navigation";

import { PortalButton } from "@/components/portal-button";
import { auth } from "@/lib/auth";

export default async function BillingPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/api/auth/signin?callbackUrl=/account/billing");
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-3xl font-semibold">Billing and Subscriptions</h1>
      <p className="text-sm text-slate-600">
        Use Stripe&apos;s hosted Customer Portal to manage subscriptions, invoices, receipts, and payment
        methods.
      </p>
      <PortalButton />
    </div>
  );
}
