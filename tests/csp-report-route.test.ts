import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditCreateMock, consumeRateLimitMock } = vi.hoisted(() => ({
  auditCreateMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getRequestFingerprint: () => "fingerprint-1",
}));

import { POST } from "@/app/api/security/csp-report/route";

describe("CSP report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditCreateMock.mockResolvedValue({});
    consumeRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfterSeconds: 60,
    });
  });

  it("stores normalized reports and returns 204", async () => {
    const response = await POST(
      new Request("http://localhost/api/security/csp-report", {
        method: "POST",
        headers: {
          "content-type": "application/csp-report",
          "user-agent": "Vitest",
        },
        body: JSON.stringify({
          "csp-report": {
            "document-uri": "https://app.zokorp.com/account?callbackUrl=%2Fadmin",
            "blocked-uri": "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
            "effective-directive": "script-src-elem",
            "violated-directive": "script-src-elem",
          },
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(auditCreateMock).toHaveBeenCalledWith({
      data: {
        action: "security.csp_violation",
        metadataJson: {
          contentType: "application/csp-report",
          reportCount: 1,
          reports: [
            {
              blockedUri: "https://www.googletagmanager.com/gtag/js",
              columnNumber: null,
              disposition: null,
              documentUri: "https://app.zokorp.com/account",
              effectiveDirective: "script-src-elem",
              lineNumber: null,
              referrer: null,
              sample: null,
              sourceFile: null,
              statusCode: null,
              violatedDirective: "script-src-elem",
            },
          ],
          userAgent: "Vitest",
        },
      },
    });
  });

  it("swallows rate limited reports without persisting them", async () => {
    consumeRateLimitMock.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 900,
    });

    const response = await POST(
      new Request("http://localhost/api/security/csp-report", {
        method: "POST",
        body: JSON.stringify({
          "csp-report": {
            "document-uri": "https://app.zokorp.com/",
            "blocked-uri": "inline",
          },
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(auditCreateMock).not.toHaveBeenCalled();
  });

  it("ignores invalid payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/security/csp-report", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(response.status).toBe(204);
    expect(auditCreateMock).not.toHaveBeenCalled();
  });
});
