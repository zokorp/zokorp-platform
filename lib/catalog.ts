import { unstable_cache } from "next/cache";
import { AccessModel, CreditTier, PriceKind } from "@prisma/client";

import { db } from "@/lib/db";

export class CatalogUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "CatalogUnavailableError";
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export type CatalogPrice = {
  id: string;
  stripePriceId: string;
  amount: number;
  currency: string;
  kind: PriceKind;
  creditsGranted: number;
  creditTier: CreditTier | null;
  active: boolean;
};

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  accessModel: AccessModel;
  active: boolean;
  prices: CatalogPrice[];
};

const PUBLIC_PRODUCT_SLUGS = new Set([
  "architecture-diagram-reviewer",
  "zokorp-validator",
  "mlops-foundation-platform",
]);

export function isPublicProductSlug(slug: string) {
  return PUBLIC_PRODUCT_SLUGS.has(slug);
}

const FALLBACK_PUBLIC_CATALOG: CatalogProduct[] = [
  {
    id: "fallback-zokorp-validator",
    slug: "zokorp-validator",
    name: "ZoKorpValidator",
    description: "FTR-first validation workflow with deterministic scoring, safe rewrite guidance, email delivery, and estimate-first follow-up.",
    accessModel: AccessModel.ONE_TIME_CREDIT,
    active: true,
    prices: [
      {
        id: "fallback-ftr",
        stripePriceId: "fallback-ftr",
        amount: 5000,
        currency: "usd",
        kind: PriceKind.CREDIT_PACK,
        creditsGranted: 1,
        creditTier: CreditTier.FTR,
        active: true,
      },
    ],
  },
  {
    id: "fallback-architecture-diagram-reviewer",
    slug: "architecture-diagram-reviewer",
    name: "Architecture Diagram Reviewer",
    description:
      "AWS-only architecture review for PNG, JPG, PDF, or SVG diagrams with score-based findings, official guidance links, and estimate-first follow-up.",
    accessModel: AccessModel.FREE,
    active: true,
    prices: [],
  },
  {
    id: "fallback-mlops-foundation-platform",
    slug: "mlops-foundation-platform",
    name: "ZoKorp MLOps Foundation Platform",
    description:
      "Forecasting beta for SMB teams: upload spreadsheet data, run practical revenue forecasts, review outputs, and expand later with paid add-ons.",
    accessModel: AccessModel.SUBSCRIPTION,
    active: true,
    prices: [],
  },
];

function cloneFallbackCatalog(): CatalogProduct[] {
  return FALLBACK_PUBLIC_CATALOG.map((product) => ({
    ...product,
    prices: product.prices.map((price) => ({ ...price })),
  }));
}

function loadFallbackCatalog(reason: string, cause?: unknown): CatalogProduct[] {
  const details =
    cause instanceof Error
      ? { message: cause.message, name: cause.name }
      : cause !== undefined
        ? { cause }
        : undefined;

  if (details) {
    console.warn(`Using fallback public software catalog: ${reason}.`, details);
  } else {
    console.warn(`Using fallback public software catalog: ${reason}.`);
  }

  return cloneFallbackCatalog();
}

function sanitizePublicProduct(product: CatalogProduct): CatalogProduct {
  if (product.slug === "zokorp-validator") {
    return {
      ...product,
      description:
        "FTR-first validation workflow with deterministic scoring, safe rewrite guidance, email delivery, and estimate-first follow-up.",
      prices: product.prices.filter((price) => price.creditTier === null || price.creditTier === CreditTier.FTR),
    };
  }

  if (product.slug === "mlops-foundation-platform") {
    return {
      ...product,
      description:
        "Forecasting beta for SMB teams: upload spreadsheet data, run practical revenue forecasts, review outputs, and expand later with paid add-ons.",
    };
  }

  return product;
}

export async function getSoftwareCatalog(): Promise<CatalogProduct[]> {
  if (!process.env.DATABASE_URL) {
    return loadFallbackCatalog("DATABASE_URL is not configured");
  }

  try {
    const products = await db.product.findMany({
      where: { active: true },
      include: {
        prices: {
          where: { active: true },
          orderBy: { amount: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return products.filter((product) => PUBLIC_PRODUCT_SLUGS.has(product.slug)).map((product) => sanitizePublicProduct(product));
  } catch (error) {
    console.error("Failed to load software catalog from database.", error);
    return loadFallbackCatalog("database-backed catalog query failed", error);
  }
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  if (!isPublicProductSlug(slug)) {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    const fallback = cloneFallbackCatalog().find((product) => product.slug === slug);
    return fallback ? sanitizePublicProduct(fallback) : null;
  }

  try {
    const product = await db.product.findUnique({
      where: { slug },
      include: {
        prices: {
          where: { active: true },
          orderBy: { amount: "asc" },
        },
      },
    });

    if (!product || !isPublicProductSlug(product.slug)) {
      return null;
    }

    return sanitizePublicProduct(product);
  } catch (error) {
    console.error("Failed to load product by slug from database.", { slug, error });
    const fallback = cloneFallbackCatalog().find((product) => product.slug === slug);
    return fallback ? sanitizePublicProduct(fallback) : null;
  }
}

export const getSoftwareCatalogCached = unstable_cache(async () => getSoftwareCatalog(), ["software-catalog"], {
  revalidate: 300,
});

export const getProductBySlugCached = unstable_cache(
  async (slug: string) => getProductBySlug(slug),
  ["product-by-slug"],
  {
    revalidate: 300,
  },
);
