import { describe, expect, it } from "vitest";

import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";

describe("rate limiter", () => {
  it("blocks requests after limit within the same window", async () => {
    const key = `test-key-${Date.now()}-${Math.random()}`;

    const first = await consumeRateLimit({ key, limit: 2, windowMs: 60_000 });
    const second = await consumeRateLimit({ key, limit: 2, windowMs: 60_000 });
    const third = await consumeRateLimit({ key, limit: 2, windowMs: 60_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("request fingerprint (COST-01)", () => {
  function makeRequest(headers: Record<string, string>) {
    return new Request("http://localhost/api/x", { headers });
  }

  it("does not trust a spoofed left-most X-Forwarded-For", () => {
    const fingerprint = getRequestFingerprint(makeRequest({ "x-forwarded-for": "1.2.3.4", "user-agent": "UA" }));
    expect(fingerprint).not.toBe("1.2.3.4");
    expect(fingerprint).toBe("ua:UA");
  });

  it("prefers the platform-trusted x-vercel-forwarded-for over X-Forwarded-For", () => {
    const fingerprint = getRequestFingerprint(
      makeRequest({ "x-vercel-forwarded-for": "203.0.113.9", "x-forwarded-for": "1.2.3.4" }),
    );
    expect(fingerprint).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when no Vercel header is present", () => {
    expect(getRequestFingerprint(makeRequest({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });
});
