#!/usr/bin/env node

import { pathToFileURL } from "node:url";

function userAgent() {
  return "ZoKorpUptimeMonitor/1.0";
}

async function fetchText(url, timeoutMs) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent(),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    response,
    body: await response.text(),
  };
}

async function fetchJson(url, timeoutMs) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent(),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    response,
    payload: await response.json().catch(() => null),
  };
}

async function fetchRedirect(url, timeoutMs) {
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": userAgent(),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  return {
    response,
    location: response.headers.get("location"),
  };
}

function hostOf(url) {
  return new URL(url).host;
}

function matchesRedirectLocation(location, absoluteTarget, relativeTarget) {
  return location === absoluteTarget || location === relativeTarget;
}

function htmlResponseOk(response) {
  return response.ok && (response.headers.get("content-type") ?? "").includes("text/html");
}

export async function runUptimeMonitor({
  marketingBaseUrl = process.env.UPTIME_MARKETING_BASE_URL || "https://www.zokorp.com",
  appBaseUrl = process.env.UPTIME_APP_BASE_URL || "https://app.zokorp.com",
  apexBaseUrl = process.env.UPTIME_APEX_BASE_URL || "https://zokorp.com",
  timeoutMs = Number(process.env.UPTIME_TIMEOUT_MS || 15000),
} = {}) {
  const checks = [
    {
      id: "apex_redirect",
      label: "Apex redirects to canonical marketing host",
      run: async () => {
        const { response, location } = await fetchRedirect(apexBaseUrl, timeoutMs);

        return {
          ok: [301, 308].includes(response.status) && matchesRedirectLocation(location, `${marketingBaseUrl}/`, "/"),
          status: response.status,
          location,
        };
      },
    },
    {
      id: "app_root_redirect",
      label: "App root redirects to /software",
      run: async () => {
        const { response, location } = await fetchRedirect(appBaseUrl, timeoutMs);

        return {
          ok: [301, 308].includes(response.status) && matchesRedirectLocation(location, `${appBaseUrl}/software`, "/software"),
          status: response.status,
          location,
        };
      },
    },
    {
      id: "marketing_health",
      label: "Marketing host health endpoint",
      run: async () => {
        const url = new URL("/api/health", marketingBaseUrl).toString();
        const { response, payload } = await fetchJson(url, timeoutMs);

        return {
          ok:
            response.ok &&
            payload?.status === "ok" &&
            payload?.checks?.database === "ok" &&
            payload?.observedHost === hostOf(marketingBaseUrl),
          status: response.status,
          payload,
        };
      },
    },
    {
      id: "app_health",
      label: "App host health endpoint",
      run: async () => {
        const url = new URL("/api/health", appBaseUrl).toString();
        const { response, payload } = await fetchJson(url, timeoutMs);

        return {
          ok:
            response.ok &&
            payload?.status === "ok" &&
            payload?.checks?.database === "ok" &&
            payload?.observedHost === hostOf(appBaseUrl),
          status: response.status,
          payload,
        };
      },
    },
    {
      id: "marketing_home",
      label: "Marketing homepage responds",
      run: async () => {
        const { response } = await fetchText(marketingBaseUrl, timeoutMs);

        return {
          ok: htmlResponseOk(response),
          status: response.status,
        };
      },
    },
    {
      id: "app_login",
      label: "App login responds",
      run: async () => {
        const { response } = await fetchText(new URL("/login", appBaseUrl), timeoutMs);

        return {
          ok: htmlResponseOk(response),
          status: response.status,
        };
      },
    },
  ];

  const results = [];

  for (const check of checks) {
    try {
      const result = await check.run();
      results.push({
        id: check.id,
        label: check.label,
        ok: result.ok,
        ...result,
      });
    } catch (error) {
      results.push({
        id: check.id,
        label: check.label,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    baseUrls: {
      apex: apexBaseUrl,
      marketing: marketingBaseUrl,
      app: appBaseUrl,
    },
    totals: {
      pass: results.filter((item) => item.ok).length,
      fail: results.filter((item) => !item.ok).length,
    },
    results,
  };
}

async function main() {
  const summary = await runUptimeMonitor();

  for (const result of summary.results) {
    console.log(`- ${result.ok ? "PASS" : "FAIL"} ${result.label}`);
  }

  console.log("\nJSON summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.totals.fail > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Uptime monitor failed:", error instanceof Error ? error.message : error);
    process.exit(3);
  });
}
