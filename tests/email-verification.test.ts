import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const {
  verificationCreateMock,
  verificationDeleteMock,
  verificationDeleteManyMock,
  verificationFindUniqueMock,
  transactionMock,
  userFindUniqueMock,
  userUpdateManyMock,
} = vi.hoisted(() => ({
  verificationCreateMock: vi.fn(),
  verificationDeleteMock: vi.fn(),
  verificationDeleteManyMock: vi.fn(),
  verificationFindUniqueMock: vi.fn(),
  transactionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
  userUpdateManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    verificationToken: {
      create: verificationCreateMock,
      delete: verificationDeleteMock,
      deleteMany: verificationDeleteManyMock,
      findUnique: verificationFindUniqueMock,
    },
    user: {
      findUnique: userFindUniqueMock,
      updateMany: userUpdateManyMock,
    },
    $transaction: transactionMock,
  },
}));

import { consumeEmailVerificationToken, issueEmailVerificationToken } from "@/lib/email-verification";
import { hashOpaqueToken } from "@/lib/password-auth";

describe("email verification helpers", () => {
  const originalAdminEmails = process.env.ZOKORP_ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZOKORP_ADMIN_EMAILS = "admin@zokorp.com";
    transactionMock.mockImplementation(async (callback) =>
      callback({
        user: {
          updateMany: userUpdateManyMock,
          findUnique: userFindUniqueMock,
        },
      }),
    );
  });

  afterEach(() => {
    if (originalAdminEmails === undefined) {
      delete process.env.ZOKORP_ADMIN_EMAILS;
      return;
    }

    process.env.ZOKORP_ADMIN_EMAILS = originalAdminEmails;
  });

  it("issues a verification URL with a raw token while only storing the hash", async () => {
    verificationDeleteManyMock.mockResolvedValue({ count: 0 });
    verificationCreateMock.mockResolvedValue({});

    const result = await issueEmailVerificationToken({
      email: " Consulting+Atlas1@ZoKorp.com ",
      baseUrl: "https://app.zokorp.com",
    });

    const url = new URL(result.verifyUrl);
    const rawToken = url.searchParams.get("token");

    expect(result.email).toBe("consulting+atlas1@zokorp.com");
    expect(url.origin).toBe("https://app.zokorp.com");
    expect(url.pathname).toBe("/api/auth/verify-email/confirm");
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(verificationDeleteManyMock).toHaveBeenCalledWith({
      where: {
        identifier: "verify-email:consulting+atlas1@zokorp.com",
      },
    });
    expect(verificationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "verify-email:consulting+atlas1@zokorp.com",
        token: hashOpaqueToken(rawToken!),
      }),
    });
  });

  it("allows the same valid verification link to be consumed repeatedly until it expires", async () => {
    const rawToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const tokenHash = hashOpaqueToken(rawToken);
    const now = new Date();
    const verifiedAt = new Date(now.getTime() - 60_000);

    verificationFindUniqueMock.mockResolvedValue({
      identifier: "verify-email:consulting+atlas1@zokorp.com",
      token: tokenHash,
      expires: new Date(now.getTime() + 60 * 60 * 1000),
    });
    userUpdateManyMock.mockResolvedValue({ count: 1 });
    userFindUniqueMock.mockResolvedValue({
      id: "user_123",
      email: "consulting+atlas1@zokorp.com",
      emailVerified: verifiedAt,
      role: Role.USER,
    });

    const first = await consumeEmailVerificationToken(rawToken);
    const second = await consumeEmailVerificationToken(rawToken);

    expect(first).toEqual({
      status: "verified",
      userId: "user_123",
      email: "consulting+atlas1@zokorp.com",
      emailVerified: verifiedAt,
      role: Role.USER,
    });
    expect(second).toEqual(first);
    expect(verificationDeleteMock).not.toHaveBeenCalled();
    expect(verificationDeleteManyMock).not.toHaveBeenCalled();
    expect(userUpdateManyMock).toHaveBeenCalledTimes(2);
  });

  it("expires old tokens and removes their stored hash", async () => {
    const rawToken = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const tokenHash = hashOpaqueToken(rawToken);
    const now = new Date();

    verificationFindUniqueMock.mockResolvedValue({
      identifier: "verify-email:consulting+atlas1@zokorp.com",
      token: tokenHash,
      expires: new Date(now.getTime() - 1_000),
    });

    const result = await consumeEmailVerificationToken(rawToken);

    expect(result).toEqual({
      status: "expired",
      email: "consulting+atlas1@zokorp.com",
    });
    expect(verificationDeleteMock).toHaveBeenCalledWith({
      where: { token: tokenHash },
    });
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
