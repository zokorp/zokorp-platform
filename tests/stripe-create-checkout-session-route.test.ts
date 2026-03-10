import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSameOriginMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  getSiteOriginFromRequestMock,
  isCheckoutEnabledStripePriceIdMock,
  getStripeClientMock,
  requireUserMock,
  priceFindUniqueMock,
  userUpdateMock,
  auditCreateMock,
  customersRetrieveMock,
  customersUpdateMock,
  checkoutSessionCreateMock,
} = vi.hoisted(() => ({
  requireSameOriginMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  getRequestFingerprintMock: vi.fn(),
  getSiteOriginFromRequestMock: vi.fn(),
  isCheckoutEnabledStripePriceIdMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  requireUserMock: vi.fn(),
  priceFindUniqueMock: vi.fn(),
  userUpdateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  customersRetrieveMock: vi.fn(),
  customersUpdateMock: vi.fn(),
  checkoutSessionCreateMock: vi.fn(),
}));

vi.mock("@/lib/request-origin", () => ({
  requireSameOrigin: requireSameOriginMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getRequestFingerprint: getRequestFingerprintMock,
}));

vi.mock("@/lib/site-origin", () => ({
  getSiteOriginFromRequest: getSiteOriginFromRequestMock,
}));

vi.mock("@/lib/stripe-price-id", () => ({
  isCheckoutEnabledStripePriceId: isCheckoutEnabledStripePriceIdMock,
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    price: {
      findUnique: priceFindUniqueMock,
    },
    user: {
      update: userUpdateMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

import { GET, POST } from "@/app/api/stripe/create-checkout-session/route";

describe("create checkout session route", () => {
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    requireSameOriginMock.mockReturnValue(null);
    consumeRateLimitMock.mockResolvedValue({ allowed: true });
    getRequestFingerprintMock.mockReturnValue("fingerprint");
    getSiteOriginFromRequestMock.mockReturnValue("https://app.zokorp.com");
    isCheckoutEnabledStripePriceIdMock.mockReturnValue(true);
    requireUserMock.mockResolvedValue({
      id: "user_123",
      email: "owner@acmecloud.com",
      name: "Owner",
      stripeCustomerId: "cus_existing",
    });
    priceFindUniqueMock.mockResolvedValue({
      id: "price_db_123",
      stripePriceId: "price_123",
      productId: "product_123",
      creditsGranted: 1,
      kind: "ONE_TIME",
      active: true,
      product: {
        slug: "zokorp-validator",
        active: true,
      },
    });
    auditCreateMock.mockResolvedValue({});
    userUpdateMock.mockResolvedValue({});
    customersRetrieveMock.mockResolvedValue({
      id: "cus_existing",
      email: "owner@acmecloud.com",
      metadata: {
        userId: "user_123",
      },
    });
    customersUpdateMock.mockResolvedValue({});
    checkoutSessionCreateMock.mockResolvedValue({
      id: "cs_test_123",
      mode: "payment",
      url: "https://checkout.stripe.com/c/pay_123",
    });
    getStripeClientMock.mockReturnValue({
      customers: {
        retrieve: customersRetrieveMock,
        update: customersUpdateMock,
      },
      checkout: {
        sessions: {
          create: checkoutSessionCreateMock,
        },
      },
    });
  });

  afterEach(() => {
    if (originalStripeSecret === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = originalStripeSecret;
    }
  });

  it("rejects GET and marks the response as non-cacheable", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
  });

  it("backfills missing Stripe customer metadata when the stored customer email matches the signed-in user", async () => {
    customersRetrieveMock.mockResolvedValueOnce({
      id: "cus_existing",
      email: "owner@acmecloud.com",
      metadata: {},
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          priceId: "price_123",
          productSlug: "zokorp-validator",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay_123",
    });
    expect(customersUpdateMock).toHaveBeenCalledWith("cus_existing", {
      metadata: {
        userId: "user_123",
      },
    });
    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        success_url: "https://app.zokorp.com/software/zokorp-validator?checkout=success",
        cancel_url: "https://app.zokorp.com/software/zokorp-validator?checkout=cancelled",
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.customer_binding_backfilled",
        }),
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.checkout_session_created",
        }),
      }),
    );
  });

  it("fails closed when the stored Stripe customer belongs to a different user", async () => {
    customersRetrieveMock.mockResolvedValueOnce({
      id: "cus_other",
      email: "other@acmecloud.com",
      metadata: {
        userId: "user_other",
      },
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          priceId: "price_123",
          productSlug: "zokorp-validator",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Billing profile could not be verified. Please contact support.",
    });
    expect(checkoutSessionCreateMock).not.toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.customer_binding_rejected",
        }),
      }),
    );
  });
});
