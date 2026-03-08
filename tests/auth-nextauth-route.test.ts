import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { consumeRateLimitMock, nextAuthHandlerMock } = vi.hoisted(() => ({
  consumeRateLimitMock: vi.fn(),
  nextAuthHandlerMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: vi.fn(() => nextAuthHandlerMock),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getRequestFingerprint: () => "test-fingerprint",
}));

import { POST } from "@/app/api/auth/[...nextauth]/route";

const originalPasswordAuthEnabled = process.env.AUTH_PASSWORD_ENABLED;

describe("nextauth route password auth enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nextAuthHandlerMock.mockResolvedValue(new Response("ok"));
    consumeRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 24,
      retryAfterSeconds: 60,
    });
    delete process.env.AUTH_PASSWORD_ENABLED;
  });

  afterEach(() => {
    if (originalPasswordAuthEnabled === undefined) {
      delete process.env.AUTH_PASSWORD_ENABLED;
      return;
    }

    process.env.AUTH_PASSWORD_ENABLED = originalPasswordAuthEnabled;
  });

  it("returns 503 for credentials sign-in when password auth is disabled", async () => {
    process.env.AUTH_PASSWORD_ENABLED = "false";

    const response = await POST(
      new Request("http://localhost/api/auth/signin/credentials", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ nextauth: ["signin", "credentials"] }),
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Password sign-in is currently disabled.",
    });
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(nextAuthHandlerMock).not.toHaveBeenCalled();
  });

  it("continues to rate limit and delegate when password auth is enabled", async () => {
    process.env.AUTH_PASSWORD_ENABLED = "true";

    const response = await POST(
      new Request("http://localhost/api/auth/signin/credentials", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ nextauth: ["signin", "credentials"] }),
      },
    );

    expect(response.status).toBe(200);
    expect(consumeRateLimitMock).toHaveBeenCalledTimes(1);
    expect(nextAuthHandlerMock).toHaveBeenCalledTimes(1);
  });
});
