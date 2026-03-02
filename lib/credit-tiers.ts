import { CreditTier } from "@prisma/client";

import type { ValidationProfile } from "@/lib/zokorp-validator-engine";

export type ValidatorProfileCredits = Record<ValidationProfile, number>;

export function validatorTierForProfile(profile: ValidationProfile): CreditTier {
  switch (profile) {
    case "FTR":
      return CreditTier.FTR;
    case "SDP":
    case "SRP":
      return CreditTier.SDP_SRP;
    case "COMPETENCY":
      return CreditTier.COMPETENCY;
    default:
      return CreditTier.GENERAL;
  }
}

export function validatorPriceTierFromAmount(amount: number): CreditTier {
  if (amount === 5000) {
    return CreditTier.FTR;
  }

  if (amount === 15000) {
    return CreditTier.SDP_SRP;
  }

  if (amount === 50000) {
    return CreditTier.COMPETENCY;
  }

  return CreditTier.GENERAL;
}

export function effectiveCreditTierForPrice(price: {
  creditTier: CreditTier;
  amount: number;
  product: { slug: string };
}): CreditTier {
  if (price.product.slug === "zokorp-validator" && price.creditTier === CreditTier.GENERAL) {
    return validatorPriceTierFromAmount(price.amount);
  }

  return price.creditTier;
}

export function validatorProfileCreditsFromTiers(input: Partial<Record<CreditTier, number>>): ValidatorProfileCredits {
  const sdpSrp = input[CreditTier.SDP_SRP] ?? 0;

  return {
    FTR: input[CreditTier.FTR] ?? 0,
    SDP: sdpSrp,
    SRP: sdpSrp,
    COMPETENCY: input[CreditTier.COMPETENCY] ?? 0,
  };
}

export function validatorTierLabel(tier: CreditTier): string {
  switch (tier) {
    case CreditTier.FTR:
      return "FTR";
    case CreditTier.SDP_SRP:
      return "SDP/SRP";
    case CreditTier.COMPETENCY:
      return "Competency";
    case CreditTier.GENERAL:
    default:
      return "General";
  }
}
