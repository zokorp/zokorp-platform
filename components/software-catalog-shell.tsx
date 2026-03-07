"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CatalogPrice = {
  id: string;
  kind: string;
  amount: number;
  currency: string;
};

type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accessModel: "FREE" | "ONE_TIME_CREDIT" | "SUBSCRIPTION" | "METERED";
  prices: CatalogPrice[];
};

type AccessFilter = "ALL" | CatalogProduct["accessModel"];

type SoftwareCatalogShellProps = {
  products: CatalogProduct[];
};

const accessFilters: Array<{ value: AccessFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "FREE", label: "Free" },
  { value: "ONE_TIME_CREDIT", label: "Credit" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "METERED", label: "Metered" },
];

const accessBadgeVariant: Record<CatalogProduct["accessModel"], React.ComponentProps<typeof Badge>["variant"]> = {
  FREE: "success",
  ONE_TIME_CREDIT: "warning",
  SUBSCRIPTION: "info",
  METERED: "brand",
};

const accessLabel: Record<CatalogProduct["accessModel"], string> = {
  FREE: "Free",
  ONE_TIME_CREDIT: "Credit",
  SUBSCRIPTION: "Subscription",
  METERED: "Metered",
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function getPriceSummary(product: CatalogProduct) {
  if (product.prices.length === 0) {
    return product.accessModel === "FREE" ? "No purchase required" : "Pricing available after account setup";
  }

  const amounts = product.prices.map((price) => formatAmount(price.amount, price.currency));

  if (amounts.length === 1) {
    return amounts[0];
  }

  return `${amounts[0]} to ${amounts[amounts.length - 1]}`;
}

export function SoftwareCatalogShell({ products }: SoftwareCatalogShellProps) {
  const [query, setQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("ALL");
  const deferredQuery = useDeferredValue(query);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesAccess = accessFilter === "ALL" || product.accessModel === accessFilter;
      if (!matchesAccess) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${product.name} ${product.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [accessFilter, deferredQuery, products]);

  return (
    <section className="space-y-5">
      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5 md:p-6">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Catalog Filters</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">Browse by access model or intent</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Search product names and descriptions, then narrow the list to the pricing model your team wants.
            </p>
          </div>

          <div className="w-full max-w-md">
            <label htmlFor="software-search" className="sr-only">
              Search software catalog
            </label>
            <Input
              id="software-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search software"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter software by access model">
            {accessFilters.map((filter) => {
              const isActive = filter.value === accessFilter;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setAccessFilter(filter.value)}
                  className={cn(
                    buttonVariants({ variant: isActive ? "primary" : "secondary", size: "sm" }),
                    !isActive && "bg-white",
                  )}
                  aria-pressed={isActive}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-500" aria-live="polite">
            Showing {filteredProducts.length} of {products.length} product{products.length === 1 ? "" : "s"}.
          </p>
        </CardContent>
      </Card>

      {filteredProducts.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredProducts.map((product) => (
            <Card key={product.id} lift className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Software Product</p>
                    <h3 className="font-display text-2xl font-semibold text-slate-900">{product.name}</h3>
                  </div>
                  <Badge variant={accessBadgeVariant[product.accessModel]}>{accessLabel[product.accessModel]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6 text-slate-600">{product.description}</p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pricing Snapshot</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-slate-900">{getPriceSummary(product)}</p>
                  {product.prices.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm text-slate-600">
                      {product.prices.slice(0, 3).map((price) => (
                        <li key={price.id} className="flex items-center justify-between gap-4">
                          <span>{price.kind.replaceAll("_", " ")}</span>
                          <span className="font-semibold text-slate-900">{formatAmount(price.amount, price.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600">
                      {product.accessModel === "FREE"
                        ? "Launch the tool directly. Account sign-in adds usage history where supported."
                        : "Pricing is configured per product in the admin dashboard."}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/software/${product.slug}`} className={buttonVariants()}>
                  Open product
                </Link>
                <Link href="/account" className={buttonVariants({ variant: "secondary" })}>
                  View account access
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card tone="muted" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">No Matches</p>
            <h3 className="font-display text-2xl font-semibold text-slate-900">No software fits the current filters</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-slate-600">
              Clear the search term or switch back to all access models to see the full catalog.
            </p>
          </CardContent>
          <CardFooter>
            <button type="button" onClick={() => {
              setQuery("");
              setAccessFilter("ALL");
            }} className={buttonVariants({ variant: "secondary" })}>
              Clear filters
            </button>
          </CardFooter>
        </Card>
      )}
    </section>
  );
}
