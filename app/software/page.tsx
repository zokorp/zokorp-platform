import Link from "next/link";
import { AccessModel } from "@prisma/client";

import { getSoftwareCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const accessLabel: Record<AccessModel, string> = {
  FREE: "Free",
  ONE_TIME_CREDIT: "Pay Per Use",
  SUBSCRIPTION: "Subscription",
  METERED: "Metered",
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Software</h1>
        <p className="mt-2 text-slate-600">
          Browse ZoKorp software tools with free, one-time, and subscription access models.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {products.map((product) => (
          <article key={product.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{product.name}</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {accessLabel[product.accessModel]}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{product.description}</p>
            <p className="mt-3 text-sm text-slate-700">
              {product.prices.length > 0
                ? `Starts at ${formatAmount(product.prices[0].amount, product.prices[0].currency)}`
                : "Pricing configured in admin"}
            </p>
            <Link
              className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              href={`/software/${product.slug}`}
            >
              Open Tool
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
