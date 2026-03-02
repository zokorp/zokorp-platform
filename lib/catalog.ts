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
];

export async function getSoftwareCatalog() {
  try {
    return await db.product.findMany({
      where: { active: true },
      include: {
        prices: {
          where: { active: true },
          orderBy: { amount: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    return fallbackCatalog;
  }
}

export async function getProductBySlug(slug: string) {
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
  } catch {
    return fallbackCatalog.find((product) => product.slug === slug) ?? null;
  }
}
