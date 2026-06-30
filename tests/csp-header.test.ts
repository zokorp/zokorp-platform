import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/csp";

describe("content security policy builder", () => {
  it("includes the report endpoint in production", () => {
    const policy = buildContentSecurityPolicy({
      nodeEnv: "production",
    });

    expect(policy).toContain("report-uri /api/security/csp-report");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows Google Analytics only when configured", () => {
    const withoutGa = buildContentSecurityPolicy({
      nodeEnv: "production",
      gaMeasurementId: "",
    });
    const withGa = buildContentSecurityPolicy({
      nodeEnv: "production",
      gaMeasurementId: "G-TEST123",
    });

    expect(withoutGa).not.toContain("https://www.googletagmanager.com");
    expect(withGa).toContain("script-src 'self' 'unsafe-inline' https://www.googletagmanager.com");
  });

  it("uses a nonce and strict-dynamic instead of unsafe-inline when a nonce is supplied (SEC-06)", () => {
    const policy = buildContentSecurityPolicy({ nodeEnv: "production", nonce: "abc123" });

    expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    // script-src no longer falls back to 'unsafe-inline' when a nonce is present.
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
