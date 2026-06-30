import { describe, expect, it } from "vitest";

import { REQUIRED_SERVER_ENV_KEYS, validateServerEnv } from "@/lib/env";

const completeEnv: Record<string, string | undefined> = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  NEXTAUTH_SECRET: "test-nextauth-secret",
  STRIPE_SECRET_KEY: "sk_test_123",
  STRIPE_WEBHOOK_SECRET: "whsec_test_123",
  ARCHIVE_ENCRYPTION_SECRET: "test-archive-secret",
};

describe("server env validation (TYPE-04 / TEST-01)", () => {
  it("passes when every required server var is present", () => {
    expect(validateServerEnv(completeEnv)).toEqual({ ok: true });
  });

  it("fails fast and names a missing required var", () => {
    const partial = { ...completeEnv };
    delete partial.ARCHIVE_ENCRYPTION_SECRET;
    const result = validateServerEnv(partial);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toContain("ARCHIVE_ENCRYPTION_SECRET");
    }
  });

  it("requires every documented core secret (completeness guard)", () => {
    expect(REQUIRED_SERVER_ENV_KEYS).toContain("ARCHIVE_ENCRYPTION_SECRET");
    expect(REQUIRED_SERVER_ENV_KEYS).toContain("NEXTAUTH_SECRET");

    for (const key of REQUIRED_SERVER_ENV_KEYS) {
      const partial = { ...completeEnv };
      delete partial[key];
      const result = validateServerEnv(partial);
      expect(result.ok, `removing ${key} should fail validation`).toBe(false);
    }
  });
});
