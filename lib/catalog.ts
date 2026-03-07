import { db } from "@/lib/db";

const fallbackCatalog = [
  {
    id: "fallback-zokorp-validator",
    slug: "zokorp-validator",
    name: "ZoKorpValidator",
    description:
      "ValidationChecklistValidator for FTR ($50), SDP/SRP ($150), and Competency ($500).",
    active: true,
    accessModel: "ONE_TIME_CREDIT" as const,
    prices: [
      {
        id: "fallback-ftr",
        stripePriceId: process.env.STRIPE_PRICE_ID_FTR_SINGLE ?? "price_ftr_placeholder",
        kind: "CREDIT_PACK" as const,
        currency: "usd",
        amount: 5000,
        creditsGranted: 1,
        active: true,
      },
      {
        id: "fallback-sdp-srp",
        stripePriceId:
          process.env.STRIPE_PRICE_ID_SDP_SRP_SINGLE ?? "price_sdp_srp_placeholder",
        kind: "CREDIT_PACK" as const,
        currency: "usd",
        amount: 15000,
        creditsGranted: 1,
        active: true,
      },
      {
        id: "fallback-competency",
        stripePriceId:
          process.env.STRIPE_PRICE_ID_COMPETENCY_REVIEW ?? "price_competency_placeholder",
        kind: "CREDIT_PACK" as const,
        currency: "usd",
        amount: 50000,
        creditsGranted: 1,
        active: true,
      },
    ],
  },
  {
    id: "fallback-architecture-reviewer",
    slug: "architecture-diagram-reviewer",
    name: "Architecture Diagram Reviewer",
    description:
      "Free cloud architecture diagram reviewer for PNG/SVG uploads with deterministic findings delivered by email.",
    active: true,
    accessModel: "FREE" as const,
    prices: [],
  },
  {
    id: "fallback-landing-zone-readiness-checker",
    slug: "landing-zone-readiness-checker",
    name: "Landing Zone Readiness Checker",
    description:
      "Free deterministic landing-zone assessment for SMB teams with emailed scoring, findings, and consultation quote.",
    active: true,
    accessModel: "FREE" as const,
    prices: [],
  },
  {
    id: "fallback-cloud-cost-leak-finder",
    slug: "cloud-cost-leak-finder",
    name: "Cloud Cost Leak Finder",
    description:
      "Free deterministic cloud cost diagnostic for SMB teams with an emailed advisory memo, likely savings range, and consulting quote.",
    active: true,
    accessModel: "FREE" as const,
    prices: [],
  },
  {
    id: "fallback-mlops-platform",
    slug: "mlops-foundation-platform",
    name: "ZoKorp MLOps Foundation Platform",
    description:
      "Subscription SaaS for SMB teams needing streamlined MLOps workflows, governance checks, and delivery visibility.",
    active: true,
    accessModel: "SUBSCRIPTION" as const,
    prices: [
      {
        id: "fallback-mlops-monthly",
        stripePriceId: process.env.STRIPE_PRICE_ID_PLATFORM_MONTHLY ?? "price_mlops_monthly_placeholder",
        kind: "SUBSCRIPTION" as const,
        currency: "usd",
        amount: 100,
        creditsGranted: 0,
        active: true,
      },
      {
        id: "fallback-mlops-annual",
        stripePriceId: process.env.STRIPE_PRICE_ID_PLATFORM_ANNUAL ?? "price_mlops_annual_placeholder",
        kind: "SUBSCRIPTION" as const,
        currency: "usd",
        amount: 1000,
        creditsGranted: 0,
        active: true,
      },
    ],
  },
];

export async function getSoftwareCatalog() {
  if (!process.env.DATABASE_URL) {
    return fallbackCatalog;
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

    const bySlug = new Set(products.map((product) => product.slug));
    const missingFallback = fallbackCatalog.filter((product) => !bySlug.has(product.slug));
    return [...products, ...missingFallback].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return fallbackCatalog;
  }
}

export async function getProductBySlug(slug: string) {
  if (!process.env.DATABASE_URL) {
    return fallbackCatalog.find((product) => product.slug === slug) ?? null;
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

    return product ?? fallbackCatalog.find((item) => item.slug === slug) ?? null;
  } catch {
    return fallbackCatalog.find((product) => product.slug === slug) ?? null;
  }
}
