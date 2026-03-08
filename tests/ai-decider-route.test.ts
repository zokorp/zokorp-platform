import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  sendToolResultEmail: vi.fn(),
  upsertZohoLead: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRequestFingerprint: vi.fn(),
  requireVerifiedFreeToolAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    aiDeciderSubmission: {
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
    },
    auditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRequestFingerprint: mocks.getRequestFingerprint,
}));

vi.mock("@/lib/architecture-review/sender", () => ({
  sendToolResultEmail: mocks.sendToolResultEmail,
}));

vi.mock("@/lib/zoho-crm", () => ({
  upsertZohoLead: mocks.upsertZohoLead,
}));

vi.mock("@/lib/free-tool-access", () => ({
  requireVerifiedFreeToolAccess: mocks.requireVerifiedFreeToolAccess,
  isFreeToolAccessError: (error: unknown) => error instanceof Error && error.name === "FreeToolAccessError",
}));

import { POST } from "@/app/api/submit-ai-decider/route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/submit-ai-decider", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("submit ai decider route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.submissionCreate.mockResolvedValue({ id: "ai_123" });
    mocks.submissionUpdate.mockResolvedValue({ id: "ai_123" });
    mocks.auditCreate.mockResolvedValue({ id: "audit_123" });
    mocks.sendToolResultEmail.mockResolvedValue({ ok: true, provider: "smtp" });
    mocks.upsertZohoLead.mockResolvedValue({ status: "not_configured", error: "ZOHO_CRM_ACCESS_TOKEN_MISSING" });
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      retryAfterSeconds: 0,
    });
    mocks.getRequestFingerprint.mockReturnValue("203.0.113.10");
    mocks.requireVerifiedFreeToolAccess.mockResolvedValue({
      user: { id: "user_123", email: "owner@acmeops.com", emailVerified: new Date() },
      email: "owner@acmeops.com",
    });
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Please complete the required fields and try again.",
    });
  });

  it("rejects unverified or unsigned access before storing or emailing results", async () => {
    const error = Object.assign(new Error("Sign in with your verified business email to run AI Decider."), {
      name: "FreeToolAccessError",
      status: 401,
    });
    mocks.requireVerifiedFreeToolAccess.mockRejectedValueOnce(error);

    const response = await POST(
      makeRequest({
        email: "owner@acmeops.com",
        fullName: "Jordan Rivera",
        companyName: "Acme Ops",
        roleTitle: "COO",
        website: "acmeops.com",
        narrativeInput:
          "Our support team answers the same questions repeatedly across email and Slack. The best answers are spread across SharePoint, old docs, and a few senior reps. We want faster response times and more consistent answers for customers.",
        answers: {
          task_frequency: "daily",
          process_variability: "mostly_standard",
          data_state: "mixed_needs_cleanup",
          impact_window: "major",
          error_tolerance: "human_reviewed",
          systems_count: "three_four",
          knowledge_source: "many_conflicting",
          decision_logic: "rules_plus_judgment",
        },
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Sign in with your verified business email to run AI Decider.",
    });
    expect(mocks.submissionCreate).not.toHaveBeenCalled();
    expect(mocks.sendToolResultEmail).not.toHaveBeenCalled();
  });

  it("stores the submission and returns the concise success payload for verified access", async () => {
    const response = await POST(
      makeRequest({
        email: "owner@acmeops.com",
        fullName: "Jordan Rivera",
        companyName: "Acme Ops",
        roleTitle: "COO",
        website: "acmeops.com",
        narrativeInput:
          "Our support team answers the same questions repeatedly across email and Slack. The best answers are spread across SharePoint, old docs, and a few senior reps. We want faster response times and more consistent answers for customers.",
        answers: {
          task_frequency: "daily",
          process_variability: "mostly_standard",
          data_state: "mixed_needs_cleanup",
          impact_window: "major",
          error_tolerance: "human_reviewed",
          systems_count: "three_four",
          knowledge_source: "many_conflicting",
          decision_logic: "rules_plus_judgment",
        },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("sent");
    expect(payload.verdictLine).toBeTruthy();
    expect(mocks.submissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_123",
          email: "owner@acmeops.com",
          source: "ai-decider",
        }),
      }),
    );
    expect(mocks.sendToolResultEmail).toHaveBeenCalledTimes(1);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
  });
});
