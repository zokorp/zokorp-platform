"use server";

import { AccessModel, PriceKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const createProductSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  description: z.string().min(10),
  accessModel: z.nativeEnum(AccessModel),
});

const createPriceSchema = z.object({
  productSlug: z.string().min(3),
  stripePriceId: z.string().min(3),
  kind: z.nativeEnum(PriceKind),
  amount: z.coerce.number().int().positive(),
  creditsGranted: z.coerce.number().int().nonnegative().default(1),
});

export async function createProductAction(formData: FormData) {
  await requireAdmin();

  const parsed = createProductSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description"),
    accessModel: formData.get("accessModel"),
  });

  if (!parsed.success) {
    throw new Error("Invalid product form values");
  }

  await db.product.create({
    data: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      accessModel: parsed.data.accessModel,
      active: true,
    },
  });

  revalidatePath("/software");
  revalidatePath("/admin/products");
}

export async function createPriceAction(formData: FormData) {
  await requireAdmin();

  const parsed = createPriceSchema.safeParse({
    productSlug: formData.get("productSlug"),
    stripePriceId: formData.get("stripePriceId"),
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    creditsGranted: formData.get("creditsGranted"),
  });

  if (!parsed.success) {
    throw new Error("Invalid price form values");
  }

  const product = await db.product.findUnique({
    where: { slug: parsed.data.productSlug },
    select: { id: true },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  await db.price.create({
    data: {
      productId: product.id,
      stripePriceId: parsed.data.stripePriceId,
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      creditsGranted: parsed.data.creditsGranted,
      currency: "usd",
      active: true,
    },
  });

  revalidatePath("/software");
  revalidatePath("/admin/prices");
}
