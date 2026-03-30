#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL ?? "https://zokorp-web.vercel.app";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 15000);

const routeChecks = [
  {
    path: "/",
    marker:
      "Practical AI delivery software, AWS guidance, and billing in one customer platform.",
    owner: "marketing-site",
    criticality: "high",
  },
  {
    path: "/login",
    marker: "Sign in",
    owner: "auth",
    criticality: "high",
  },
  {
    path: "/register",
    marker: "Create account",
    owner: "auth",
    criticality: "high",
  },
  {
    path: "/software/architecture-diagram-reviewer",
    marker: "Architecture Diagram Reviewer",
    owner: "software-tools",
    criticality: "medium",
  },
  {
    path: "/software/zokorp-validator",
    marker: "ZoKorpValidator",
    owner: "software-tools",
    criticality: "medium",
  },
  {
    path: "/software/mlops-foundation-platform",
    marker: "ZoKorp MLOps Foundation Platform",
    owner: "software-tools",
    criticality: "medium",
  },
];

const controlHosts = ["http://example.com", "https://vercel.com"];
const networkErrorCodes = new Set([
  "ABORT_ERR",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function withTimeoutFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    redirect: "follow",
    signal: controller.signal,
    headers: { "user-agent": "zokorp-production-smoke-check/1.0" },
  }).finally(() => clearTimeout(timer));
}

function classifySeverity(check, reason) {
  if (reason === "network_error") {
    return "P1";
  }
  if (reason === "http_status" && check.criticality === "high") {
    return "P1";
  }
  if (reason === "marker_missing" && check.criticality === "high") {
    return "P2";
  }
  return "P2";
}

async function probeRoute(check) {
  const url = new URL(check.path, baseUrl).toString();
  try {
    const response = await withTimeoutFetch(url);
    const body = await response.text();
    const markerFound = body.includes(check.marker);
    return {
      path: check.path,
      status: response.status,
      markerFound,
      owner: check.owner,
      expectedMarker: check.marker,
      failureCode: null,
    };
  } catch (error) {
    const failureCode =
      error?.cause?.code ??
      error?.code ??
      (error?.name === "AbortError" ? "ABORT_ERR" : "UNKNOWN_ERROR");
    return {
      path: check.path,
      status: null,
      markerFound: false,
      owner: check.owner,
      expectedMarker: check.marker,
      failureCode: String(failureCode),
    };
  }
}

async function probeControlHost(url) {
  try {
    const response = await withTimeoutFetch(url);
    return { url, ok: true, status: response.status, failureCode: null };
  } catch (error) {
    const failureCode =
      error?.cause?.code ??
      error?.code ??
      (error?.name === "AbortError" ? "ABORT_ERR" : "UNKNOWN_ERROR");
    return { url, ok: false, status: null, failureCode: String(failureCode) };
  }
}

function buildRegressions(results) {
  const regressions = [];
  for (const check of routeChecks) {
    const result = results.find((candidate) => candidate.path === check.path);
    if (!result) {
      continue;
    }
    if (result.status === null) {
      regressions.push({
        path: result.path,
        severity: classifySeverity(check, "network_error"),
        owner: check.owner,
        reason: "network_error",
        detail: result.failureCode ?? "UNKNOWN_ERROR",
      });
      continue;
    }
    if (result.status !== 200) {
      regressions.push({
        path: result.path,
        severity: classifySeverity(check, "http_status"),
        owner: check.owner,
        reason: "http_status",
        detail: `Expected 200, got ${result.status}`,
      });
      continue;
    }
    if (!result.markerFound) {
      regressions.push({
        path: result.path,
        severity: classifySeverity(check, "marker_missing"),
        owner: check.owner,
        reason: "marker_missing",
        detail: "Expected content marker missing",
      });
    }
  }
  return regressions;
}

function isEnvironmentNetworkFailure(controlResults, regressions) {
  if (controlResults.length === 0 || regressions.length === 0) {
    return false;
  }
  const allControlFailed = controlResults.every((result) => !result.ok);
  const allControlNetworkCodes = controlResults.every((result) =>
    networkErrorCodes.has(result.failureCode ?? ""),
  );
  const allRouteFailuresNetwork = regressions.every(
    (regression) => regression.reason === "network_error",
  );
  return allControlFailed && allControlNetworkCodes && allRouteFailuresNetwork;
}

function printHumanReport(summary) {
  console.log(`Base URL: ${summary.baseUrl}`);
  console.log(`Checked at: ${summary.checkedAt}`);
  console.log("");
  console.log("Route results:");
  for (const route of summary.routes) {
    const status = route.status ?? "000";
    const markerStatus = route.markerFound ? "marker_yes" : "marker_no";
    const failureSuffix = route.failureCode ? ` (${route.failureCode})` : "";
    console.log(
      `- ${route.path} -> HTTP ${status}, ${markerStatus}, owner=${route.owner}${failureSuffix}`,
    );
  }
  console.log("");
  console.log("Control host diagnostics:");
  for (const control of summary.controlHosts) {
    const status = control.status ?? "000";
    const detail = control.failureCode ? ` (${control.failureCode})` : "";
    console.log(`- ${control.url} -> HTTP ${status}${detail}`);
  }
  console.log("");
  if (summary.outcome === "pass") {
    console.log("Outcome: PASS (no regressions detected)");
    return;
  }
  if (summary.outcome === "blocked") {
    console.log(
      "Outcome: BLOCKED (automation runtime networking issue, production status unconfirmed)",
    );
    console.log("Severity: P1");
    console.log("Likely ownership: platform/automation-runtime networking");
    return;
  }
  console.log("Outcome: FAIL (regressions detected)");
  console.log("Regressions:");
  for (const regression of summary.regressions) {
    console.log(
      `- ${regression.severity} ${regression.path} owner=${regression.owner} reason=${regression.reason} detail=${regression.detail}`,
    );
  }
}

async function main() {
  const routeResults = [];
  for (const check of routeChecks) {
    routeResults.push(await probeRoute(check));
  }

  const controlResults = [];
  for (const host of controlHosts) {
    controlResults.push(await probeControlHost(host));
  }

  const regressions = buildRegressions(routeResults);
  const blocked = isEnvironmentNetworkFailure(controlResults, regressions);
  const outcome = regressions.length === 0 ? "pass" : blocked ? "blocked" : "fail";

  const summary = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    routes: routeResults,
    controlHosts: controlResults,
    regressions,
    outcome,
  };

  printHumanReport(summary);
  console.log("");
  console.log("JSON summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (outcome === "pass") {
    process.exit(0);
  }
  if (outcome === "blocked") {
    process.exit(2);
  }
  process.exit(1);
}

main().catch((error) => {
  console.error("Smoke check runner crashed:", error);
  process.exit(3);
});
