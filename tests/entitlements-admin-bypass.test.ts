import { AccessModel, CreditTier } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasAdminEntitlementBypassMock } = vi.hoisted(() => ({
  hasAdminEntitlementBypassMock: vi.fn(),
}));

const {
  productFindUniqueMock,
  entitlementFindUniqueMock,
  transactionMock,
  txProductFindUniqueMock,
  txCreditBalanceUpdateManyMock,
  txCreditBalanceAggregateMock,
  txEntitlementUpdateManyMock,
  txEntitlementFindFirstMock,
} = vi.hoisted(() => ({
  productFindUniqueMock: vi.fn(),
  entitlementFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  txProductFindUniqueMock: vi.fn(),
  txCreditBalanceUpdateManyMock: vi.fn(),
  txCreditBalanceAggregateMock: vi.fn(),
  txEntitlementUpdateManyMock: vi.fn(),
  txEntitlementFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/admin-access", () => ({
  hasAdminEntitlementBypass: hasAdminEntitlementBypassMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findUnique: productFindUniqueMock,
    },
    entitlement: {
      findUnique: entitlementFindUniqueMock,
    },
    $transaction: transactionMock,
  },
}));

import { decrementUsesAtomically, requireEntitlement } from "@/lib/entitlements";

describe("entitlement admin bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback) =>
      callback({
        product: {
          findUnique: txProductFindUniqueMock,
        },
        creditBalance: {
          updateMany: txCreditBalanceUpdateManyMock,
          aggregate: txCreditBalanceAggregateMock,
        },
        entitlement: {
          updateMany: txEntitlementUpdateManyMock,
          findFirst: txEntitlementFindFirstMock,
        },
      }),
    );
  });

  it("allows an admin bypass on active paid products without loading entitlements", async () => {
    productFindUniqueMock.mockResolvedValue({
      id: "prod_validator",
      accessModel: AccessModel.ONE_TIME_CREDIT,
      active: true,
    });
    hasAdminEntitlementBypassMock.mockResolvedValue(true);

    const result = await requireEntitlement({
      userId: "user_admin",
      productSlug: "zokorp-validator",
      minUses: 1,
      creditTier: CreditTier.FTR,
      allowGeneralCreditFallback: true,
    });

    expect(result).toEqual({
      productId: "prod_validator",
      entitlement: null,
      adminBypass: true,
    });
    expect(entitlementFindUniqueMock).not.toHaveBeenCalled();
  });

  it("still blocks inactive products even for admins", async () => {
    productFindUniqueMock.mockResolvedValue({
      id: "prod_validator",
      accessModel: AccessModel.ONE_TIME_CREDIT,
      active: false,
    });
    hasAdminEntitlementBypassMock.mockResolvedValue(true);

    await expect(
      requireEntitlement({
        userId: "user_admin",
        productSlug: "zokorp-validator",
      }),
    ).rejects.toThrow("PRODUCT_NOT_AVAILABLE");
  });

  it("skips decrement work entirely for an admin test run", async () => {
    hasAdminEntitlementBypassMock.mockResolvedValue(true);

    await decrementUsesAtomically({
      userId: "user_admin",
      productSlug: "zokorp-validator",
      uses: 1,
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("returns the post-decrement remaining uses from the same transaction", async () => {
    hasAdminEntitlementBypassMock.mockResolvedValue(false);
    txProductFindUniqueMock.mockResolvedValue({
      id: "prod_validator",
      accessModel: AccessModel.ONE_TIME_CREDIT,
    });
    txEntitlementFindFirstMock.mockResolvedValue({
      remainingUses: 8,
    });
    txCreditBalanceUpdateManyMock.mockResolvedValue({ count: 1 });
    txCreditBalanceAggregateMock.mockResolvedValue({
      _sum: {
        remainingUses: 7,
      },
    });

    const result = await decrementUsesAtomically({
      userId: "user_123",
      productSlug: "zokorp-validator",
      uses: 1,
      creditTier: CreditTier.FTR,
      allowGeneralCreditFallback: true,
    });

    expect(result).toEqual({ remainingUses: 7 });
    expect(txCreditBalanceAggregateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user_123",
          productId: "prod_validator",
        }),
      }),
    );
  });
});
