import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  constructEventMock,
  subscriptionRetrieveMock,
  invoiceRetrieveMock,
  chargeRetrieveMock,
  entitlementUpdateManyMock,
  userFindUniqueMock,
  priceFindUniqueMock,
  transactionMock,
  auditCreateMock,
  recordStripeWebhookEventMock,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  subscriptionRetrieveMock: vi.fn(),
  invoiceRetrieveMock: vi.fn(),
  chargeRetrieveMock: vi.fn(),
  entitlementUpdateManyMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  priceFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  auditCreateMock: vi.fn(),
  recordStripeWebhookEventMock: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
    subscriptions: {
      retrieve: subscriptionRetrieveMock,
    },
    invoices: {
      retrieve: invoiceRetrieveMock,
    },
    charges: {
      retrieve: chargeRetrieveMock,
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

vi.mock("@/lib/stripe-webhook-events", () => ({
  recordStripeWebhookEvent: recordStripeWebhookEventMock,
}));

import { GET, POST } from "@/app/api/stripe/webhook/route";

describe("stripe webhook route", () => {
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_123";
    entitlementUpdateManyMock.mockResolvedValue({ count: 1 });
    auditCreateMock.mockResolvedValue({});
    recordStripeWebhookEventMock.mockResolvedValue(undefined);
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
    subscriptionRetrieveMock.mockResolvedValue(null);
    invoiceRetrieveMock.mockResolvedValue(null);
    chargeRetrieveMock.mockResolvedValue(null);
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
    expect(recordStripeWebhookEventMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        event: expect.objectContaining({
          id: "evt_sub_updated",
        }),
        processingStatus: "received",
      }),
    );
    expect(recordStripeWebhookEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: expect.objectContaining({
          id: "evt_sub_updated",
        }),
        processingStatus: "processed",
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
    expect(recordStripeWebhookEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: expect.objectContaining({
          id: "evt_checkout_missing_metadata",
        }),
        processingStatus: "ignored",
      }),
    );
  });

  it("syncs entitlement on customer.subscription.created so out-of-checkout subscriptions are picked up", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_sub_created",
      type: "customer.subscription.created",
      data: {
        object: {
          id: "sub_new",
          status: "active",
          current_period_end: 1_900_000_000,
        },
      },
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(entitlementUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_new" },
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.subscription_sync_applied",
          metadataJson: expect.objectContaining({
            stripeSubscriptionId: "sub_new",
            eventType: "customer.subscription.created",
          }),
        }),
      }),
    );
  });

  it("extends subscription validity on invoice.paid", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_invoice_paid",
      type: "invoice.paid",
      data: {
        object: {
          id: "in_paid_1",
          customer: "cus_1",
          subscription: "sub_paid_1",
          amount_paid: 1000,
          currency: "usd",
          status: "paid",
        },
      },
    });
    subscriptionRetrieveMock.mockResolvedValueOnce({
      id: "sub_paid_1",
      status: "active",
      current_period_end: 2_000_000_000,
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(subscriptionRetrieveMock).toHaveBeenCalledWith("sub_paid_1");
    expect(entitlementUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_paid_1" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.invoice_paid",
          metadataJson: expect.objectContaining({
            stripeInvoiceId: "in_paid_1",
            stripeSubscriptionId: "sub_paid_1",
          }),
        }),
      }),
    );
  });

  it("revokes subscription entitlement on charge.refunded for a subscription invoice", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_charge_refunded_sub",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_ref_1",
          customer: "cus_sub",
          invoice: "in_sub_1",
          amount_refunded: 1000,
          amount_captured: 1000,
          currency: "usd",
        },
      },
    });
    userFindUniqueMock.mockResolvedValueOnce({ id: "user_sub" });
    invoiceRetrieveMock.mockResolvedValueOnce({
      id: "in_sub_1",
      subscription: "sub_refund_1",
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(invoiceRetrieveMock).toHaveBeenCalledWith("in_sub_1");
    expect(entitlementUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_refund_1", status: "ACTIVE" },
        data: { status: "REVOKED" },
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.entitlement_revoked_for_refund",
          userId: "user_sub",
          metadataJson: expect.objectContaining({
            stripeSubscriptionId: "sub_refund_1",
            stripeChargeId: "ch_ref_1",
          }),
        }),
      }),
    );
    expect(recordStripeWebhookEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        processingStatus: "processed",
        metadata: expect.objectContaining({
          revocationOutcome: "subscription_entitlement_revoked",
        }),
      }),
    );
  });

  it("flags one-time charge refunds for manual review when there is no linked invoice", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_charge_refunded_oneshot",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_ref_2",
          customer: "cus_oneshot",
          invoice: null,
          amount_refunded: 5000,
          amount_captured: 5000,
          currency: "usd",
        },
      },
    });
    userFindUniqueMock.mockResolvedValueOnce({ id: "user_oneshot" });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(entitlementUpdateManyMock).not.toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.refund_manual_review_required",
          userId: "user_oneshot",
        }),
      }),
    );
    expect(recordStripeWebhookEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          revocationOutcome: "manual_review_required",
        }),
      }),
    );
  });

  it("freezes subscription entitlement on charge.dispute.created", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_dispute_created",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          charge: "ch_dispute_1",
          amount: 1000,
          currency: "usd",
          reason: "fraudulent",
          status: "needs_response",
        },
      },
    });
    chargeRetrieveMock.mockResolvedValueOnce({
      id: "ch_dispute_1",
      customer: "cus_dispute",
      invoice: "in_dispute_1",
    });
    invoiceRetrieveMock.mockResolvedValueOnce({
      id: "in_dispute_1",
      subscription: "sub_dispute_1",
    });
    userFindUniqueMock.mockResolvedValueOnce({ id: "user_dispute" });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(chargeRetrieveMock).toHaveBeenCalledWith("ch_dispute_1");
    expect(entitlementUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_dispute_1", status: "ACTIVE" },
        data: { status: "REVOKED" },
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.entitlement_frozen_for_dispute",
          userId: "user_dispute",
        }),
      }),
    );
    expect(recordStripeWebhookEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          freezeOutcome: "subscription_entitlement_frozen",
        }),
      }),
    );
  });

  it("restores entitlement on charge.dispute.closed when the dispute is won", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_dispute_won",
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_2",
          charge: "ch_dispute_2",
          amount: 1000,
          currency: "usd",
          reason: "fraudulent",
          status: "won",
        },
      },
    });
    chargeRetrieveMock.mockResolvedValueOnce({
      id: "ch_dispute_2",
      customer: "cus_won",
      invoice: "in_dispute_2",
    });
    invoiceRetrieveMock.mockResolvedValueOnce({
      id: "in_dispute_2",
      subscription: "sub_dispute_2",
    });
    subscriptionRetrieveMock.mockResolvedValueOnce({
      id: "sub_dispute_2",
      status: "active",
    });
    userFindUniqueMock.mockResolvedValueOnce({ id: "user_won" });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(entitlementUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: "sub_dispute_2", status: "REVOKED" },
        data: { status: "ACTIVE" },
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing.entitlement_restored_after_dispute_won",
          userId: "user_won",
        }),
      }),
    );
    expect(recordStripeWebhookEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          restoreOutcome: "subscription_entitlement_restored",
        }),
      }),
    );
  });

  it("does not restore entitlement on charge.dispute.closed when the dispute is lost", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_dispute_lost",
      type: "charge.dispute.closed",
      data: {
        object: {
          id: "dp_3",
          charge: "ch_dispute_3",
          amount: 1000,
          currency: "usd",
          reason: "fraudulent",
          status: "lost",
        },
      },
    });

    const response = await POST(
      new Request("https://app.zokorp.com/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(entitlementUpdateManyMock).not.toHaveBeenCalled();
    expect(chargeRetrieveMock).not.toHaveBeenCalled();
    expect(recordStripeWebhookEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          restoreOutcome: "dispute_lost_no_action",
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
    expect(recordStripeWebhookEventMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        event: expect.objectContaining({
          id: "evt_sub_failure",
        }),
        processingStatus: "failed",
      }),
    );

    consoleErrorSpy.mockRestore();
  });
});
