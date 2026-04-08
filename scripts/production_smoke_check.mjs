#!/usr/bin/env node

import {
  APP_PRODUCT_EXPECTATIONS,
  APP_ROUTE_EXPECTATIONS,
  LEGACY_REDIRECT_EXPECTATIONS,
  MARKETING_ROUTE_EXPECTATIONS,
} from "./playwright_audit_contract.mjs";
import {
  buildStep,
  buildTotals,
  createSettingsReader,
  followFetch,
  loadAuditEnv,
  manualRedirectCheck,
  outcomeFromSteps,
  parseArgs,
  shouldUseCompatibilityBaseUrl,
  toAbsoluteUrl,
} from "./playwright_audit_support.mjs";
import { pathToFileURL } from "node:url";

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
const smokeUserAgent = "zokorp-production-smoke-check/2.0";

function getErrorCode(error) {
  return (
    error?.cause?.code ??
    error?.code ??
    (error?.name === "AbortError" ? "ABORT_ERR" : "UNKNOWN_ERROR")
  );
}

function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function isLocalHostUrl(value) {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function locationsMatch(expectedLocation, actualLocation, options = {}) {
  if (!expectedLocation || !actualLocation) {
    return false;
  }

  if (actualLocation === expectedLocation) {
    return true;
  }

  try {
    const expected = new URL(expectedLocation);
    const actual = new URL(actualLocation, expected);

    if (
      expected.protocol === actual.protocol &&
      expected.host === actual.host &&
      expected.pathname === actual.pathname &&
      expected.search === actual.search &&
      expected.hash === actual.hash
    ) {
      return true;
    }

    if (!options.ignoreProtocol) {
      return false;
    }

    return (
      expected.host === actual.host &&
      expected.pathname === actual.pathname &&
      expected.search === actual.search &&
      expected.hash === actual.hash
    );
  } catch {
    return false;
  }
}

function expectedProductionMarketingBlock(marketingBaseUrl, appBaseUrl) {
  try {
    return (
      new URL(marketingBaseUrl).host === "www.zokorp.com" &&
      new URL(appBaseUrl).host === "app.zokorp.com"
    );
  } catch {
    return false;
  }
}

async function probeControlHost(url, timeoutMs) {
  try {
    const response = await followFetch(url, timeoutMs, smokeUserAgent);
    return { url, ok: true, status: response.status, failureCode: null };
  } catch (error) {
    return {
      url,
      ok: false,
      status: null,
      failureCode: String(getErrorCode(error)),
    };
  }
}

async function runRedirectCheck({
  id,
  label,
  sourceUrl,
  expectedLocation,
  timeoutMs,
  blockedWhenLocationMatches,
  ignoreProtocol = false,
}) {
  try {
    const result = await manualRedirectCheck(sourceUrl, timeoutMs, smokeUserAgent);
    const resolvedLocation = result.location
      ? (() => {
          try {
            return new URL(result.location, sourceUrl).toString();
          } catch {
            return result.location;
          }
        })()
      : result.location;
    if (result.status === null || result.status < 300 || result.status > 399) {
      return buildStep(id, label, "fail", {
        url: sourceUrl,
        statusCode: result.status,
        detail: `Expected redirect to ${expectedLocation}, got HTTP ${result.status ?? "000"}.`,
      });
    }

    if (locationsMatch(expectedLocation, resolvedLocation, { ignoreProtocol })) {
      return buildStep(id, label, "pass", {
        url: sourceUrl,
        statusCode: result.status,
        location: resolvedLocation,
      });
    }

    if (
      blockedWhenLocationMatches &&
      locationsMatch(blockedWhenLocationMatches, resolvedLocation, { ignoreProtocol })
    ) {
      return buildStep(id, label, "blocked", {
        url: sourceUrl,
        statusCode: result.status,
        location: resolvedLocation,
        detail: `Redirect target is still ${blockedWhenLocationMatches} instead of ${expectedLocation}.`,
      });
    }

    return buildStep(id, label, "fail", {
      url: sourceUrl,
      statusCode: result.status,
      location: resolvedLocation,
      detail: `Expected redirect to ${expectedLocation}, got ${resolvedLocation ?? "no Location header"}.`,
    });
  } catch (error) {
    return buildStep(id, label, "fail", {
      url: sourceUrl,
      failureCode: String(getErrorCode(error)),
      detail: "Redirect check failed because the destination could not be reached.",
    });
  }
}

async function runPageCheck({
  id,
  label,
  baseUrl,
  path,
  marker,
  timeoutMs,
  expectedHost,
  blockedHost,
}) {
  const url = toAbsoluteUrl(path, baseUrl);

  try {
    const response = await followFetch(url, timeoutMs, smokeUserAgent);
    const finalHost = new URL(response.finalUrl).host;

    if (expectedHost && finalHost !== expectedHost) {
      const status = blockedHost && finalHost === blockedHost ? "blocked" : "fail";
      return buildStep(id, label, status, {
        url,
        statusCode: response.status,
        finalUrl: response.finalUrl,
        detail: `Expected host ${expectedHost}, got ${finalHost}.`,
      });
    }

    if (response.status !== 200) {
      return buildStep(id, label, "fail", {
        url,
        statusCode: response.status,
        finalUrl: response.finalUrl,
        detail: `Expected HTTP 200, got ${response.status}.`,
      });
    }

    if (!response.body.includes(marker)) {
      return buildStep(id, label, "fail", {
        url,
        statusCode: response.status,
        finalUrl: response.finalUrl,
        expectedMarker: marker,
        detail: "Expected page marker missing from response body.",
      });
    }

    return buildStep(id, label, "pass", {
      url,
      statusCode: response.status,
      finalUrl: response.finalUrl,
    });
  } catch (error) {
    return buildStep(id, label, "fail", {
      url,
      failureCode: String(getErrorCode(error)),
      detail: "Page check failed because the destination could not be reached.",
    });
  }
}

async function runHeaderCheck({ id, label, url, timeoutMs, expectedHeader, expectedValue }) {
  try {
    const response = await followFetch(url, timeoutMs, smokeUserAgent);
    const actualValue = response.headers[expectedHeader.toLowerCase()] ?? null;
    if (actualValue !== expectedValue) {
      return buildStep(id, label, "fail", {
        url,
        statusCode: response.status,
        finalUrl: response.finalUrl,
        detail: `Expected header ${expectedHeader}=${expectedValue}, got ${actualValue ?? "missing"}.`,
      });
    }

    return buildStep(id, label, "pass", {
      url,
      statusCode: response.status,
      finalUrl: response.finalUrl,
    });
  } catch (error) {
    return buildStep(id, label, "fail", {
      url,
      failureCode: String(getErrorCode(error)),
      detail: "Header check failed because the destination could not be reached.",
    });
  }
}

async function runSeoCheck({ marketingBaseUrl, timeoutMs }) {
  const robotsUrl = toAbsoluteUrl("/robots.txt", marketingBaseUrl);
  const sitemapUrl = toAbsoluteUrl("/sitemap.xml", marketingBaseUrl);

  try {
    const [robotsResponse, sitemapResponse] = await Promise.all([
      followFetch(robotsUrl, timeoutMs, smokeUserAgent),
      followFetch(sitemapUrl, timeoutMs, smokeUserAgent),
    ]);

    const issues = [];
    if (robotsResponse.status !== 200) {
      issues.push(`robots.txt returned ${robotsResponse.status}`);
    }
    if (!robotsResponse.body.includes("Sitemap: https://www.zokorp.com/sitemap.xml")) {
      issues.push("robots.txt missing canonical sitemap URL");
    }
    if (sitemapResponse.status !== 200) {
      issues.push(`sitemap.xml returned ${sitemapResponse.status}`);
    }
    if (!sitemapResponse.body.includes("<loc>https://www.zokorp.com/</loc>")) {
      issues.push("sitemap.xml missing canonical homepage URL");
    }
    if (sitemapResponse.body.includes("https://app.zokorp.com")) {
      issues.push("sitemap.xml should not include app-host URLs");
    }

    if (issues.length > 0) {
      return buildStep("marketing_seo", "Marketing robots and sitemap", "fail", {
        url: robotsUrl,
        detail: issues.join("; "),
      });
    }

    return buildStep("marketing_seo", "Marketing robots and sitemap", "pass", {
      url: robotsUrl,
    });
  } catch (error) {
    return buildStep("marketing_seo", "Marketing robots and sitemap", "fail", {
      url: robotsUrl,
      failureCode: String(getErrorCode(error)),
      detail: "Unable to fetch robots.txt or sitemap.xml.",
    });
  }
}

function isEnvironmentNetworkFailure(controlResults, steps) {
  if (controlResults.length === 0 || steps.length === 0) {
    return false;
  }

  const allControlFailed = controlResults.every((result) => !result.ok);
  const allControlNetworkCodes = controlResults.every((result) =>
    networkErrorCodes.has(result.failureCode ?? ""),
  );
  const failingSteps = steps.filter((step) => step.status === "fail");
  const everyFailureIsNetwork = failingSteps.every((step) =>
    networkErrorCodes.has(step.failureCode ?? ""),
  );

  return failingSteps.length > 0 && allControlFailed && allControlNetworkCodes && everyFailureIsNetwork;
}

function printHumanReport(summary) {
  console.log(`Marketing base URL: ${summary.baseUrls.marketing}`);
  console.log(`App base URL: ${summary.baseUrls.app}`);
  console.log(`Checked at: ${summary.checkedAt}`);
  console.log("");
  console.log("Smoke checks:");
  for (const step of summary.steps) {
    const suffix = step.detail ? ` (${step.detail})` : "";
    console.log(`- ${step.status.toUpperCase()} ${step.label}${suffix}`);
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
    console.log("Outcome: PASS");
    return;
  }
  if (summary.outcome === "blocked") {
    console.log("Outcome: BLOCKED");
    return;
  }
  console.log("Outcome: FAIL");
}

export async function runProductionSmokeCheck(options = {}) {
  const args = parseArgs(process.argv.slice(2));
  const envFile = loadAuditEnv(args["journey-env-file"] ?? process.env.JOURNEY_ENV_FILE);
  const readSetting = createSettingsReader({ args, envFile });
  const fallbackBaseUrl = args.SMOKE_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "";
  const compatibilityBaseUrl = shouldUseCompatibilityBaseUrl(fallbackBaseUrl) ? fallbackBaseUrl : "";
  const explicitMarketingBaseUrl = readSetting("SMOKE_MARKETING_BASE_URL", "");
  const explicitAppBaseUrl = readSetting("SMOKE_APP_BASE_URL", "");
  const marketingBaseUrl =
    options.marketingBaseUrl ??
    (explicitMarketingBaseUrl || (!explicitAppBaseUrl && compatibilityBaseUrl) || "https://www.zokorp.com");
  const appBaseUrl =
    options.appBaseUrl ??
    (explicitAppBaseUrl || (!explicitMarketingBaseUrl && compatibilityBaseUrl) || "https://app.zokorp.com");
  const apexBaseUrl =
    options.apexBaseUrl ??
    readSetting(
      ["SMOKE_APEX_BASE_URL"],
      new URL(marketingBaseUrl).host === "www.zokorp.com" ? "https://zokorp.com" : "",
    );
  const timeoutMs = options.timeoutMs ?? Number(readSetting("SMOKE_TIMEOUT_MS", "15000"));
  const steps = [];
  const marketingHost = new URL(marketingBaseUrl).host;
  const appHost = new URL(appBaseUrl).host;
  const productionMarketingBlockAllowed = expectedProductionMarketingBlock(marketingBaseUrl, appBaseUrl);
  const hostSplitSkipped = sameOrigin(marketingBaseUrl, appBaseUrl);
  const localSameOriginRun =
    hostSplitSkipped && isLocalHostUrl(marketingBaseUrl) && isLocalHostUrl(appBaseUrl);

  if (apexBaseUrl && !sameOrigin(apexBaseUrl, marketingBaseUrl)) {
    const apexExpectedLocation = toAbsoluteUrl("/", marketingBaseUrl);
    steps.push(
      await runRedirectCheck({
        id: "apex_redirect",
        label: "Apex redirects to canonical marketing host",
        sourceUrl: apexBaseUrl,
        expectedLocation: apexExpectedLocation,
        timeoutMs,
        blockedWhenLocationMatches:
          productionMarketingBlockAllowed && toAbsoluteUrl("/", appBaseUrl) !== apexExpectedLocation
            ? toAbsoluteUrl("/", appBaseUrl)
            : null,
        ignoreProtocol: isLocalHostUrl(apexBaseUrl) && isLocalHostUrl(marketingBaseUrl),
      }),
    );
  } else {
    steps.push(
      buildStep("apex_redirect", "Apex redirects to canonical marketing host", "skipped", {
        detail: apexBaseUrl
          ? "Skipped because apex and marketing use the same origin for this target."
          : "Skipped because SMOKE_APEX_BASE_URL is not configured for this target.",
      }),
    );
  }

  if (hostSplitSkipped) {
    steps.push(
      buildStep("app_root_redirect", "App root redirects to /software", "skipped", {
        detail: "Skipped because marketing and app are using the same origin for this run.",
      }),
    );
  } else {
    steps.push(
      await runRedirectCheck({
        id: "app_root_redirect",
        label: "App root redirects to /software",
        sourceUrl: appBaseUrl,
        expectedLocation: toAbsoluteUrl("/software", appBaseUrl),
        timeoutMs,
      }),
    );
  }

  for (const route of MARKETING_ROUTE_EXPECTATIONS) {
    steps.push(
      await runPageCheck({
        id: `marketing_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
        label: `Marketing page: ${route.label}`,
        baseUrl: marketingBaseUrl,
        path: route.path,
        marker: route.marker,
        timeoutMs,
        expectedHost: marketingHost,
        blockedHost: productionMarketingBlockAllowed ? appHost : null,
      }),
    );
  }

  for (const route of APP_ROUTE_EXPECTATIONS) {
    steps.push(
      await runPageCheck({
        id: `app_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
        label: `App route: ${route.label}`,
        baseUrl: appBaseUrl,
        path: route.path,
        marker: route.marker,
        timeoutMs,
        expectedHost: appHost,
      }),
    );
  }

  for (const product of APP_PRODUCT_EXPECTATIONS) {
    steps.push(
      await runPageCheck({
        id: `product_${product.slug}`,
        label: `App product page: ${product.label}`,
        baseUrl: appBaseUrl,
        path: product.path,
        marker: product.titleMarker,
        timeoutMs,
        expectedHost: appHost,
      }),
    );
  }

  for (const redirectExpectation of LEGACY_REDIRECT_EXPECTATIONS) {
    steps.push(
      await runRedirectCheck({
        id: `legacy_${redirectExpectation.from.replaceAll("/", "_") || "root"}`,
        label: `Legacy redirect: ${redirectExpectation.from}`,
        sourceUrl: toAbsoluteUrl(redirectExpectation.from, marketingBaseUrl),
        expectedLocation: toAbsoluteUrl(redirectExpectation.to, marketingBaseUrl),
        timeoutMs,
        blockedWhenLocationMatches:
          productionMarketingBlockAllowed &&
          marketingHost !== appHost &&
          toAbsoluteUrl(redirectExpectation.to, appBaseUrl),
        ignoreProtocol: localSameOriginRun,
      }),
    );
  }

  if (hostSplitSkipped) {
    steps.push(
      buildStep("app_noindex", "App-host marketing pages emit noindex", "skipped", {
        detail: "Skipped because marketing and app are using the same origin for this run.",
      }),
    );
  } else {
    steps.push(
      await runHeaderCheck({
        id: "app_noindex",
        label: "App-host marketing pages emit noindex",
        url: toAbsoluteUrl("/contact", appBaseUrl),
        timeoutMs,
        expectedHeader: "x-robots-tag",
        expectedValue: "noindex, follow",
      }),
    );
  }

  steps.push(
    await runSeoCheck({
      marketingBaseUrl,
      timeoutMs,
    }),
  );

  const controlResults = [];
  for (const host of controlHosts) {
    controlResults.push(await probeControlHost(host, timeoutMs));
  }

  const outcome = isEnvironmentNetworkFailure(controlResults, steps)
    ? "blocked"
    : outcomeFromSteps(steps);

  return {
    checkedAt: new Date().toISOString(),
    baseUrls: {
      apex: apexBaseUrl || null,
      marketing: marketingBaseUrl,
      app: appBaseUrl,
    },
    totals: buildTotals(steps),
    steps,
    controlHosts: controlResults,
    outcome,
  };
}

async function main() {
  const summary = await runProductionSmokeCheck();
  printHumanReport(summary);
  console.log("");
  console.log("JSON summary:");
  console.log(JSON.stringify(summary, null, 2));

  if (summary.outcome === "pass") {
    process.exit(0);
  }

  process.exit(summary.outcome === "blocked" ? 2 : 1);
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      "Production smoke check crashed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(3);
  });
}
