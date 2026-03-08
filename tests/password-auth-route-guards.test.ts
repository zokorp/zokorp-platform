import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditCreateMock,
  consumeRateLimitMock,
  issueEmailVerificationTokenMock,
  sendEmailVerificationEmailMock,
  sendPasswordResetEmailMock,
  userCreateMock,
  userFindUniqueMock,
  userAuthFindFirstMock,
} = vi.hoisted(() => ({
  auditCreateMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  issueEmailVerificationTokenMock: vi.fn(),
  sendEmailVerificationEmailMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  userCreateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userAuthFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      create: userCreateMock,
      findUnique: userFindUniqueMock,
    },
    userAuth: {
      findFirst: userAuthFindFirstMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getRequestFingerprint: () => "test-fingerprint",
}));

vi.mock("@/lib/auth-email", () => ({
  sendEmailVerificationEmail: sendEmailVerificationEmailMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

vi.mock("@/lib/email-verification", () => ({
  issueEmailVerificationToken: issueEmailVerificationTokenMock,
}));

vi.mock("@/lib/site-origin", () => ({
  getSiteOriginFromRequest: () => "http://localhost:3000",
}));

vi.mock("@/lib/user-auth-schema", () => ({
  ensureUserAuthSchemaReady: vi.fn(),
}));

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as requestResetPost } from "@/app/api/auth/password/request-reset/route";
import { POST as resetPost } from "@/app/api/auth/password/reset/route";

const originalPasswordAuthEnabled = process.env.AUTH_PASSWORD_ENABLED;

describe("password auth management route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_PASSWORD_ENABLED = "false";
  });

  afterEach(() => {
    if (originalPasswordAuthEnabled === undefined) {
      delete process.env.AUTH_PASSWORD_ENABLED;
      return;
    }

    process.env.AUTH_PASSWORD_ENABLED = originalPasswordAuthEnabled;
  });

  it("blocks registration when password auth is disabled", async () => {
    const response = await registerPost(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: "Jordan Rivera",
          email: "jordan@acmecloud.com",
          password: "StrongEnough#123",
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Password account registration is currently disabled.",
    });
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(userFindUniqueMock).not.toHaveBeenCalled();
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it("blocks password reset requests when password auth is disabled", async () => {
    const response = await requestResetPost(
      new Request("http://localhost/api/auth/password/request-reset", {
        method: "POST",
        body: JSON.stringify({
          email: "jordan@acmecloud.com",
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Password reset is currently disabled.",
    });
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(userFindUniqueMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("blocks password reset completion when password auth is disabled", async () => {
    const response = await resetPost(
      new Request("http://localhost/api/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({
          token: "token-value-token-value",
          password: "StrongEnough#123",
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Password reset is currently disabled.",
    });
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(userAuthFindFirstMock).not.toHaveBeenCalled();
    expect(auditCreateMock).not.toHaveBeenCalled();
  });
});
