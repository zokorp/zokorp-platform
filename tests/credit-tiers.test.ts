import { CreditTier } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  effectiveCreditTierForPrice,
  validatorPriceTierFromAmount,
  validatorProfileCreditsFromTiers,
  validatorTierForProfile,
} from "@/lib/credit-tiers";

describe("credit tier helpers", () => {
  it("maps validator profiles to tier wallets", () => {
    expect(validatorTierForProfile("FTR")).toBe(CreditTier.FTR);
    expect(validatorTierForProfile("SDP")).toBe(CreditTier.SDP_SRP);
    expect(validatorTierForProfile("SRP")).toBe(CreditTier.SDP_SRP);
    expect(validatorTierForProfile("COMPETENCY")).toBe(CreditTier.COMPETENCY);
  });

  it("infers validator price tiers from known amounts", () => {
    expect(validatorPriceTierFromAmount(5000)).toBe(CreditTier.FTR);
    expect(validatorPriceTierFromAmount(15000)).toBe(CreditTier.SDP_SRP);
    expect(validatorPriceTierFromAmount(50000)).toBe(CreditTier.COMPETENCY);
    expect(validatorPriceTierFromAmount(9999)).toBe(CreditTier.GENERAL);
  });

  it("uses validator amount fallback when price tier is still general", () => {
    const fallbackTier = effectiveCreditTierForPrice({
      creditTier: CreditTier.GENERAL,
      amount: 15000,
      product: { slug: "zokorp-validator" },
    });
    expect(fallbackTier).toBe(CreditTier.SDP_SRP);

    const explicitTier = effectiveCreditTierForPrice({
      creditTier: CreditTier.COMPETENCY,
      amount: 50000,
      product: { slug: "zokorp-validator" },
    });
    expect(explicitTier).toBe(CreditTier.COMPETENCY);
  });

  it("projects tier balances into profile balances", () => {
    const profileCredits = validatorProfileCreditsFromTiers({
      [CreditTier.FTR]: 2,
      [CreditTier.SDP_SRP]: 3,
      [CreditTier.COMPETENCY]: 1,
    });

    expect(profileCredits.FTR).toBe(2);
    expect(profileCredits.SDP).toBe(3);
    expect(profileCredits.SRP).toBe(3);
    expect(profileCredits.COMPETENCY).toBe(1);
  });
});
