import Link from "next/link";
import { AccessModel } from "@prisma/client";

import { getSoftwareCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const accessLabel: Record<AccessModel, string> = {
  FREE: "Free",
  ONE_TIME_CREDIT: "Pay Per Use",
  SUBSCRIPTION: "Subscription",
  METERED: "Usage Metered",
};

const accessStyle: Record<AccessModel, string> = {
  FREE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ONE_TIME_CREDIT: "bg-amber-50 text-amber-800 border-amber-200",
  SUBSCRIPTION: "bg-sky-50 text-sky-700 border-sky-200",
  METERED: "bg-violet-50 text-violet-700 border-violet-200",
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default async function SoftwarePage() {
  const products = await getSoftwareCatalog();

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-300 bg-white/70 px-6 py-8 backdrop-blur-sm md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Software Catalog</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Tools that unlock delivery speed</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          Browse ZoKorp software with free, one-time, and subscription access models. All paid flows
          are processed through Stripe-hosted checkout and account-based entitlements.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        {products.map((product) => (
          <article key={product.id} className="surface rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold text-slate-900">{product.name}</h2>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${accessStyle[product.accessModel]}`}
              >
                {accessLabel[product.accessModel]}
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pricing</p>
              {product.prices.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {product.prices.map((price) => (
                    <li key={price.id} className="flex items-center justify-between gap-4">
                      <span>{price.kind.replaceAll("_", " ")}</span>
                      <span className="font-semibold">{formatAmount(price.amount, price.currency)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-600">Pricing is configured in the admin dashboard.</p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                className="focus-ring rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                href={`/software/${product.slug}`}
              >
                Open Tool
              </Link>
              <Link
                className="focus-ring rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                href="/account"
              >
                View Account Access
              </Link>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
