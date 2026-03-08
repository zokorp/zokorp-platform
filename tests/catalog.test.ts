import { afterEach, describe, expect, it, vi } from "vitest";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }

  vi.resetModules();
});

describe("public catalog fallback", () => {
  it("returns the static public catalog when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    const { getSoftwareCatalog } = await import("@/lib/catalog");
    const products = await getSoftwareCatalog();

    expect(products.map((product) => product.slug)).toEqual([
      "zokorp-validator",
      "architecture-diagram-reviewer",
      "ai-decider",
      "landing-zone-readiness-checker",
      "cloud-cost-leak-finder",
    ]);
  });

  it("returns a fallback product for known software slugs when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;

    const { getProductBySlug } = await import("@/lib/catalog");
    const product = await getProductBySlug("architecture-diagram-reviewer");

    expect(product).toMatchObject({
      slug: "architecture-diagram-reviewer",
      name: "Architecture Diagram Reviewer",
      accessModel: "FREE",
    });
  });
});
