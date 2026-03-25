import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
}));

const { getLeadDirectoryMock, renderLeadDirectoryCsvMock } = vi.hoisted(() => ({
  getLeadDirectoryMock: vi.fn(),
  renderLeadDirectoryCsvMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/admin-leads", () => ({
  getLeadDirectory: getLeadDirectoryMock,
  renderLeadDirectoryCsv: renderLeadDirectoryCsvMock,
}));

import { GET } from "@/app/admin/leads/export/route";

describe("admin leads export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(new Request("http://localhost/admin/leads/export"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns a CSV attachment for admins", async () => {
    requireAdminMock.mockResolvedValue({ id: "admin_user" });
    getLeadDirectoryMock.mockResolvedValue({ entries: [{ email: "jane@human-company.com" }] });
    renderLeadDirectoryCsvMock.mockReturnValue("email\njane@human-company.com\n");

    const response = await GET(new Request("http://localhost/admin/leads/export?audience=all"));

    expect(getLeadDirectoryMock).toHaveBeenCalledWith({ audience: "all" });
    expect(renderLeadDirectoryCsvMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("zokorp-leads-");
    await expect(response.text()).resolves.toContain("jane@human-company.com");
  });
});
