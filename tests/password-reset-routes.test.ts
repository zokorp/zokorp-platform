import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditCreateMock,
  consumePasswordResetTokenMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  getSiteOriginFromRequestMock,
  hashPasswordMock,
  issuePasswordResetTokenMock,
  requireSameOriginMock,
  sendPasswordResetEmailMock,
  userAuthFindFirstMock,
  userFindUniqueMock,
  transactionMock,
  userAuthUpdateMock,
} = vi.hoisted(() => ({
  auditCreateMock: vi.fn(),
  consumePasswordResetTokenMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  getRequestFingerprintMock: vi.fn(),
  getSiteOriginFromRequestMock: vi.fn(),
  hashPasswordMock: vi.fn(),
  issuePasswordResetTokenMock: vi.fn(),
  requireSameOriginMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  userAuthFindFirstMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  userAuthUpdateMock: vi.fn(),
}));

vi.mock("@/lib/request-origin", () => ({
  requireSameOrigin: requireSameOriginMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getRequestFingerprint: getRequestFingerprintMock,
}));

vi.mock("@/lib/site-origin", () => ({
  getSiteOriginFromRequest: getSiteOriginFromRequestMock,
}));

vi.mock("@/lib/auth-email", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

vi.mock("@/lib/password-reset-tokens", () => ({
  issuePasswordResetToken: issuePasswordResetTokenMock,
  consumePasswordResetToken: consumePasswordResetTokenMock,
}));

vi.mock("@/lib/password-auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/password-auth")>("@/lib/password-auth");
  return {
    ...actual,
    hashPassword: hashPasswordMock,
  };
});

vi.mock("@/lib/user-auth-schema", () => ({
  ensureUserAuthSchemaReady: vi.fn(async () => true),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock,
      update: vi.fn(),
    },
    userAuth: {
      findFirst: userAuthFindFirstMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
    verificationToken: {
      deleteMany: vi.fn(),
    },
    $transaction: transactionMock,
  },
}));

import { POST as requestResetPost } from "@/app/api/auth/password/request-reset/route";
import { POST as resetPost } from "@/app/api/auth/password/reset/route";

describe("password reset routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSameOriginMock.mockReturnValue(null);
    consumeRateLimitMock.mockResolvedValue({ allowed: true });
    getRequestFingerprintMock.mockReturnValue("fingerprint");
    getSiteOriginFromRequestMock.mockReturnValue("https://app.zokorp.com");
    issuePasswordResetTokenMock.mockResolvedValue({
      email: "zkhawaja+atlas3@zokorp.com",
      expires: new Date("2026-03-27T20:00:00.000Z"),
      resetUrl: "https://app.zokorp.com/login/reset-password?token=raw-token",
    });
    sendPasswordResetEmailMock.mockResolvedValue({ ok: true });
    auditCreateMock.mockResolvedValue({});
    hashPasswordMock.mockResolvedValue("hashed-password");
    transactionMock.mockImplementation(async (callback) =>
      callback({
        userAuth: {
          update: userAuthUpdateMock,
        },
        user: {
          update: vi.fn(),
        },
        verificationToken: {
          deleteMany: vi.fn(),
        },
      }),
    );
  });

  it("issues reset emails against the current site origin and returns success even if audit logging fails", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user_123",
      email: "zkhawaja+atlas3@zokorp.com",
      userAuth: {
        id: "auth_123",
      },
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    auditCreateMock.mockRejectedValueOnce(new Error("audit unavailable"));

    const response = await requestResetPost(
      new Request("https://app.zokorp.com/api/auth/password/request-reset", {
        method: "POST",
        headers: {
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          email: "zkhawaja+atlas3@zokorp.com",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "If that account exists, a reset email has been sent.",
    });
    expect(issuePasswordResetTokenMock).toHaveBeenCalledWith({
      email: "zkhawaja+atlas3@zokorp.com",
      baseUrl: "https://app.zokorp.com",
    });
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({
      to: "zkhawaja+atlas3@zokorp.com",
      resetUrl: "https://app.zokorp.com/login/reset-password?token=raw-token",
    });

    consoleErrorSpy.mockRestore();
  });

  it("completes password resets for tokens stored in verificationToken records", async () => {
    const rawToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    consumePasswordResetTokenMock.mockResolvedValue({
      status: "valid",
      email: "zkhawaja+atlas3@zokorp.com",
      userId: "user_123",
      tokenHash: "hash_123",
      identifier: "password-reset:zkhawaja+atlas3@zokorp.com",
      user: {
        email: "zkhawaja+atlas3@zokorp.com",
        emailVerified: new Date("2026-03-27T19:05:00.000Z"),
      },
    });

    const response = await resetPost(
      new Request("https://app.zokorp.com/api/auth/password/reset", {
        method: "POST",
        headers: {
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          token: rawToken,
          password: "StrongEnough#2026",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Password updated successfully.",
    });
    expect(consumePasswordResetTokenMock).toHaveBeenCalledWith(rawToken);
    expect(userAuthFindFirstMock).not.toHaveBeenCalled();
  });

  it("still accepts legacy reset tokens stored on userAuth records", async () => {
    consumePasswordResetTokenMock.mockResolvedValue({
      status: "invalid",
    });
    userAuthFindFirstMock.mockResolvedValue({
      userId: "user_legacy",
      user: {
        email: "legacy@zokorp.com",
        emailVerified: new Date("2026-03-27T19:05:00.000Z"),
      },
    });

    const response = await resetPost(
      new Request("https://app.zokorp.com/api/auth/password/reset", {
        method: "POST",
        headers: {
          origin: "https://app.zokorp.com",
        },
        body: JSON.stringify({
          token: "legacy-raw-token-value-legacy-raw-token-value",
          password: "StrongEnough#2026",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: "Password updated successfully.",
    });
    expect(userAuthFindFirstMock).toHaveBeenCalledTimes(1);
  });
});
