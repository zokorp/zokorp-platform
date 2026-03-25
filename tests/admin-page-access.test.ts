import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock, redirectMock, forbiddenMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  forbiddenMock: vi.fn(() => {
    throw new Error("FORBIDDEN_BOUNDARY");
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  forbidden: forbiddenMock,
}));

import { requireAdminPageAccess } from "@/lib/admin-page-access";

describe("requireAdminPageAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    await expect(requireAdminPageAccess("/admin/leads")).rejects.toThrow("REDIRECT:/login?callbackUrl=/admin/leads");
    expect(redirectMock).toHaveBeenCalledWith("/login?callbackUrl=/admin/leads");
    expect(forbiddenMock).not.toHaveBeenCalled();
  });

  it("raises a forbidden boundary for authenticated non-admins", async () => {
    requireAdminMock.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(requireAdminPageAccess("/admin/leads")).rejects.toThrow("FORBIDDEN_BOUNDARY");
    expect(forbiddenMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
