import { AccessModel, EntitlementStatus } from "@prisma/client";

import { db } from "@/lib/db";

export async function requireEntitlement(input: {
  userId: string;
  productSlug: string;
  minUses?: number;
}) {
  const minUses = input.minUses ?? 1;

  const product = await db.product.findUnique({
    where: { slug: input.productSlug },
    select: { id: true, accessModel: true, active: true },
  });

  if (!product || !product.active) {
    throw new Error("PRODUCT_NOT_AVAILABLE");
  }

  if (product.accessModel === AccessModel.FREE) {
    return { productId: product.id, entitlement: null };
  }

  const entitlement = await db.entitlement.findUnique({
    where: {
      userId_productId: {
        userId: input.userId,
        productId: product.id,
      },
    },
  });

  if (!entitlement || entitlement.status !== EntitlementStatus.ACTIVE) {
    throw new Error("ENTITLEMENT_REQUIRED");
  }

  if (product.accessModel === AccessModel.ONE_TIME_CREDIT) {
    if (entitlement.remainingUses < minUses) {
      throw new Error("INSUFFICIENT_USES");
    }
  }

  if (
    (product.accessModel === AccessModel.SUBSCRIPTION ||
      product.accessModel === AccessModel.METERED) &&
    entitlement.validUntil &&
    entitlement.validUntil < new Date()
  ) {
    throw new Error("SUBSCRIPTION_EXPIRED");
  }

  return { productId: product.id, entitlement };
}

export async function decrementUsesAtomically(input: {
  userId: string;
  productSlug: string;
  uses?: number;
}) {
  const uses = input.uses ?? 1;

  await db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { slug: input.productSlug },
      select: { id: true, accessModel: true },
    });

    if (!product) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    if (product.accessModel !== AccessModel.ONE_TIME_CREDIT) {
      return;
    }

    const updated = await tx.entitlement.updateMany({
      where: {
        userId: input.userId,
        productId: product.id,
        status: EntitlementStatus.ACTIVE,
        remainingUses: { gte: uses },
      },
      data: {
        remainingUses: { decrement: uses },
      },
    });

    if (updated.count === 0) {
      throw new Error("INSUFFICIENT_USES");
    }
  });
}
