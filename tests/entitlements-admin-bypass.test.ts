import { AccessModel, CreditTier } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasAdminEntitlementBypassMock } = vi.hoisted(() => ({
  hasAdminEntitlementBypassMock: vi.fn(),
}));

const {
  productFindUniqueMock,
  entitlementFindUniqueMock,
  transactionMock,
} = vi.hoisted(() => ({
  productFindUniqueMock: vi.fn(),
  entitlementFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
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
});
