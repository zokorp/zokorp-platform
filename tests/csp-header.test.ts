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
});
