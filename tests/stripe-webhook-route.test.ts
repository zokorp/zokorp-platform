import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  constructEventMock,
  subscriptionRetrieveMock,
  entitlementUpdateManyMock,
  userFindUniqueMock,
  priceFindUniqueMock,
  transactionMock,
  auditCreateMock,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  subscriptionRetrieveMock: vi.fn(),
  entitlementUpdateManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  priceFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  auditCreateMock: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
    subscriptions: {
      retrieve: subscriptionRetrieveMock,
    },
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    entitlement: {
      updateMany: entitlementUpdateManyMock,
    },
    user: {
      findUnique: userFindUniqueMock,
    },
    price: {
      findUnique: priceFindUniqueMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
    $transaction: transactionMock,
  },
}));

import { GET, POST } from "@/app/api/stripe/webhook/route";

describe("stripe webhook route", () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
    entitlementUpdateManyMock.mockResolvedValue({ count: 1 });
    auditCreateMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback) =>
      callback({
        checkoutFulfillment: { create: vi.fn() },
        user: { update: vi.fn() },
        entitlement: { upsert: vi.fn() },
        creditBalance: { upsert: vi.fn(), aggregate: vi.fn() },
        auditLog: { create: vi.fn() },
      }),
    );
    userFindUniqueMock.mockResolvedValue(null);
    priceFindUniqueMock.mockResolvedValue(null);
  });

  afterEach(() => {
    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it("rejects GET and marks the response as non-cacheable", async () => {
    const response = await GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
  });

  it("audits subscription lifecycle sync events", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_sub_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "active",
          current_period_end: 1_799_999_999,
        },
      },
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(entitlementUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_123" },
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.subscription_sync_applied",
          metadataJson: expect.objectContaining({
            stripeEventId: "evt_sub_updated",
            stripeSubscriptionId: "sub_123",
            status: "active",
          }),
        }),
      }),
    );
  });

  it("audits signed checkout events that cannot be fulfilled because required metadata is missing", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_checkout_missing_metadata",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_123",
          metadata: {},
          payment_status: "paid",
        },
      },
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.webhook_checkout_skipped",
          metadataJson: expect.objectContaining({
            stripeEventId: "evt_checkout_missing_metadata",
            reason: "missing_checkout_metadata",
          }),
        }),
      }),
    );
  });

  it("audits signed webhook failures after signature verification", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_sub_failure",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_456",
          status: "canceled",
          current_period_end: 1_799_999_999,
        },
      },
    });
    entitlementUpdateManyMock.mockRejectedValueOnce(new Error("database unavailable"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe("Webhook handler failed");
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.webhook_failed",
          metadataJson: expect.objectContaining({
            stripeEventId: "evt_sub_failure",
            eventType: "customer.subscription.deleted",
            error: "database unavailable",
          }),
        }),
      }),
    );

    consoleErrorSpy.mockRestore();
  });
});
