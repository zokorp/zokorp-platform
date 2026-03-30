import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verificationCreateMock,
  verificationDeleteMock,
  verificationDeleteManyMock,
  verificationFindUniqueMock,
  userAuthFindFirstMock,
} = vi.hoisted(() => ({
  verificationCreateMock: vi.fn(),
  verificationDeleteMock: vi.fn(),
  verificationDeleteManyMock: vi.fn(),
  verificationFindUniqueMock: vi.fn(),
  userAuthFindFirstMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    verificationToken: {
      create: verificationCreateMock,
      delete: verificationDeleteMock,
      deleteMany: verificationDeleteManyMock,
      findUnique: verificationFindUniqueMock,
    },
    userAuth: {
      findFirst: userAuthFindFirstMock,
    },
  },
}));

import { hashOpaqueToken } from "@/lib/password-auth";
import { consumePasswordResetToken, issuePasswordResetToken } from "@/lib/password-reset-tokens";

describe("password reset token helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues reset links on the current origin while storing only the hash", async () => {
    verificationDeleteManyMock.mockResolvedValue({ count: 0 });
    verificationCreateMock.mockResolvedValue({});

    const result = await issuePasswordResetToken({
      email: " ZKHAWAJA+ATLAS3@zokorp.com ",
      baseUrl: "https://app.zokorp.com",
    });

    const url = new URL(result.resetUrl);
    const rawToken = url.searchParams.get("token");

    expect(result.email).toBe("zkhawaja+atlas3@zokorp.com");
    expect(url.origin).toBe("https://app.zokorp.com");
    expect(url.pathname).toBe("/login/reset-password");
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    expect(verificationDeleteManyMock).toHaveBeenCalledWith({
      where: {
        identifier: "password-reset:zkhawaja+atlas3@zokorp.com",
        expires: {
          lte: expect.any(Date),
        },
      },
    });
    expect(verificationCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        identifier: "password-reset:zkhawaja+atlas3@zokorp.com",
        token: hashOpaqueToken(rawToken!),
      }),
    });
  });

  it("accepts any still-valid reset token stored for the same email", async () => {
    const rawToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const tokenHash = hashOpaqueToken(rawToken);
    const now = new Date();
    const verifiedAt = new Date(now.getTime() - 60_000);

    verificationFindUniqueMock.mockResolvedValue({
      identifier: "password-reset:zkhawaja+atlas3@zokorp.com",
      token: tokenHash,
      expires: new Date(now.getTime() + 30 * 60 * 1000),
    });
    userAuthFindFirstMock.mockResolvedValue({
      userId: "user_123",
      user: {
        email: "zkhawaja+atlas3@zokorp.com",
        emailVerified: verifiedAt,
      },
    });

    const result = await consumePasswordResetToken(rawToken);

    expect(result).toEqual({
      status: "valid",
      email: "zkhawaja+atlas3@zokorp.com",
      userId: "user_123",
      tokenHash,
      identifier: "password-reset:zkhawaja+atlas3@zokorp.com",
      user: {
        email: "zkhawaja+atlas3@zokorp.com",
        emailVerified: verifiedAt,
      },
    });
  });

  it("expires old reset tokens and removes the stored hash", async () => {
    const rawToken = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const tokenHash = hashOpaqueToken(rawToken);
    const now = new Date();

    verificationFindUniqueMock.mockResolvedValue({
      identifier: "password-reset:zkhawaja+atlas3@zokorp.com",
      token: tokenHash,
      expires: new Date(now.getTime() - 1_000),
    });

    const result = await consumePasswordResetToken(rawToken);

    expect(result).toEqual({
      status: "expired",
      email: "zkhawaja+atlas3@zokorp.com",
    });
    expect(verificationDeleteMock).toHaveBeenCalledWith({
      where: { token: tokenHash },
    });
  });
});
