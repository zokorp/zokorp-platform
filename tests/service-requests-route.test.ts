import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSameOriginMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  authMock,
  userFindUniqueMock,
  createServiceRequestMock,
  auditCreateMock,
  sendServiceRequestOperatorNotificationMock,
  ensureLeadInteractionMock,
  upsertLeadMock,
  isSchemaDriftErrorMock,
  isTransientDatabaseConnectionErrorMock,
} = vi.hoisted(() => ({
  requireSameOriginMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  getRequestFingerprintMock: vi.fn(),
  authMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  createServiceRequestMock: vi.fn(),
  auditCreateMock: vi.fn(),
  sendServiceRequestOperatorNotificationMock: vi.fn(),
  ensureLeadInteractionMock: vi.fn(),
  upsertLeadMock: vi.fn(),
  isSchemaDriftErrorMock: vi.fn(),
  isTransientDatabaseConnectionErrorMock: vi.fn(),
}));

vi.mock("@/lib/request-origin", () => ({
  requireSameOrigin: requireSameOriginMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getRequestFingerprint: getRequestFingerprintMock,
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/service-requests", () => ({
  createServiceRequest: createServiceRequestMock,
  resolveServiceRequestOwnerLabel: vi.fn(),
}));

vi.mock("@/lib/privacy-leads", () => ({
  ensureLeadInteraction: ensureLeadInteractionMock,
  upsertLead: upsertLeadMock,
}));

vi.mock("@/lib/service-request-email", () => ({
  sendServiceRequestOperatorNotification: sendServiceRequestOperatorNotificationMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

vi.mock("@/lib/db-errors", () => ({
  isSchemaDriftError: isSchemaDriftErrorMock,
  isTransientDatabaseConnectionError: isTransientDatabaseConnectionErrorMock,
}));

import { POST } from "@/app/api/services/requests/route";

describe("service requests route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireSameOriginMock.mockReturnValue(null);
    consumeRateLimitMock.mockResolvedValue({ allowed: true });
    getRequestFingerprintMock.mockReturnValue("fingerprint");
    authMock.mockResolvedValue({
      user: {
        email: "consulting@zokorp.com",
      },
    });
    userFindUniqueMock.mockResolvedValue({
      id: "user_123",
      email: "consulting@zokorp.com",
      name: "Zohaib Khawaja",
    });
    createServiceRequestMock.mockResolvedValue({
      id: "sr_123",
      trackingCode: "SR-260326-ABCDE",
      status: "SUBMITTED",
      type: "CONSULTATION",
      title: "ATLAS-AUDIT-2026-03-26 service request",
    });
    auditCreateMock.mockRejectedValue(new Error("audit unavailable"));
    sendServiceRequestOperatorNotificationMock.mockResolvedValue({
      ok: true,
      provider: "smtp",
      error: undefined,
    });
    upsertLeadMock.mockResolvedValue({ id: "lead_123" });
    ensureLeadInteractionMock.mockResolvedValue({ interaction: { id: "interaction_123" }, deduped: false });
    isSchemaDriftErrorMock.mockReturnValue(false);
    isTransientDatabaseConnectionErrorMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success even when audit logging fails after a signed-in request is created", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      new Request("https://app.zokorp.com/api/services/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          type: "CONSULTATION",
          title: "ATLAS-AUDIT-2026-03-26 service request",
          summary: "Need a production-readiness consultation for an AWS delivery and tooling launch plan.",
          budgetRange: "Undecided",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      id: "sr_123",
      trackingCode: "SR-260326-ABCDE",
      status: "SUBMITTED",
      linkedToAccount: true,
    });
    expect(createServiceRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        requesterEmail: "consulting@zokorp.com",
        requesterName: "Zohaib Khawaja",
        requesterSource: "account",
        type: "CONSULTATION",
      }),
    );
    expect(sendServiceRequestOperatorNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        trackingCode: "SR-260326-ABCDE",
        requesterEmail: "consulting@zokorp.com",
        requesterSource: "account",
      }),
    );
    expect(upsertLeadMock).toHaveBeenCalledWith({
      userId: "user_123",
      email: "consulting@zokorp.com",
      name: "Zohaib Khawaja",
      companyName: null,
    });
    expect(ensureLeadInteractionMock).toHaveBeenCalledWith({
      leadId: "lead_123",
      userId: "user_123",
      serviceRequestId: "sr_123",
      source: "service-request",
      action: "service_request_created",
      externalEventId: "service-request:sr_123:created",
    });
    expect(auditCreateMock).toHaveBeenCalledTimes(2);
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "service.request_submitted",
          metadataJson: expect.objectContaining({
            trackingCode: "SR-260326-ABCDE",
            zohoSyncQueued: true,
            operatorEmailStatus: expect.objectContaining({
              attempted: true,
              ok: true,
              provider: "smtp",
            }),
          }),
        }),
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("accepts a public request, records a lead, and returns a non-account-linked response", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue(null);
    userFindUniqueMock.mockResolvedValue(null);
    auditCreateMock.mockResolvedValue({});

    const response = await POST(
      new Request("https://app.zokorp.com/api/services/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          type: "CONSULTATION",
          title: "Need architecture remediation help",
          summary: "Need follow-up help translating a scored architecture review into a short remediation plan.",
          requesterEmail: "founder@customerco.com",
          requesterName: "Customer Founder",
          requesterCompanyName: "CustomerCo",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      id: "sr_123",
      trackingCode: "SR-260326-ABCDE",
      status: "SUBMITTED",
      linkedToAccount: false,
    });
    expect(createServiceRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        requesterEmail: "founder@customerco.com",
        requesterName: "Customer Founder",
        requesterCompanyName: "CustomerCo",
        requesterSource: "public_form",
      }),
    );
    expect(upsertLeadMock).toHaveBeenCalledWith({
      userId: null,
      email: "founder@customerco.com",
      name: "Customer Founder",
      companyName: "CustomerCo",
    });
    expect(ensureLeadInteractionMock).toHaveBeenCalledWith({
      leadId: "lead_123",
      userId: null,
      serviceRequestId: "sr_123",
      source: "service-request",
      action: "service_request_created",
      externalEventId: "service-request:sr_123:created",
    });
    expect(sendServiceRequestOperatorNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterEmail: "founder@customerco.com",
        requesterSource: "public_form",
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "service.request_submitted",
          metadataJson: expect.objectContaining({
            requesterSource: "public_form",
            zohoSyncQueued: true,
            operatorEmailStatus: expect.objectContaining({
              attempted: true,
              ok: true,
              provider: "smtp",
            }),
          }),
        }),
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("marks validation errors as non-cacheable", async () => {
    const response = await POST(
      new Request("https://app.zokorp.com/api/services/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          type: "CONSULTATION",
          title: "short",
          summary: "too short",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Invalid service request input.",
    });
  });

  it("rejects public requests that use a personal email domain", async () => {
    authMock.mockResolvedValue(null);
    userFindUniqueMock.mockResolvedValue(null);

    const response = await POST(
      new Request("https://app.zokorp.com/api/services/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          type: "CONSULTATION",
          title: "Need architecture remediation help",
          summary: "Need follow-up help translating a scored architecture review into a short remediation plan.",
          requesterEmail: "founder@gmail.com",
          requesterName: "Customer Founder",
          requesterCompanyName: "CustomerCo",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Personal email domains are not allowed. Use a business email.",
    });
    expect(createServiceRequestMock).not.toHaveBeenCalled();
    expect(upsertLeadMock).not.toHaveBeenCalled();
    expect(ensureLeadInteractionMock).not.toHaveBeenCalled();
  });

  it("returns a transient 503 when database connections are saturated", async () => {
    authMock.mockResolvedValue(null);
    userFindUniqueMock.mockResolvedValue(null);
    createServiceRequestMock.mockRejectedValue(new Error("max clients reached"));
    isTransientDatabaseConnectionErrorMock.mockReturnValue(true);

    const response = await POST(
      new Request("https://www.zokorp.com/api/services/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://www.zokorp.com",
        },
        body: JSON.stringify({
          type: "CONSULTATION",
          title: "Need architecture remediation help",
          summary: "Need follow-up help translating a scored architecture review into a short remediation plan.",
          requesterEmail: "founder@customerco.com",
          requesterName: "Customer Founder",
          requesterCompanyName: "CustomerCo",
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Service request intake is temporarily busy. Please retry shortly.",
    });
  });

  it("still returns success when public lead capture fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue(null);
    userFindUniqueMock.mockResolvedValue(null);
    auditCreateMock.mockResolvedValue({});
    upsertLeadMock.mockRejectedValue(new Error("lead capture unavailable"));

    const response = await POST(
      new Request("https://www.zokorp.com/api/services/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://www.zokorp.com",
        },
        body: JSON.stringify({
          type: "CONSULTATION",
          title: "Need architecture remediation help",
          summary: "Need follow-up help translating a scored architecture review into a short remediation plan.",
          requesterEmail: "founder@customerco.com",
          requesterName: "Customer Founder",
          requesterCompanyName: "CustomerCo",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "sr_123",
      trackingCode: "SR-260326-ABCDE",
      status: "SUBMITTED",
      linkedToAccount: false,
    });
    expect(upsertLeadMock).toHaveBeenCalledTimes(1);
    expect(ensureLeadInteractionMock).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
