import { AccessModel } from "@prisma/client";

export function isPublicSubscriptionPricingApproved() {
  return process.env.PUBLIC_SUBSCRIPTION_PRICING_APPROVED === "true";
}

export function shouldHidePublicProductPricing(accessModel: AccessModel) {
  return accessModel === AccessModel.SUBSCRIPTION && !isPublicSubscriptionPricingApproved();
}
