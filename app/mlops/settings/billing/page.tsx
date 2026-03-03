import { OrganizationRole } from "@prisma/client";
import type Stripe from "stripe";

import { getEnv } from "@/lib/env";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";
import { getStripeClient } from "@/lib/stripe";

import { MlopsBillingActions } from "@/components/mlops/mlops-actions";
import { MlopsShell } from "@/components/mlops/mlops-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string; checkout?: string }>;
};

type InvoiceSummary = {
  id: string;
  amountPaid: number;
  currency: string;
  status: string | null;
  hostedInvoiceUrl: string | null;
  created: number;
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function MlopsBillingPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const context = await getMlopsWorkspaceForPage({
    organizationSlug: params.org,
    minimumRole: OrganizationRole.ADMIN,
  });

  const env = getEnv();
  const expectedPrices = {
    monthly: env.STRIPE_PRICE_ID_MLOPS_STARTER_MONTHLY,
    annual: env.STRIPE_PRICE_ID_MLOPS_STARTER_ANNUAL,
  };

  let subscription: Stripe.Subscription | null = null;
  let invoices: InvoiceSummary[] = [];

  if (context.organization.stripeCustomerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripeClient();

      const [invoiceList, subscriptions] = await Promise.all([
        stripe.invoices.list({
          customer: context.organization.stripeCustomerId,
          limit: 20,
        }),
        stripe.subscriptions.list({
          customer: context.organization.stripeCustomerId,
          status: "all",
          limit: 5,
        }),
      ]);

      subscription = subscriptions.data[0] ?? null;
      invoices = invoiceList.data.map((invoice) => ({
        id: invoice.id,
        amountPaid: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        created: invoice.created,
      }));
    } catch (error) {
      console.error("Failed to load Stripe billing details", error);
    }
  }

  const checkoutFlash = params.checkout;

  return (
    <MlopsShell
      activeHref="/mlops/settings/billing"
      title="MLOps Billing"
      description="Manage subscription and invoices with Stripe-hosted billing tools. Usage metering can be enabled for overage billing."
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
    >
      {checkoutFlash === "success" ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Checkout completed. Subscription provisioning may take a few seconds.
        </section>
      ) : null}
      {checkoutFlash === "cancelled" ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Checkout was cancelled. You can restart anytime.
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Current Plan</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Billing plan:</span> {context.organization.billingPlan}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Usage metering:</span>{" "}
              {context.organization.usageMeteringEnabled ? "Enabled" : "Disabled"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Stripe customer:</span>{" "}
              {context.organization.stripeCustomerId ?? "Not connected"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Subscription:</span>{" "}
              {subscription ? `${subscription.status} (${subscription.id})` : "No subscription found"}
            </p>
          </div>
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Expected price IDs
            <p className="mt-1">Monthly: {expectedPrices.monthly ?? "not set"}</p>
            <p>Annual: {expectedPrices.annual ?? "not set"}</p>
          </div>
        </article>

        <MlopsBillingActions organizationSlug={context.organization.slug} />
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Invoices</h2>
        <div className="mt-3 space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-600">No invoices yet for this organization.</p>
          ) : (
            invoices.map((invoice) => (
              <article key={invoice.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{invoice.id}</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                    {invoice.status ?? "unknown"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {formatMoney(invoice.amountPaid, invoice.currency)} · {new Date(invoice.created * 1000).toLocaleDateString("en-US")}
                </p>
                {invoice.hostedInvoiceUrl ? (
                  <a
                    href={invoice.hostedInvoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
                  >
                    Open invoice
                  </a>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </MlopsShell>
  );
}
