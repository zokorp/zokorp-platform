import { createHmac } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  leadUpsert: vi.fn(),
  leadInteractionFindUnique: vi.fn(),
  leadInteractionCreate: vi.fn(),
  leadInteractionUpdate: vi.fn(),
  serviceRequestCreate: vi.fn(),
  serviceRequestUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    lead: {
      upsert: mocks.leadUpsert,
    },
    leadInteraction: {
      findUnique: mocks.leadInteractionFindUnique,
      create: mocks.leadInteractionCreate,
      update: mocks.leadInteractionUpdate,
    },
    serviceRequest: {
      create: mocks.serviceRequestCreate,
      update: mocks.serviceRequestUpdate,
    },
    auditLog: {
      create: mocks.auditCreate,
    },
  },
}));

import { POST } from "@/app/api/webhooks/calendly/route";

function signedWebhookRequest(body: string, signingKey: string, timestamp = String(Math.floor(Date.now() / 1000))) {
  const signature = createHmac("sha256", signingKey)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  return new Request("http://localhost/api/webhooks/calendly", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Calendly-Webhook-Signature": `t=${timestamp},v1=${signature}`,
    },
    body,
  });
}

describe("Calendly webhook route", () => {
  const originalSigningKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = "calendly-signing-key";
    mocks.userFindUnique.mockResolvedValue({
      id: "user_123",
      email: "architect@zokorp.com",
      name: "Jordan Rivera",
    });
    mocks.leadUpsert.mockResolvedValue({
      id: "lead_123",
    });
    mocks.leadInteractionFindUnique.mockResolvedValue(null);
    mocks.leadInteractionCreate.mockResolvedValue({
      id: "interaction_123",
      serviceRequestId: null,
    });
    mocks.serviceRequestCreate.mockResolvedValue({
      id: "request_123",
      trackingCode: "SR-260324-ABCDE",
    });
    mocks.serviceRequestUpdate.mockResolvedValue({});
    mocks.leadInteractionUpdate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
  });

  afterEach(() => {
    if (originalSigningKey === undefined) {
      delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    } else {
      process.env.CALENDLY_WEBHOOK_SIGNING_KEY = originalSigningKey;
    }
  });

  it("creates a minimal interaction and scheduled service request for a valid booked call", async () => {
    const body = JSON.stringify({
      event: "invitee.created",
      payload: {
        email: "architect@zokorp.com",
        name: "Jordan Rivera",
        uri: "https://api.calendly.com/invitees/abc123",
        tracking: {
          utm_content: "ZK-ARCH-20260324-ABC123",
        },
        scheduled_event: {
          start_time: "2026-03-25T16:00:00.000Z",
        },
      },
    });

    const response = await POST(signedWebhookRequest(body, "calendly-signing-key"));

    expect(response.status).toBe(200);
    expect(mocks.leadInteractionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.serviceRequestCreate).toHaveBeenCalledTimes(1);
    expect(mocks.serviceRequestUpdate).toHaveBeenCalledWith({
      where: { id: "request_123" },
      data: { status: "SCHEDULED" },
    });
    expect(mocks.leadInteractionUpdate).toHaveBeenCalledWith({
      where: { id: "interaction_123" },
      data: { serviceRequestId: "request_123" },
    });
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      serviceRequestId: "request_123",
    });
  });

  it("is idempotent when the external event was already processed", async () => {
    const body = JSON.stringify({
      event: "invitee.created",
      payload: {
        email: "architect@zokorp.com",
        uri: "https://api.calendly.com/invitees/abc123",
        scheduled_event: {
          start_time: "2026-03-25T16:00:00.000Z",
        },
      },
    });
    mocks.leadInteractionFindUnique.mockResolvedValue({
      id: "interaction_123",
      serviceRequestId: "request_123",
    });

    const response = await POST(signedWebhookRequest(body, "calendly-signing-key"));

    expect(response.status).toBe(200);
    expect(mocks.leadInteractionCreate).not.toHaveBeenCalled();
    expect(mocks.serviceRequestCreate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      serviceRequestId: "request_123",
    });
  });

  it("records the interaction without creating a service request when the email is unmatched", async () => {
    const body = JSON.stringify({
      event: "invitee.created",
      payload: {
        email: "prospect@outsideco.com",
        uri: "https://api.calendly.com/invitees/abc999",
        scheduled_event: {
          start_time: "2026-03-25T16:00:00.000Z",
        },
      },
    });
    mocks.userFindUnique.mockResolvedValue(null);

    const response = await POST(signedWebhookRequest(body, "calendly-signing-key"));

    expect(response.status).toBe(200);
    expect(mocks.leadInteractionCreate).toHaveBeenCalledTimes(1);
    expect(mocks.serviceRequestCreate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      serviceRequestId: null,
    });
  });

  it("ignores unsupported events", async () => {
    const body = JSON.stringify({
      event: "invitee.canceled",
      payload: {
        email: "architect@zokorp.com",
      },
    });

    const response = await POST(signedWebhookRequest(body, "calendly-signing-key"));

    expect(response.status).toBe(200);
    expect(mocks.leadInteractionCreate).not.toHaveBeenCalled();
    expect(mocks.serviceRequestCreate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      status: "ignored",
      reason: "unsupported_event",
    });
  });

  it("rejects stale webhook signatures before ingesting the payload", async () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const body = JSON.stringify({
      event: "invitee.created",
      payload: {
        email: "architect@zokorp.com",
        uri: "https://api.calendly.com/invitees/stale123",
        scheduled_event: {
          start_time: "2026-03-25T16:00:00.000Z",
        },
      },
    });

    const response = await POST(signedWebhookRequest(body, "calendly-signing-key", staleTimestamp));

    expect(response.status).toBe(401);
    expect(mocks.leadInteractionCreate).not.toHaveBeenCalled();
    expect(mocks.serviceRequestCreate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });
});
