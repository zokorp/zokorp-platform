import { db } from "@/lib/db";

export async function getSoftwareCatalog() {
  return db.product.findMany({
    where: { active: true },
    include: {
      prices: {
        where: { active: true },
        orderBy: { amount: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getProductBySlug(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      prices: {
        where: { active: true },
        orderBy: { amount: "asc" },
      },
    },
  });
}
