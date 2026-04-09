import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRawUnsafe: mocks.queryRawUnsafe,
  },
}));

import { GET, HEAD } from "@/app/api/health/route";

describe("public health route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns ok when the database check succeeds", async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET(new Request("https://www.zokorp.com/api/health"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      observedHost: "www.zokorp.com",
      checks: {
        app: "ok",
        database: "ok",
      },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns degraded when the database check fails", async () => {
    mocks.queryRawUnsafe.mockRejectedValueOnce(new Error("db down"));

    const response = await GET(new Request("https://app.zokorp.com/api/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      observedHost: "app.zokorp.com",
      checks: {
        database: "error",
      },
    });
  });

  it("supports HEAD requests for uptime tools", async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await HEAD(new Request("https://www.zokorp.com/api/health"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
