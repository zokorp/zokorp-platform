import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createInternalAuditLog: vi.fn(),
}));

vi.mock("@/lib/internal-route", () => ({
  createInternalAuditLog: mocks.createInternalAuditLog,
}));

import { recordOperationalIssue, recordRequestErrorIssue } from "@/lib/operational-issues";

describe("operational issue logging", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createInternalAuditLog.mockResolvedValue(undefined);
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("persists compact structured metadata for handled operational issues", async () => {
    await recordOperationalIssue({
      action: "service.request_submission_failed",
      area: "service-requests",
      error: new Error("boom"),
      metadata: {
        trackingCode: "SR-123",
      },
    });

    expect(mocks.createInternalAuditLog).toHaveBeenCalledWith(
      "service.request_submission_failed",
      expect.objectContaining({
        severity: "error",
        area: "service-requests",
        errorName: "Error",
        errorMessage: "boom",
        trackingCode: "SR-123",
      }),
    );
  });

  it("sanitizes request error context before persisting it", async () => {
    await recordRequestErrorIssue(
      new Error("render exploded"),
      {
        path: "/account",
        method: "GET",
        headers: {
          host: "app.zokorp.com",
          "user-agent": "Vitest",
          cookie: "should-not-be-stored",
          referer: "https://www.zokorp.com",
        },
      },
      {
        routePath: "/account",
        routeType: "render",
        routerKind: "App Router",
        renderSource: "server-rendering",
        revalidateReason: undefined,
      },
    );

    expect(mocks.createInternalAuditLog).toHaveBeenCalledWith(
      "runtime.request_error",
      expect.objectContaining({
        area: "runtime",
        path: "/account",
        host: "app.zokorp.com",
        userAgent: "Vitest",
        referer: "https://www.zokorp.com",
        routePath: "/account",
        routeType: "render",
      }),
    );
    expect(mocks.createInternalAuditLog.mock.calls[0][1]).not.toHaveProperty("cookie");
  });
});
