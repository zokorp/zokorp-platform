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

import { GET, POST } from "@/app/api/internal/calendly/booked-call/route";

describe("internal Calendly booked-call ingest route", () => {
  const originalSecret = process.env.CALENDLY_SYNC_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CALENDLY_SYNC_SECRET = "calendly-sync-secret";
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
      trackingCode: "SR-260325-ABCDE",
    });
    mocks.serviceRequestUpdate.mockResolvedValue({});
    mocks.leadInteractionUpdate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CALENDLY_SYNC_SECRET;
    } else {
      process.env.CALENDLY_SYNC_SECRET = originalSecret;
    }
  });

  it("rejects GET requests", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/calendly/booked-call", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
  });

  it("rejects unauthorized requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/calendly/booked-call", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "architect@zokorp.com",
          externalEventId: "https://api.calendly.com/invitees/abc123",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("creates a booked-call interaction and scheduled service request on authorized POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/calendly/booked-call", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-calendly-sync-secret": "calendly-sync-secret",
        },
        body: JSON.stringify({
          email: "architect@zokorp.com",
          name: "Jordan Rivera",
          externalEventId: "https://api.calendly.com/invitees/abc123",
          bookedAtIso: "2026-03-25T16:00:00.000Z",
          estimateReferenceCode: "ZK-ARCH-20260325-ABC123",
          provider: "calendly",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
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
});
