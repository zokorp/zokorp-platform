import { describe, expect, it } from "vitest";

import { sanitizeAuthRedirectTarget, sanitizeCallbackUrl } from "@/lib/callback-url";

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

  it("rejects encoded protocol-relative URLs", () => {
    expect(sanitizeCallbackUrl("/%2F%2Fevil.example/phish")).toBe("/account");
  });

  it("rejects encoded slash-backslash URLs", () => {
    expect(sanitizeCallbackUrl("/%5Cevil.example/phish")).toBe("/account");
  });

  it("rejects control characters", () => {
    expect(sanitizeCallbackUrl("/account\r\nx-test: injected")).toBe("/account");
  });

  it("normalizes internal callback URLs", () => {
    expect(sanitizeCallbackUrl("/account/../account?tab=billing#invoices")).toBe("/account?tab=billing#invoices");
  });
});

describe("sanitizeAuthRedirectTarget", () => {
  it("allows same-origin absolute redirects", () => {
    expect(
      sanitizeAuthRedirectTarget("https://app.zokorp.com/software/cloud-cost-leak-finder", "https://app.zokorp.com"),
    ).toBe("https://app.zokorp.com/software/cloud-cost-leak-finder");
  });

  it("rejects cross-origin redirects", () => {
    expect(sanitizeAuthRedirectTarget("https://evil.example/phish", "https://app.zokorp.com")).toBe(
      "https://app.zokorp.com/account",
    );
  });

  it("rejects suspicious encoded path redirects", () => {
    expect(sanitizeAuthRedirectTarget("/%2F%2Fevil.example/phish", "https://app.zokorp.com")).toBe(
      "https://app.zokorp.com/account",
    );
  });

  it("uses a sanitized custom fallback when redirect target is invalid", () => {
    expect(
      sanitizeAuthRedirectTarget(
        "https://evil.example/phish",
        "https://app.zokorp.com",
        "/software/cloud-cost-leak-finder",
      ),
    ).toBe("https://app.zokorp.com/software/cloud-cost-leak-finder");
  });
});
