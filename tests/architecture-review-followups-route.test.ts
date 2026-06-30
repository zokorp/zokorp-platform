import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditCreateMock,
  buildArchitectureFollowUpEmailMock,
  buildEmailPreferenceLinksMock,
  getUserEmailPreferencesMock,
  isSchemaDriftErrorMock,
  leadFindManyMock,
  leadUpdateMock,
  sendArchitectureReviewEmailMock,
} = vi.hoisted(() => ({
  auditCreateMock: vi.fn(),
  buildArchitectureFollowUpEmailMock: vi.fn(),
  buildEmailPreferenceLinksMock: vi.fn(),
  getUserEmailPreferencesMock: vi.fn(),
  isSchemaDriftErrorMock: vi.fn(),
  leadFindManyMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  sendArchitectureReviewEmailMock: vi.fn(),
}));

vi.mock("@/lib/architecture-review/followup", () => ({
  buildArchitectureFollowUpEmail: buildArchitectureFollowUpEmailMock,
  dueFollowUpCheckpoint: () => 7,
}));

vi.mock("@/lib/architecture-review/sender", () => ({
  sendArchitectureReviewEmail: sendArchitectureReviewEmailMock,
}));

vi.mock("@/lib/email-preferences", () => ({
  buildEmailPreferenceLinks: buildEmailPreferenceLinksMock,
  getUserEmailPreferences: getUserEmailPreferencesMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: auditCreateMock,
    },
    leadLog: {
      findMany: leadFindManyMock,
      update: leadUpdateMock,
    },
  },
}));

vi.mock("@/lib/db-errors", () => ({
  isSchemaDriftError: isSchemaDriftErrorMock,
}));

import { GET, POST } from "@/app/api/architecture-review/followups/route";

describe("architecture review follow-up route", () => {
  const originalFollowupSecret = process.env.ARCH_REVIEW_FOLLOWUP_SECRET;
  const originalZohoSyncSecret = process.env.ZOHO_SYNC_SECRET;
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    isSchemaDriftErrorMock.mockReturnValue(false);
    auditCreateMock.mockResolvedValue({});
    leadFindManyMock.mockResolvedValue([
      {
        id: "lead_123",
        userId: "user_123",
        userEmail: "owner@acmecloud.com",
        architectureProvider: "aws",
        overallScore: 78,
        topIssues: "IAM",
        createdAt: new Date("2026-03-01T12:00:00.000Z"),
        leadStage: "Email Sent",
        followUpStatusJson: null,
      },
    ]);
    getUserEmailPreferencesMock.mockResolvedValue({
      operationalResultEmails: true,
      marketingFollowUpEmails: false,
      createdAt: null,
      updatedAt: null,
    });
    buildEmailPreferenceLinksMock.mockReturnValue({
      manageUrl: "https://app.zokorp.com/email-preferences?token=abc",
      marketingUnsubscribeUrl: "https://app.zokorp.com/email-preferences/unsubscribe?token=abc",
    });
    buildArchitectureFollowUpEmailMock.mockResolvedValue({
      to: "owner@acmecloud.com",
      subject: "Follow-up",
      text: "text body",
      html: "<p>text body</p>",
      statusKey: "day7",
    });
    sendArchitectureReviewEmailMock.mockResolvedValue({ ok: true });
    leadUpdateMock.mockResolvedValue({});
    process.env.ARCH_REVIEW_FOLLOWUP_SECRET = "followup-secret";
    delete process.env.ZOHO_SYNC_SECRET;
  });

  afterEach(() => {
    if (originalFollowupSecret === undefined) {
      delete process.env.ARCH_REVIEW_FOLLOWUP_SECRET;
    } else {
      process.env.ARCH_REVIEW_FOLLOWUP_SECRET = originalFollowupSecret;
    }

    if (originalZohoSyncSecret === undefined) {
      delete process.env.ZOHO_SYNC_SECRET;
    } else {
      process.env.ZOHO_SYNC_SECRET = originalZohoSyncSecret;
    }
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 503 when the follow-up secret is not configured", async () => {
    delete process.env.ARCH_REVIEW_FOLLOWUP_SECRET;
    delete process.env.ZOHO_SYNC_SECRET;

    const response = await POST(
      new Request("http://localhost/api/architecture-review/followups", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Architecture review follow-up secret is not configured.",
    });
  });

  it("returns unauthorized without a valid secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/architecture-review/followups", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("rejects GET requests and requires POST", async () => {
    const response = await GET(
      new Request("http://localhost/api/architecture-review/followups", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
  });

  it("returns 503 when the lead follow-up schema is unavailable", async () => {
    leadFindManyMock.mockRejectedValueOnce(new Error("schema drift detail"));
    isSchemaDriftErrorMock.mockReturnValue(true);

    const response = await POST(
      new Request("http://localhost/api/architecture-review/followups", {
        method: "POST",
        headers: {
          "x-arch-followup-secret": "followup-secret",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Architecture follow-up run is unavailable.",
    });
  });

  it("does not expose raw error details on unexpected failures", async () => {
    leadFindManyMock.mockRejectedValueOnce(new Error("smtp credentials missing"));

    const response = await POST(
      new Request("http://localhost/api/architecture-review/followups", {
        method: "POST",
        headers: {
          "x-arch-followup-secret": "followup-secret",
        },
      }),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Architecture follow-up run failed.",
    });
  });

  it("skips scheduled follow-ups when the account has not opted in", async () => {
    const response = await POST(
      new Request("http://localhost/api/architecture-review/followups", {
        method: "POST",
        headers: {
          "x-arch-followup-secret": "followup-secret",
        },
      }),
    );

    expect(buildArchitectureFollowUpEmailMock).not.toHaveBeenCalled();
    expect(sendArchitectureReviewEmailMock).not.toHaveBeenCalled();
    expect(leadUpdateMock).toHaveBeenCalledWith({
      where: { id: "lead_123" },
      data: {
        followUpStatusJson: expect.objectContaining({
          day7: expect.stringMatching(/^opted_out:/),
        }),
      },
    });
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: {
        action: "internal.architecture_review_followups.run",
        metadataJson: expect.objectContaining({
          sent: 0,
          skipped: 0,
          optedOut: 1,
          failed: 0,
        }),
      },
    });
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      sent: 0,
      skipped: 0,
      optedOut: 1,
      failed: 0,
    });
  });

  it("sends scheduled follow-ups only when the account has opted in", async () => {
    getUserEmailPreferencesMock.mockResolvedValueOnce({
      operationalResultEmails: true,
      marketingFollowUpEmails: true,
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-02T00:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/architecture-review/followups", {
        method: "POST",
        headers: {
          "x-arch-followup-secret": "followup-secret",
        },
      }),
    );

    expect(buildEmailPreferenceLinksMock).toHaveBeenCalledWith({
      userId: "user_123",
      email: "owner@acmecloud.com",
    });
    expect(buildArchitectureFollowUpEmailMock).toHaveBeenCalledWith({
      leadId: "lead_123",
      userEmail: "owner@acmecloud.com",
      provider: "aws",
      overallScore: 78,
      topIssues: "IAM",
      day: 7,
      emailPreferenceLinks: {
        manageUrl: "https://app.zokorp.com/email-preferences?token=abc",
        marketingUnsubscribeUrl: "https://app.zokorp.com/email-preferences/unsubscribe?token=abc",
      },
    });
    expect(sendArchitectureReviewEmailMock).toHaveBeenCalledWith({
      to: "owner@acmecloud.com",
      subject: "Follow-up",
      text: "text body",
      html: "<p>text body</p>",
    });
    expect(leadUpdateMock).toHaveBeenCalledWith({
      where: { id: "lead_123" },
      data: {
        followUpStatusJson: expect.objectContaining({
          day7: expect.stringMatching(/^sent:/),
        }),
      },
    });
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      sent: 1,
      skipped: 0,
      optedOut: 0,
      failed: 0,
    });
  });
});
