import type { MetadataRoute } from "next";

import { getMediaArticles } from "@/data/media-articles";
import { ARCHITECTURE_BENCHMARK_LIBRARY } from "@/lib/architecture-benchmarks";
import { CatalogUnavailableError, getSoftwareCatalog } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site";

const staticRoutes = [
  "/",
  "/about",
  "/case-studies",
  "/contact",
  "/media",
  "/pricing",
  "/privacy",
  "/refunds",
  "/security",
  "/services",
  "/software",
  "/software/architecture-diagram-reviewer/benchmarks",
  "/software/architecture-diagram-reviewer/benchmarks/monthly",
  "/support",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();
  const now = new Date();
  let products: Awaited<ReturnType<typeof getSoftwareCatalog>> = [];

  try {
    products = await getSoftwareCatalog();
  } catch (error) {
    if (!(error instanceof CatalogUnavailableError)) {
      throw error;
    }
  }
  const mediaArticles = getMediaArticles();
  const benchmarkRoutes = ARCHITECTURE_BENCHMARK_LIBRARY.flatMap((provider) => {
    const providerPath = `/software/architecture-diagram-reviewer/benchmarks/${provider.provider}`;
    const patternRoutes = provider.patterns.map(
      (pattern) => `/software/architecture-diagram-reviewer/benchmarks/${provider.provider}/${pattern.slug}`,
    );

    return [providerPath, ...patternRoutes];
  });

  return [
    ...staticRoutes.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
    })),
    ...products.map((product) => ({
      url: `${baseUrl}/software/${product.slug}`,
      lastModified: now,
    })),
    ...mediaArticles.map((article) => ({
      url: `${baseUrl}/media/${article.slug}`,
      lastModified: new Date(article.publishedAt),
    })),
    ...benchmarkRoutes.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: now,
    })),
  ];
}
