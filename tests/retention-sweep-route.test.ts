import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  runRetentionSweep: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/retention-sweep", () => ({
  runRetentionSweep: mocks.runRetentionSweep,
}));

import { GET, POST } from "@/app/api/internal/cron/retention-sweep/route";

describe("retention sweep cron route", () => {
  const originalCronSecret = process.env.CRON_SECRET;
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mocks.auditCreate.mockResolvedValue({});
    mocks.runRetentionSweep.mockResolvedValue({
      expiredArchivedSubmissionsDeleted: 1,
      expiredFingerprintsDeleted: 2,
      leadLogsScrubbed: 3,
      architectureJobsScrubbed: 4,
      architectureOutboxesRedacted: 5,
    });
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it("returns 503 when the cron secret is not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await POST(
      new Request("http://localhost/api/internal/cron/retention-sweep", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Cron secret is not configured.",
    });
  });

  it("returns unauthorized without the cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/cron/retention-sweep", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns unauthorized on GET without the cron secret", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/cron/retention-sweep", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("runs the retention sweep on authorized GET", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/cron/retention-sweep", {
        method: "GET",
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.runRetentionSweep).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      architectureOutboxesRedacted: 5,
    });
  });

  it("still runs the retention sweep on authorized POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/cron/retention-sweep", {
        method: "POST",
        headers: {
          "x-cron-secret": "cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.runRetentionSweep).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      architectureOutboxesRedacted: 5,
    });
  });
});
