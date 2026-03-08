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

const FALLBACK_PUBLIC_CATALOG: CatalogProduct[] = [
  {
    id: "fallback-zokorp-validator",
    slug: "zokorp-validator",
    name: "ZoKorpValidator",
    description: "ValidationChecklistValidator for FTR, SDP/SRP, and Competency workflows.",
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
      {
        id: "fallback-sdp-srp",
        stripePriceId: "fallback-sdp-srp",
        amount: 15000,
        currency: "usd",
        kind: PriceKind.CREDIT_PACK,
        creditsGranted: 1,
        creditTier: CreditTier.SDP_SRP,
        active: true,
      },
      {
        id: "fallback-competency",
        stripePriceId: "fallback-competency",
        amount: 50000,
        currency: "usd",
        kind: PriceKind.CREDIT_PACK,
        creditsGranted: 1,
        creditTier: CreditTier.COMPETENCY,
        active: true,
      },
    ],
  },
  {
    id: "fallback-architecture-diagram-reviewer",
    slug: "architecture-diagram-reviewer",
    name: "Architecture Diagram Reviewer",
    description:
      "Free cloud architecture diagram reviewer for PNG or SVG uploads with deterministic findings delivered to a verified business-email account.",
    accessModel: AccessModel.FREE,
    active: true,
    prices: [],
  },
  {
    id: "fallback-ai-decider",
    slug: "ai-decider",
    name: "AI Decider",
    description:
      "Free deterministic consulting diagnostic that tells SMB teams whether their problem needs AI, automation, analytics, or more discovery before any build.",
    accessModel: AccessModel.FREE,
    active: true,
    prices: [],
  },
  {
    id: "fallback-landing-zone-readiness-checker",
    slug: "landing-zone-readiness-checker",
    name: "Landing Zone Readiness Checker",
    description:
      "Free deterministic landing-zone assessment for SMB teams with emailed scoring, findings, and consultation quote.",
    accessModel: AccessModel.FREE,
    active: true,
    prices: [],
  },
  {
    id: "fallback-cloud-cost-leak-finder",
    slug: "cloud-cost-leak-finder",
    name: "Cloud Cost Leak Finder",
    description:
      "Free deterministic cloud cost diagnostic for SMB teams with an emailed advisory memo, likely savings range, and consulting quote.",
    accessModel: AccessModel.FREE,
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

    return products;
  } catch (error) {
    console.error("Failed to load software catalog from database.", error);
    return loadFallbackCatalog("database-backed catalog query failed", error);
  }
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  if (!process.env.DATABASE_URL) {
    return cloneFallbackCatalog().find((product) => product.slug === slug) ?? null;
  }

  try {
    return await db.product.findUnique({
      where: { slug },
      include: {
        prices: {
          where: { active: true },
          orderBy: { amount: "asc" },
        },
      },
    });
  } catch (error) {
    console.error("Failed to load product by slug from database.", { slug, error });
    return cloneFallbackCatalog().find((product) => product.slug === slug) ?? null;
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
