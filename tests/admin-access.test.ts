import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const { userUpdateMock, userFindUniqueMock } = vi.hoisted(() => ({
  userUpdateMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      update: userUpdateMock,
      findUnique: userFindUniqueMock,
    },
  },
}));

import {
  expectedAdminRole,
  hasVerifiedAdminAccess,
  isAdminEmailAllowlisted,
  loadAndSyncAdminUserById,
  syncAdminRoleForUser,
} from "@/lib/admin-access";

const originalAdminEmails = process.env.ZOKORP_ADMIN_EMAILS;

describe("admin access helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZOKORP_ADMIN_EMAILS = "zkhawaja@zokorp.com,ops@zokorp.com";
  });

  afterEach(() => {
    if (originalAdminEmails === undefined) {
      delete process.env.ZOKORP_ADMIN_EMAILS;
      return;
    }

    process.env.ZOKORP_ADMIN_EMAILS = originalAdminEmails;
  });

  it("recognizes allowlisted admin emails case-insensitively", () => {
    expect(isAdminEmailAllowlisted("ZKHAWAJA@ZOKORP.COM")).toBe(true);
    expect(isAdminEmailAllowlisted("team@acmecloud.com")).toBe(false);
  });

  it("requires verified email before granting admin access", () => {
    expect(
      hasVerifiedAdminAccess({
        email: "zkhawaja@zokorp.com",
        emailVerified: new Date("2026-03-09T10:00:00.000Z"),
      }),
    ).toBe(true);

    expect(
      hasVerifiedAdminAccess({
        email: "zkhawaja@zokorp.com",
        emailVerified: null,
      }),
    ).toBe(false);
  });

  it("promotes an allowlisted verified user to admin", async () => {
    userUpdateMock.mockResolvedValue({
      id: "user_1",
      email: "zkhawaja@zokorp.com",
      emailVerified: new Date("2026-03-09T10:00:00.000Z"),
      role: Role.ADMIN,
    });

    const updated = await syncAdminRoleForUser({
      id: "user_1",
      email: "zkhawaja@zokorp.com",
      emailVerified: new Date("2026-03-09T10:00:00.000Z"),
      role: Role.USER,
    });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { role: Role.ADMIN },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
      },
    });
    expect(updated.role).toBe(Role.ADMIN);
  });

  it("demotes a stale persisted admin when the email is no longer allowlisted", async () => {
    userUpdateMock.mockResolvedValue({
      id: "user_2",
      email: "former-admin@zokorp.com",
      emailVerified: new Date("2026-03-09T10:00:00.000Z"),
      role: Role.USER,
    });

    const updated = await syncAdminRoleForUser({
      id: "user_2",
      email: "former-admin@zokorp.com",
      emailVerified: new Date("2026-03-09T10:00:00.000Z"),
      role: Role.ADMIN,
    });

    expect(updated.role).toBe(Role.USER);
    expect(expectedAdminRole(updated)).toBe(Role.USER);
  });

  it("loads and syncs admin role by user id", async () => {
    userFindUniqueMock.mockResolvedValue({
      id: "user_3",
      email: "ops@zokorp.com",
      emailVerified: new Date("2026-03-09T10:00:00.000Z"),
      role: Role.USER,
    });
    userUpdateMock.mockResolvedValue({
      id: "user_3",
      email: "ops@zokorp.com",
      emailVerified: new Date("2026-03-09T10:00:00.000Z"),
      role: Role.ADMIN,
    });

    const user = await loadAndSyncAdminUserById("user_3");

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { id: "user_3" },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
      },
    });
    expect(user?.role).toBe(Role.ADMIN);
  });
});
