import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSameOriginMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  getSiteOriginFromRequestMock,
  getStripeClientMock,
  requireUserMock,
  userUpdateMock,
  auditCreateMock,
  customersRetrieveMock,
  customersUpdateMock,
  billingPortalSessionCreateMock,
} = vi.hoisted(() => ({
  requireSameOriginMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  getRequestFingerprintMock: vi.fn(),
  getSiteOriginFromRequestMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  requireUserMock: vi.fn(),
  userUpdateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  customersRetrieveMock: vi.fn(),
  customersUpdateMock: vi.fn(),
  billingPortalSessionCreateMock: vi.fn(),
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

vi.mock("@/lib/stripe", () => ({
  getStripeClient: getStripeClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update: userUpdateMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

import { GET, POST } from "@/app/api/stripe/create-portal-session/route";

describe("create portal session route", () => {
  const originalStripeSecret = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";

    requireSameOriginMock.mockReturnValue(null);
    consumeRateLimitMock.mockResolvedValue({ allowed: true });
    getRequestFingerprintMock.mockReturnValue("fingerprint");
    getSiteOriginFromRequestMock.mockReturnValue("https://app.zokorp.com");
    requireUserMock.mockResolvedValue({
      id: "user_123",
      email: "owner@acmecloud.com",
      name: "Owner",
      stripeCustomerId: "cus_existing",
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
    billingPortalSessionCreateMock.mockResolvedValue({
      id: "bps_test_123",
      url: "https://billing.stripe.com/p/session_123",
    });
    getStripeClientMock.mockReturnValue({
      customers: {
        retrieve: customersRetrieveMock,
        update: customersUpdateMock,
      },
      billingPortal: {
        sessions: {
          create: billingPortalSessionCreateMock,
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

  it("creates a billing portal session, audits it, and marks the response as non-cacheable", async () => {
    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          origin: "https://app.zokorp.com",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      url: "https://billing.stripe.com/p/session_123",
    });
    expect(billingPortalSessionCreateMock).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "https://app.zokorp.com/account",
    });
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.portal_session_created",
          metadataJson: expect.objectContaining({
            stripePortalSessionId: "bps_test_123",
            stripeCustomerId: "cus_existing",
          }),
        }),
      }),
    );
  });
});
