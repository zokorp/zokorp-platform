import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  runWorkerBatch: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/architecture-review/worker-run", () => ({
  runArchitectureReviewWorkerBatch: mocks.runWorkerBatch,
}));

import { GET, POST } from "@/app/api/internal/cron/architecture-review-worker/route";

describe("architecture review worker cron route", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mocks.auditCreate.mockResolvedValue({});
    mocks.runWorkerBatch.mockResolvedValue({
      status: "ok",
      scanned: 3,
      processed: 2,
      sent: 2,
      fallback: 0,
      rejected: 0,
      failed: 0,
      runningOrQueued: 1,
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
      new Request("http://localhost/api/internal/cron/architecture-review-worker", {
        method: "GET",
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("runs the worker batch on authorized GET", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/cron/architecture-review-worker", {
        method: "GET",
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.runWorkerBatch).toHaveBeenCalledWith(3);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      processed: 2,
      sent: 2,
    });
  });

  it("rejects POST requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/cron/architecture-review-worker", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
  });
});
