import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMock,
  updateMock,
  auditCreateMock,
  userFindUniqueMock,
  sendToolResultEmailMock,
  upsertZohoLeadMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  sendToolResultEmailMock: vi.fn(),
  upsertZohoLeadMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock,
    },
    cloudCostLeakFinderSubmission: {
      create: createMock,
      update: updateMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: () => ({ allowed: true, retryAfterSeconds: 0 }),
  getRequestFingerprint: () => "test-fingerprint",
}));

vi.mock("@/lib/architecture-review/sender", () => ({
  sendToolResultEmail: sendToolResultEmailMock,
}));

vi.mock("@/lib/zoho-crm", () => ({
  upsertZohoLead: upsertZohoLeadMock,
}));

import { POST } from "@/app/api/submit-cloud-cost-leak-finder/route";

describe("submit cloud cost leak finder route", () => {
  beforeEach(() => {
    createMock.mockResolvedValue({ id: "submission_123" });
    updateMock.mockResolvedValue({});
    auditCreateMock.mockResolvedValue({});
    userFindUniqueMock.mockResolvedValue({ id: "user_123" });
    sendToolResultEmailMock.mockResolvedValue({ ok: true, provider: "smtp" });
    upsertZohoLeadMock.mockResolvedValue({ status: "not_configured", error: "ZOHO_CRM_ACCESS_TOKEN_MISSING" });
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/submit-cloud-cost-leak-finder", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Please complete the required fields and try again.",
    });
  });

  it("stores the submission, sends email, and returns the concise success payload", async () => {
    const request = new Request("http://localhost/api/submit-cloud-cost-leak-finder", {
      method: "POST",
      body: JSON.stringify({
        email: "owner@acmecloud.com",
        fullName: "Jordan Rivera",
        companyName: "Acme Cloud",
        roleTitle: "CTO",
        website: "acmecloud.com",
        primaryCloud: "aws",
        narrativeInput:
          "We run a SaaS app on AWS with EC2, RDS, and dev, test, and prod environments. The bill keeps rising even though usage is mostly flat, and I think non-prod is running 24/7.",
        billingSummaryInput: "EC2 $4200\nRDS $2100\nS3 $400",
        adaptiveAnswers: {
          monthlySpendBand: "15k_to_50k",
          workloadScope: "a_few_systems",
          ownershipClarity: "partial",
          budgetsAlerts: "partial",
          customerCriticality: "customer_facing",
          nonProdRuntime: "always_on",
          rightsizingCadence: "rare",
          architectureFlexibility: "cleanup_first",
        },
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("sent");
    expect(payload.verdictHeadline).toBeTruthy();
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(sendToolResultEmailMock).toHaveBeenCalledTimes(1);
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
  });
});
