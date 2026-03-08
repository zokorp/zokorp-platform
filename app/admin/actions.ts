"use server";

import { AccessModel, PriceKind, ServiceRequestStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCheckoutEnabledStripePriceId } from "@/lib/stripe-price-id";

const createProductSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  description: z.string().min(10),
  accessModel: z.nativeEnum(AccessModel),
});

const createPriceSchema = z.object({
  productSlug: z.string().min(3),
  stripePriceId: z.string().trim().min(3),
  kind: z.nativeEnum(PriceKind),
  amount: z.coerce.number().int().positive(),
  creditsGranted: z.coerce.number().int().nonnegative().default(1),
});

const updateServiceRequestSchema = z.object({
  requestId: z.string().cuid(),
  status: z.nativeEnum(ServiceRequestStatus),
  latestNote: z.string().trim().max(240).optional(),
});

function revalidateAdminViews() {
  revalidatePath("/");
  revalidatePath("/software");
  revalidatePath("/software/[slug]", "page");
  revalidatePath("/services");
  revalidatePath("/account");
  revalidatePath("/admin/products");
  revalidatePath("/admin/prices");
  revalidatePath("/admin/service-requests");
}

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

  revalidateAdminViews();
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

  if (!isCheckoutEnabledStripePriceId(parsed.data.stripePriceId)) {
    throw new Error("Invalid Stripe price ID");
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

  revalidateAdminViews();
}

export async function toggleProductActiveAction(formData: FormData) {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  if (!productId) {
    throw new Error("Missing product id");
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { active: true },
  });

  if (!product) {
    throw new Error("Product not found");
  }

  await db.product.update({
    where: { id: productId },
    data: { active: !product.active },
  });

  revalidateAdminViews();
}

export async function togglePriceActiveAction(formData: FormData) {
  await requireAdmin();

  const priceId = String(formData.get("priceId") ?? "");
  if (!priceId) {
    throw new Error("Missing price id");
  }

  const price = await db.price.findUnique({
    where: { id: priceId },
    select: { active: true },
  });

  if (!price) {
    throw new Error("Price not found");
  }

  await db.price.update({
    where: { id: priceId },
    data: { active: !price.active },
  });

  revalidateAdminViews();
}

export async function updateServiceRequestStatusAction(formData: FormData) {
  await requireAdmin();

  const parsed = updateServiceRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    status: formData.get("status"),
    latestNote: formData.get("latestNote") || undefined,
  });

  if (!parsed.success) {
    throw new Error("Invalid service request update values");
  }

  const existing = await db.serviceRequest.findUnique({
    where: { id: parsed.data.requestId },
    select: { id: true, userId: true, trackingCode: true, status: true },
  });

  if (!existing) {
    throw new Error("Service request not found");
  }

  await db.serviceRequest.update({
    where: { id: parsed.data.requestId },
    data: {
      status: parsed.data.status,
      latestNote: parsed.data.latestNote || null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: existing.userId,
      action: "service.request_status_updated",
      metadataJson: {
        trackingCode: existing.trackingCode,
        previousStatus: existing.status,
        nextStatus: parsed.data.status,
      },
    },
  });

  revalidateAdminViews();
}
