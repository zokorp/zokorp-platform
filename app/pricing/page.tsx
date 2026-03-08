import Link from "next/link";

import { AccessModel } from "@prisma/client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CatalogUnavailableError, getSoftwareCatalogCached } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/site";

export const revalidate = 300;

export const metadata = buildPageMetadata({
  title: "Pricing",
  description: "Pricing overview for ZoKorp software access models and service engagement paths.",
  path: "/pricing",
});

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

const accessLabels: Record<AccessModel, string> = {
  FREE: "Free",
  ONE_TIME_CREDIT: "Credit-based",
  SUBSCRIPTION: "Subscription",
  METERED: "Metered",
};

const serviceOffers = [
  {
    title: "Architecture and readiness consultation",
    detail: "Best for planning, review, and milestone preparation before implementation work starts.",
  },
  {
    title: "Scoped delivery support",
    detail: "Best for teams that need execution help, validation packaging, or structured implementation follow-through.",
  },
  {
    title: "Software-backed engagement",
    detail: "Best for repeatable workflows that should transition from manual review to platform-supported execution.",
  },
];

export default async function PricingPage() {
  let products: Awaited<ReturnType<typeof getSoftwareCatalogCached>> = [];
  let catalogUnavailable = false;

  try {
    products = await getSoftwareCatalogCached();
  } catch (error) {
    if (error instanceof CatalogUnavailableError) {
      catalogUnavailable = true;
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-8">
      <section className="hero-surface animate-fade-up px-6 py-9 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">Pricing</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Clear access models for software and services</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-100 md:text-base">
          ZoKorp uses a mix of free tools, credit-based software, and subscription-ready products. Services are
          scoped separately when the work goes beyond self-serve usage.
        </p>
      </section>

      {catalogUnavailable ? (
        <Alert tone="warning" className="rounded-2xl border-amber-200 bg-amber-50/70">
          <AlertTitle>Pricing catalog temporarily unavailable</AlertTitle>
          <AlertDescription>
            Product pricing could not be loaded from the account catalog right now. Please retry shortly.
          </AlertDescription>
        </Alert>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {products.map((product) => (
            <article key={product.slug} className="surface lift-card rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl font-semibold text-slate-900">{product.name}</h2>
                <Badge variant="secondary">
                  {accessLabels[product.accessModel]}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {product.prices.length > 0 ? (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {product.prices.map((price) => (
                      <li key={price.id} className="flex items-center justify-between gap-4">
                        <span>{price.kind.replaceAll("_", " ")}</span>
                        <span className="font-semibold">{formatAmount(price.amount, price.currency)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-700">
                    {product.accessModel === AccessModel.FREE
                      ? "No purchase required. Sign in to run the tool and keep account-linked history."
                      : "Pricing is configured per product and appears when billing is active for that item."}
                  </p>
                )}
              </div>
              <Link href={`/software/${product.slug}`} className={`${buttonVariants()} mt-5`}>
                Open product
              </Link>
            </article>
          ))}
        </section>
      )}

      <section className="surface soft-grid rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Services</p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-slate-900">Service work is scoped to the problem</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {serviceOffers.map((offer) => (
            <article key={offer.title} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-2xl font-semibold text-slate-900">{offer.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{offer.detail}</p>
            </article>
          ))}
        </div>
        <div className="mt-5">
          <Link href="/services#service-request" className={buttonVariants()}>
            Request a scoped conversation
          </Link>
        </div>
      </section>
    </div>
  );
}
