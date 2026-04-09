import { afterEach, describe, expect, it, vi } from "vitest";

import { runUptimeMonitor } from "@/scripts/uptime_monitor.mjs";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

function htmlResponse(body = "<html><body>ok</body></html>", init?: ResponseInit) {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    ...init,
  });
}

describe("uptime monitor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when redirects, health checks, and public pages respond as expected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);

        if (url === "https://zokorp.com") {
          return new Response(null, {
            status: 301,
            headers: {
              location: "https://www.zokorp.com/",
            },
          });
        }

        if (url === "https://app.zokorp.com") {
          return new Response(null, {
            status: 308,
            headers: {
              location: "https://app.zokorp.com/software",
            },
          });
        }

        if (url === "https://www.zokorp.com/api/health") {
          return jsonResponse({
            status: "ok",
            observedHost: "www.zokorp.com",
            checks: {
              database: "ok",
            },
          });
        }

        if (url === "https://app.zokorp.com/api/health") {
          return jsonResponse({
            status: "ok",
            observedHost: "app.zokorp.com",
            checks: {
              database: "ok",
            },
          });
        }

        return htmlResponse();
      }),
    );

    const summary = await runUptimeMonitor();

    expect(summary.totals.fail).toBe(0);
    expect(summary.totals.pass).toBe(6);
  });

  it("fails when the app root no longer redirects to /software", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);

        if (url === "https://zokorp.com") {
          return new Response(null, {
            status: 301,
            headers: {
              location: "https://www.zokorp.com/",
            },
          });
        }

        if (url === "https://app.zokorp.com") {
          return new Response(null, {
            status: 200,
            headers: {
              location: "https://app.zokorp.com/",
            },
          });
        }

        if (url.endsWith("/api/health")) {
          return jsonResponse({
            status: "ok",
            observedHost: url.includes("www") ? "www.zokorp.com" : "app.zokorp.com",
            checks: {
              database: "ok",
            },
          });
        }

        return htmlResponse();
      }),
    );

    const summary = await runUptimeMonitor();
    const appRootCheck = summary.results.find((item) => item.id === "app_root_redirect");

    expect(appRootCheck?.ok).toBe(false);
    expect(summary.totals.fail).toBe(1);
  });

  it("fails when the health endpoint degrades or host metadata is wrong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);

        if (url === "https://zokorp.com") {
          return new Response(null, {
            status: 308,
            headers: {
              location: "https://www.zokorp.com/",
            },
          });
        }

        if (url === "https://app.zokorp.com") {
          return new Response(null, {
            status: 308,
            headers: {
              location: "https://app.zokorp.com/software",
            },
          });
        }

        if (url === "https://www.zokorp.com/api/health") {
          return jsonResponse({
            status: "ok",
            observedHost: "app.zokorp.com",
            checks: {
              database: "ok",
            },
          });
        }

        if (url === "https://app.zokorp.com/api/health") {
          return jsonResponse(
            {
              status: "degraded",
              observedHost: "app.zokorp.com",
              checks: {
                database: "down",
              },
            },
            { status: 503 },
          );
        }

        return htmlResponse();
      }),
    );

    const summary = await runUptimeMonitor();

    expect(summary.results.find((item) => item.id === "marketing_health")?.ok).toBe(false);
    expect(summary.results.find((item) => item.id === "app_health")?.ok).toBe(false);
    expect(summary.totals.fail).toBe(2);
  });

  it("records fetch errors as failures instead of crashing the monitor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network unavailable");
      }),
    );

    const summary = await runUptimeMonitor();

    expect(summary.totals.pass).toBe(0);
    expect(summary.totals.fail).toBe(6);
    expect(summary.results.every((item) => item.ok === false)).toBe(true);
  });
});
