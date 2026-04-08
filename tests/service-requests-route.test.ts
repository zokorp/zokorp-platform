import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSameOriginMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  authMock,
  userFindUniqueMock,
  createServiceRequestMock,
  auditCreateMock,
  upsertLeadMock,
  upsertZohoLeadMock,
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
  upsertLeadMock: vi.fn(),
  upsertZohoLeadMock: vi.fn(),
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
  upsertLead: upsertLeadMock,
}));

vi.mock("@/lib/zoho-crm", () => ({
  upsertZohoLead: upsertZohoLeadMock,
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
    upsertLeadMock.mockResolvedValue(undefined);
    upsertZohoLeadMock.mockResolvedValue({
      status: "success",
      recordId: "zoho_123",
      error: null,
    });
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
    expect(upsertZohoLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "consulting@zokorp.com",
        fullName: "Zohaib Khawaja",
        leadSource: "ZoKorp Service Request",
      }),
    );
    expect(upsertLeadMock).not.toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalledTimes(1);

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
      email: "founder@customerco.com",
      name: "Customer Founder",
      companyName: "CustomerCo",
    });
    expect(upsertZohoLeadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "founder@customerco.com",
        fullName: "Customer Founder",
        companyName: "CustomerCo",
        leadSource: "ZoKorp Service Request",
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledTimes(1);

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

  it("still returns success when Zoho sync fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    authMock.mockResolvedValue(null);
    userFindUniqueMock.mockResolvedValue(null);
    auditCreateMock.mockResolvedValue({});
    upsertZohoLeadMock.mockResolvedValue({
      status: "failed",
      error: "ZOHO_CRM_CALL_FAILED:500",
    });

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
    expect(upsertZohoLeadMock).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });
});
