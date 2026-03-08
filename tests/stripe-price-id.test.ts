import { describe, expect, it } from "vitest";

import { isCheckoutEnabledStripePriceId } from "@/lib/stripe-price-id";

describe("stripe price id validation", () => {
  it("accepts real stripe price ids", () => {
    expect(isCheckoutEnabledStripePriceId("price_1PqTest123ABC")).toBe(true);
  });

  it("rejects placeholder-style ids and unconfigured markers", () => {
    expect(isCheckoutEnabledStripePriceId("price_ftr_placeholder")).toBe(false);
    expect(isCheckoutEnabledStripePriceId("unconfigured-ftr")).toBe(false);
  });

  it("rejects malformed ids that do not match stripe format", () => {
    expect(isCheckoutEnabledStripePriceId("")).toBe(false);
    expect(isCheckoutEnabledStripePriceId("abc_123")).toBe(false);
  });
});
