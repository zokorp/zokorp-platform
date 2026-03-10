import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createMock,
  updateMock,
  auditCreateMock,
  sendToolResultEmailMock,
  upsertZohoLeadMock,
  requireVerifiedFreeToolAccessMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  sendToolResultEmailMock: vi.fn(),
  upsertZohoLeadMock: vi.fn(),
  requireVerifiedFreeToolAccessMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
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

vi.mock("@/lib/free-tool-access", () => ({
  requireVerifiedFreeToolAccess: requireVerifiedFreeToolAccessMock,
  isFreeToolAccessError: (error: unknown) => error instanceof Error && error.name === "FreeToolAccessError",
}));

import { POST } from "@/app/api/submit-cloud-cost-leak-finder/route";

describe("submit cloud cost leak finder route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockResolvedValue({ id: "submission_123" });
    updateMock.mockResolvedValue({});
    auditCreateMock.mockResolvedValue({});
    sendToolResultEmailMock.mockResolvedValue({ ok: true, provider: "smtp" });
    upsertZohoLeadMock.mockResolvedValue({ status: "not_configured", error: "ZOHO_CRM_ACCESS_TOKEN_MISSING" });
    requireVerifiedFreeToolAccessMock.mockResolvedValue({
      user: { id: "user_123", email: "owner@acmecloud.com", emailVerified: new Date() },
      email: "owner@acmecloud.com",
    });
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/submit-cloud-cost-leak-finder", {
        method: "POST",
        headers: {
          origin: "http://localhost",
        },
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
      headers: {
        origin: "http://localhost",
      },
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

  it("rejects unverified or unsigned access before any result delivery work", async () => {
    const error = Object.assign(new Error("Sign in with your verified business email to run Cloud Cost Leak Finder."), {
      name: "FreeToolAccessError",
      status: 401,
    });
    requireVerifiedFreeToolAccessMock.mockReset();
    requireVerifiedFreeToolAccessMock.mockImplementationOnce(() => {
      throw error;
    });

    const request = new Request("http://localhost/api/submit-cloud-cost-leak-finder", {
      method: "POST",
      headers: {
        origin: "http://localhost",
      },
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
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in with your verified business email to run Cloud Cost Leak Finder.",
    });
    expect(requireVerifiedFreeToolAccessMock).toHaveBeenCalledTimes(1);
    expect(createMock).not.toHaveBeenCalled();
    expect(sendToolResultEmailMock).not.toHaveBeenCalled();
  });

  it("rejects cross-site submissions before any auth or persistence work", async () => {
    const response = await POST(
      new Request("http://localhost/api/submit-cloud-cost-leak-finder", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
        body: JSON.stringify({
          email: "owner@acmecloud.com",
          fullName: "Jordan Rivera",
          companyName: "Acme Cloud",
          roleTitle: "CTO",
          website: "acmecloud.com",
          primaryCloud: "aws",
          narrativeInput:
            "We run a SaaS app on AWS with EC2, RDS, and dev, test, and prod environments. The bill keeps rising even though usage is mostly flat.",
          billingSummaryInput: "EC2 $4200",
          adaptiveAnswers: {},
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Cross-site requests are not allowed.",
    });
    expect(requireVerifiedFreeToolAccessMock).not.toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });
});
