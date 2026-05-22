"use client";

import type { ComponentProps, CSSProperties } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getToolDefinition } from "@/lib/tool-registry";
import { cn } from "@/lib/utils";

type CatalogPrice = {
  amount: number;
  currency: string;
};

type PricingProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accessModel: "FREE" | "ONE_TIME_CREDIT" | "SUBSCRIPTION" | "METERED";
  prices: CatalogPrice[];
};

type PricingServiceOffer = {
  slug: string;
  eyebrow: string;
  title: string;
  priceAnchor: string;
  summary: string;
  prominence: "primary" | "secondary";
};

type ViewFilter = "SOFTWARE" | "PRIMARY_SERVICES" | "SECONDARY_SERVICES" | "ALL";
type AccessFilter = "ALL" | PricingProduct["accessModel"];

type PricingCatalogShellProps = {
  products: PricingProduct[];
  primaryOffers: PricingServiceOffer[];
  secondaryOffers: PricingServiceOffer[];
};

type PricingRow = {
  id: string;
  title: string;
  eyebrow: string;
  summary: string;
  typeLabel: string;
  typeVariant: ComponentProps<typeof Badge>["variant"];
  typeDetail?: string;
  priceLabel: string;
  priceDetail?: string;
  actionHref: string;
  actionLabel: string;
  view: "SOFTWARE" | "PRIMARY_SERVICES" | "SECONDARY_SERVICES";
  accessModel?: PricingProduct["accessModel"];
};

const viewFilters: Array<{ value: ViewFilter; label: string }> = [
  { value: "SOFTWARE", label: "Software" },
  { value: "PRIMARY_SERVICES", label: "Primary services" },
  { value: "SECONDARY_SERVICES", label: "Secondary services" },
  { value: "ALL", label: "All" },
];

const accessFilters: Array<{ value: AccessFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "FREE", label: "Free" },
  { value: "ONE_TIME_CREDIT", label: "Credit" },
  { value: "SUBSCRIPTION", label: "Subscription" },
  { value: "METERED", label: "Metered" },
];

const accessBadgeVariant: Record<PricingProduct["accessModel"], ComponentProps<typeof Badge>["variant"]> = {
  FREE: "success",
  ONE_TIME_CREDIT: "warning",
  SUBSCRIPTION: "info",
  METERED: "brand",
};

const accessLabel: Record<PricingProduct["accessModel"], string> = {
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

function getSoftwarePriceSummary(product: PricingProduct) {
  if (product.prices.length === 0) {
    return product.accessModel === "FREE" ? "No purchase" : "Configured later";
  }

  const amounts = product.prices.map((price) => formatAmount(price.amount, price.currency));

  if (amounts.length === 1) {
    return amounts[0];
  }

  return `From ${amounts[0]}`;
}

function getSoftwareRow(product: PricingProduct): PricingRow {
  const toolDefinition = getToolDefinition(product.slug);

  return {
    id: product.id,
    title: toolDefinition?.displayName ?? product.name,
    eyebrow: "Software product",
    summary: toolDefinition?.productDescription ?? product.description,
    typeLabel: accessLabel[product.accessModel],
    typeVariant: accessBadgeVariant[product.accessModel],
    typeDetail:
      product.accessModel === "FREE"
        ? "Open access"
        : product.prices.length > 0
          ? `${product.prices.length} price${product.prices.length === 1 ? "" : " points"}`
          : "Configured later",
    priceLabel: getSoftwarePriceSummary(product),
    priceDetail:
      product.accessModel === "FREE"
        ? "No account required to browse"
        : product.prices.length > 0
          ? "Visible public pricing"
          : "Pricing added later",
    actionHref: `/software/${product.slug}`,
    actionLabel: "Open product",
    view: "SOFTWARE",
    accessModel: product.accessModel,
  };
}

function getServiceTypeLabel(prominence: PricingServiceOffer["prominence"]) {
  return prominence === "primary"
    ? {
        label: "Primary service",
        variant: "secondary" as const,
      }
    : {
        label: "Secondary service",
        variant: "brand" as const,
      };
}

function getServiceRow(offer: PricingServiceOffer): PricingRow {
  const serviceType = getServiceTypeLabel(offer.prominence);

  return {
    id: offer.slug,
    title: offer.title,
    eyebrow: offer.eyebrow,
    summary: offer.summary,
    typeLabel: serviceType.label,
    typeVariant: serviceType.variant,
    typeDetail: offer.prominence === "primary" ? "Visible starting price" : "Still public and selectable",
    priceLabel: offer.priceAnchor,
    priceDetail: offer.prominence === "primary" ? "Start here" : "Additional scoped work",
    actionHref: "/services",
    actionLabel: "See service",
    view: offer.prominence === "primary" ? "PRIMARY_SERVICES" : "SECONDARY_SERVICES",
  };
}

// Last column is locked to 9.5rem so price/action variations across rows
// (e.g. "from $1,500/month" vs "from $750") don't widen one row's last
// cell and shift its neighbours left out of alignment.
const tableColumns = {
  "--table-columns": "minmax(0,1.55fr) minmax(11rem,0.78fr) minmax(12rem,0.78fr) 9.5rem",
} as CSSProperties;

export function PricingCatalogShell({ products, primaryOffers, secondaryOffers }: PricingCatalogShellProps) {
  const [viewFilter, setViewFilter] = useState<ViewFilter>("ALL");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("ALL");

  const rows = useMemo(() => {
    const softwareRows = products.map(getSoftwareRow);
    const primaryServiceRows = primaryOffers.map(getServiceRow);
    const secondaryServiceRows = secondaryOffers.map(getServiceRow);

    let filtered = [
      ...softwareRows,
      ...primaryServiceRows,
      ...secondaryServiceRows,
    ];

    if (viewFilter !== "ALL") {
      filtered = filtered.filter((row) => row.view === viewFilter);
    }

    if ((viewFilter === "SOFTWARE" || viewFilter === "ALL") && accessFilter !== "ALL") {
      filtered = filtered.filter((row) => row.view !== "SOFTWARE" || row.accessModel === accessFilter);
    }

    return filtered;
  }, [accessFilter, primaryOffers, products, secondaryOffers, viewFilter]);

  const showAccessFilters = viewFilter === "SOFTWARE" || viewFilter === "ALL";

  return (
    <section className="space-y-4">
      <div className="section-band px-5 py-5 md:px-6 md:py-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-end">
          <div className="space-y-2">
            <p className="enterprise-kicker">Pricing filters</p>
            <h2 className="font-display max-w-[13ch] text-[1.9rem] font-semibold leading-[0.98] text-foreground md:text-[2.4rem]">
              Filter the prices you want to compare.
            </h2>
          </div>
          <p className="max-w-[48ch] text-sm leading-7 text-muted-foreground">
            Software pricing shows first. Service prices stay public through the same table so nothing is hidden behind a
            dropdown.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter pricing by surface">
          {viewFilters.map((filter) => {
            const isActive = filter.value === viewFilter;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setViewFilter(filter.value)}
                className={cn(
                  buttonVariants({ variant: isActive ? "primary" : "secondary", size: "sm" }),
                  !isActive && "bg-card",
                )}
                aria-pressed={isActive}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {showAccessFilters ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter software pricing by access model">
            {accessFilters.map((filter) => {
              const isActive = filter.value === accessFilter;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setAccessFilter(filter.value)}
                  className={cn(
                    buttonVariants({ variant: isActive ? "primary" : "secondary", size: "sm" }),
                    !isActive && "bg-card",
                  )}
                  aria-pressed={isActive}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          Showing {rows.length} pricing row{rows.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="table-band px-5 py-2 md:px-6" style={tableColumns}>
        <div className="table-head">
          <span>Offer</span>
          <span>Type</span>
          <span>Price</span>
          <span className="text-right">Action</span>
        </div>

        {rows.map((row, index) => (
          <article key={row.id} className="table-row">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="table-kicker">{`0${index + 1}`}</p>
                <p className="enterprise-kicker">{row.eyebrow}</p>
              </div>
              <h3 className="font-display max-w-[13ch] text-[2rem] font-semibold leading-[1.02] text-card-foreground">
                {row.title}
              </h3>
              <p className="max-w-[38ch] text-[0.98rem] leading-7 text-muted-foreground">{row.summary}</p>
            </div>

            <div className="space-y-3">
              <p className="table-cell-label">Type</p>
              <Badge variant={row.typeVariant} className="w-fit">
                {row.typeLabel}
              </Badge>
              {row.typeDetail ? <p className="text-sm leading-6 text-muted-foreground">{row.typeDetail}</p> : null}
            </div>

            <div className="space-y-3">
              <p className="table-cell-label">Price</p>
              <p className="font-display text-[1.9rem] font-semibold leading-none tracking-[-0.05em] text-card-foreground">
                {row.priceLabel}
              </p>
              {row.priceDetail ? <p className="text-sm leading-6 text-muted-foreground">{row.priceDetail}</p> : null}
            </div>

            <div className="flex items-start lg:justify-end">
              <Link href={row.actionHref} className={buttonVariants({ variant: "secondary" })}>
                {row.actionLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
