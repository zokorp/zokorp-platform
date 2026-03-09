import { AccessModel, CreditTier, EntitlementStatus, Prisma } from "@prisma/client";

import { hasAdminEntitlementBypass } from "@/lib/admin-access";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";

async function syncEntitlementRemainingUses(tx: Prisma.TransactionClient, userId: string, productId: string) {
  const aggregated = await tx.creditBalance.aggregate({
    where: {
      userId,
      productId,
      status: EntitlementStatus.ACTIVE,
    },
    _sum: {
      remainingUses: true,
    },
  });

  await tx.entitlement.updateMany({
    where: {
      userId,
      productId,
      status: EntitlementStatus.ACTIVE,
    },
    data: {
      remainingUses: aggregated._sum.remainingUses ?? 0,
    },
  });
}

export async function requireEntitlement(input: {
  userId: string;
  productSlug: string;
  minUses?: number;
  creditTier?: CreditTier;
  allowGeneralCreditFallback?: boolean;
}) {
  const minUses = input.minUses ?? 1;

  const product = await db.product.findUnique({
    where: { slug: input.productSlug },
    select: { id: true, accessModel: true, active: true },
  });

  if (!product || !product.active) {
    throw new Error("PRODUCT_NOT_AVAILABLE");
  }

  const adminBypass = await hasAdminEntitlementBypass(input.userId);

  if (product.accessModel === AccessModel.FREE) {
    return { productId: product.id, entitlement: null, adminBypass };
  }

  if (adminBypass) {
    return { productId: product.id, entitlement: null, adminBypass: true };
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
    if (input.creditTier) {
      try {
        const candidateTiers = input.allowGeneralCreditFallback
          ? [input.creditTier, CreditTier.GENERAL]
          : [input.creditTier];
        const balances = await db.creditBalance.findMany({
          where: {
            userId: input.userId,
            productId: product.id,
            status: EntitlementStatus.ACTIVE,
            tier: { in: candidateTiers },
          },
          select: {
            tier: true,
            remainingUses: true,
          },
        });

        const exactTierUses =
          balances.find((item) => item.tier === input.creditTier)?.remainingUses ?? 0;
        const fallbackUses =
          input.allowGeneralCreditFallback
            ? balances.find((item) => item.tier === CreditTier.GENERAL)?.remainingUses ?? 0
            : 0;

        if (exactTierUses + fallbackUses < minUses) {
          throw new Error("INSUFFICIENT_USES");
        }
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }

        if (entitlement.remainingUses < minUses) {
          throw new Error("INSUFFICIENT_USES");
        }
      }
    } else if (entitlement.remainingUses < minUses) {
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

  return { productId: product.id, entitlement, adminBypass: false };
}

export async function decrementUsesAtomically(input: {
  userId: string;
  productSlug: string;
  uses?: number;
  creditTier?: CreditTier;
  allowGeneralCreditFallback?: boolean;
}) {
  const uses = input.uses ?? 1;
  const adminBypass = await hasAdminEntitlementBypass(input.userId);

  if (adminBypass) {
    return;
  }

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

    if (input.creditTier) {
      try {
        const consumeFromTier = async (tier: CreditTier) =>
          tx.creditBalance.updateMany({
            where: {
              userId: input.userId,
              productId: product.id,
              tier,
              status: EntitlementStatus.ACTIVE,
              remainingUses: { gte: uses },
            },
            data: {
              remainingUses: { decrement: uses },
            },
          });

        let updated = await consumeFromTier(input.creditTier);

        if (updated.count === 0 && input.allowGeneralCreditFallback) {
          updated = await consumeFromTier(CreditTier.GENERAL);
        }

        if (updated.count === 0) {
          throw new Error("INSUFFICIENT_USES");
        }

        await syncEntitlementRemainingUses(tx, input.userId, product.id);
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }

        const legacyUpdated = await tx.entitlement.updateMany({
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

        if (legacyUpdated.count === 0) {
          throw new Error("INSUFFICIENT_USES");
        }
      }
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
