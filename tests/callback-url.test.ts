import { describe, expect, it } from "vitest";

import { sanitizeCallbackUrl } from "@/lib/callback-url";

describe("sanitizeCallbackUrl", () => {
  it("returns fallback when callback URL is missing", () => {
    expect(sanitizeCallbackUrl(undefined)).toBe("/account");
  });

  it("allows a local path callback URL", () => {
    expect(sanitizeCallbackUrl("/software/cloud-cost-leak-finder")).toBe("/software/cloud-cost-leak-finder");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeCallbackUrl("https://evil.example/phish")).toBe("/account");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeCallbackUrl("//evil.example/phish")).toBe("/account");
  });

  it("rejects slash-backslash URLs", () => {
    expect(sanitizeCallbackUrl("/\\evil.example/phish")).toBe("/account");
  });

  it("rejects control characters", () => {
    expect(sanitizeCallbackUrl("/account\r\nx-test: injected")).toBe("/account");
  });
});
