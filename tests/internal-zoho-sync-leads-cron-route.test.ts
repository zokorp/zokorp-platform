import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  runZohoLeadSync: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/zoho-sync-leads", () => ({
  runZohoLeadSync: mocks.runZohoLeadSync,
}));

import { GET, POST } from "@/app/api/internal/cron/zoho-sync-leads/route";

describe("zoho sync leads cron route", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mocks.auditCreate.mockResolvedValue({});
    mocks.runZohoLeadSync.mockResolvedValue({
      status: "ok",
      synced: 3,
      skipped: 0,
      failed: 0,
    });
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("returns unauthorized without the cron secret", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/cron/zoho-sync-leads", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("runs the sync on authorized GET", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/cron/zoho-sync-leads", {
        method: "GET",
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.runZohoLeadSync).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      synced: 3,
      skipped: 0,
      failed: 0,
    });
  });

  it("rejects POST requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/cron/zoho-sync-leads", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
  });
});
