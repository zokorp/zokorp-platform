import { unstable_cache } from "next/cache";

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

export async function getSoftwareCatalog() {
  if (!process.env.DATABASE_URL) {
    throw new CatalogUnavailableError("Catalog unavailable: DATABASE_URL is not configured.");
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
    throw new CatalogUnavailableError("Catalog unavailable: failed to load products.", { cause: error });
  }
}

export async function getProductBySlug(slug: string) {
  if (!process.env.DATABASE_URL) {
    throw new CatalogUnavailableError("Catalog unavailable: DATABASE_URL is not configured.");
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
    throw new CatalogUnavailableError(`Catalog unavailable: failed to load product '${slug}'.`, { cause: error });
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
