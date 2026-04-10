#!/usr/bin/env node

import {
  APP_HOST_MARKETING_REDIRECT_EXPECTATIONS,
  APP_PRODUCT_EXPECTATIONS,
  APP_ROOT_EXPECTATION,
  APP_ROUTE_EXPECTATIONS,
  APP_SIGNED_OUT_REDIRECT_EXPECTATIONS,
  APP_META_EXPECTATIONS,
  LEGACY_REDIRECT_EXPECTATIONS,
  MARKETING_ROUTE_EXPECTATIONS,
} from "./playwright_audit_contract.mjs";
import {
  buildStep,
  buildTotals,
  createSettingsReader,
  followFetch,
  isLocalHostUrl,
  loadAuditEnv,
  manualRedirectCheck,
  outcomeFromSteps,
  parseArgs,
  resolveExpectedCanonicalBaseUrl,
  resolveVercelProtectionBypassHeaders,
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
    const expectedSearch = new URLSearchParams(expected.search);
    const actualSearch = new URLSearchParams(actual.search);
    const expectedEntries = [...expectedSearch.entries()].sort(([left], [right]) => left.localeCompare(right));
    const actualEntries = [...actualSearch.entries()].sort(([left], [right]) => left.localeCompare(right));

    if (
      expected.protocol === actual.protocol &&
      expected.host === actual.host &&
      expected.pathname === actual.pathname &&
      JSON.stringify(expectedEntries) === JSON.stringify(actualEntries) &&
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
      JSON.stringify(expectedEntries) === JSON.stringify(actualEntries) &&
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

function normalizeCompact(value) {
  return value.replaceAll(/\s+/g, "").toLowerCase();
}

function extractCanonicalUrl(body) {
  const match = body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function extractRobotsMetaContent(body) {
  const match = body.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function canonicalUrlFor({ marketingBaseUrl, appBaseUrl }, path, canonicalHost) {
  const targetBaseUrl = canonicalHost === "app" ? appBaseUrl : marketingBaseUrl;
  return toAbsoluteUrl(path, targetBaseUrl);
}

async function probeControlHost(url, timeoutMs, requestHeaders) {
  try {
    const response = await followFetch(url, timeoutMs, smokeUserAgent, requestHeaders);
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
  requestHeaders,
}) {
  try {
    const result = await manualRedirectCheck(sourceUrl, timeoutMs, smokeUserAgent, requestHeaders);
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
  marketingBaseUrl,
  appBaseUrl,
  path,
  marker,
  timeoutMs,
  expectedHost,
  blockedHost,
  expectedCanonicalHost,
  expectedRobotsHeader,
  expectedRobotsContent,
  checkRobotsHeader = true,
  requestHeaders,
}) {
  const url = toAbsoluteUrl(path, baseUrl);

  try {
    const response = await followFetch(url, timeoutMs, smokeUserAgent, requestHeaders);
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

    if (expectedCanonicalHost) {
      const canonicalUrl = extractCanonicalUrl(response.body);
      const expectedCanonicalUrl = canonicalUrlFor(
        { marketingBaseUrl, appBaseUrl },
        path,
        expectedCanonicalHost,
      );
      if (!canonicalUrl) {
        return buildStep(id, label, "fail", {
          url,
          statusCode: response.status,
          finalUrl: response.finalUrl,
          detail: "Expected canonical link missing from page HTML.",
        });
      }

      if (!locationsMatch(expectedCanonicalUrl, canonicalUrl, { ignoreProtocol: shouldUseCompatibilityBaseUrl(baseUrl) })) {
        return buildStep(id, label, "fail", {
          url,
          statusCode: response.status,
          finalUrl: response.finalUrl,
          detail: `Expected canonical ${expectedCanonicalUrl}, got ${canonicalUrl}.`,
        });
      }
    }

    if (expectedRobotsHeader && checkRobotsHeader) {
      const actualRobotsHeader = response.headers["x-robots-tag"] ?? null;
      if (actualRobotsHeader !== expectedRobotsHeader) {
        return buildStep(id, label, "fail", {
          url,
          statusCode: response.status,
          finalUrl: response.finalUrl,
          detail: `Expected header x-robots-tag=${expectedRobotsHeader}, got ${actualRobotsHeader ?? "missing"}.`,
        });
      }
    }

    if (expectedRobotsContent) {
      const robotsContent = extractRobotsMetaContent(response.body);
      if (!robotsContent || normalizeCompact(robotsContent) !== normalizeCompact(expectedRobotsContent)) {
        return buildStep(id, label, "fail", {
          url,
          statusCode: response.status,
          finalUrl: response.finalUrl,
          detail: `Expected robots meta ${expectedRobotsContent}, got ${robotsContent ?? "missing"}.`,
        });
      }
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

async function runMetaCheck({
  id,
  label,
  baseUrl,
  path,
  timeoutMs,
  expectedCanonicalHost,
  expectedRobotsContent,
  marketingBaseUrl,
  appBaseUrl,
  requestHeaders,
}) {
  const url = toAbsoluteUrl(path, baseUrl);

  try {
    const response = await followFetch(url, timeoutMs, smokeUserAgent, requestHeaders);
    if (response.status !== 200) {
      return buildStep(id, label, "fail", {
        url,
        statusCode: response.status,
        finalUrl: response.finalUrl,
        detail: `Expected HTTP 200, got ${response.status}.`,
      });
    }

    if (expectedCanonicalHost) {
      const canonicalUrl = extractCanonicalUrl(response.body);
      const expectedCanonicalUrl = canonicalUrlFor(
        { marketingBaseUrl, appBaseUrl },
        path,
        expectedCanonicalHost,
      );
      if (!locationsMatch(expectedCanonicalUrl, canonicalUrl, { ignoreProtocol: shouldUseCompatibilityBaseUrl(baseUrl) })) {
        return buildStep(id, label, "fail", {
          url,
          statusCode: response.status,
          finalUrl: response.finalUrl,
          detail: `Expected canonical ${expectedCanonicalUrl}, got ${canonicalUrl ?? "missing"}.`,
        });
      }
    }

    if (expectedRobotsContent) {
      const robotsContent = extractRobotsMetaContent(response.body);
      if (!robotsContent || normalizeCompact(robotsContent) !== normalizeCompact(expectedRobotsContent)) {
        return buildStep(id, label, "fail", {
          url,
          statusCode: response.status,
          finalUrl: response.finalUrl,
          detail: `Expected robots meta ${expectedRobotsContent}, got ${robotsContent ?? "missing"}.`,
        });
      }
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
      detail: "Meta check failed because the destination could not be reached.",
    });
  }
}

async function runMarketingSeoCheck({ marketingBaseUrl, timeoutMs, requestHeaders }) {
  const robotsUrl = toAbsoluteUrl("/robots.txt", marketingBaseUrl);
  const sitemapUrl = toAbsoluteUrl("/sitemap.xml", marketingBaseUrl);

  try {
    const [robotsResponse, sitemapResponse] = await Promise.all([
      followFetch(robotsUrl, timeoutMs, smokeUserAgent, requestHeaders),
      followFetch(sitemapUrl, timeoutMs, smokeUserAgent, requestHeaders),
    ]);

    const issues = [];
    if (robotsResponse.status !== 200) {
      issues.push(`robots.txt returned ${robotsResponse.status}`);
    }
    if (!robotsResponse.body.includes(`Sitemap: ${marketingBaseUrl}/sitemap.xml`)) {
      issues.push("robots.txt missing canonical sitemap URL");
    }
    if (sitemapResponse.status !== 200) {
      issues.push(`sitemap.xml returned ${sitemapResponse.status}`);
    }
    if (!sitemapResponse.body.includes(`<loc>${marketingBaseUrl}/</loc>`)) {
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

async function runAppSeoChecks({ appBaseUrl, timeoutMs, requestHeaders }) {
  const appHost = new URL(appBaseUrl).host;
  const robotsUrl = toAbsoluteUrl("/robots.txt", appBaseUrl);
  const sitemapUrl = toAbsoluteUrl("/sitemap.xml", appBaseUrl);

  try {
    const [robotsResponse, sitemapResponse] = await Promise.all([
      followFetch(robotsUrl, timeoutMs, smokeUserAgent, requestHeaders),
      followFetch(sitemapUrl, timeoutMs, smokeUserAgent, requestHeaders),
    ]);

    const robotsIssues = [];
    if (robotsResponse.status !== 200) {
      robotsIssues.push(`robots.txt returned ${robotsResponse.status}`);
    }
    if (robotsResponse.body.includes("Sitemap:")) {
      robotsIssues.push("robots.txt should not declare a sitemap on the app host");
    }
    if (robotsResponse.body.includes("Host:")) {
      robotsIssues.push("robots.txt should not declare a host on the app host");
    }
    if (!robotsResponse.body.includes("Disallow: /account")) {
      robotsIssues.push("robots.txt should keep account routes disallowed");
    }

    const sitemapIssues = [];
    if (sitemapResponse.status !== 404) {
      sitemapIssues.push(`sitemap.xml returned ${sitemapResponse.status}`);
    }
    if (new URL(sitemapResponse.finalUrl).host !== appHost) {
      sitemapIssues.push(`sitemap.xml resolved on unexpected host ${new URL(sitemapResponse.finalUrl).host}`);
    }

    return [
      robotsIssues.length > 0
        ? buildStep("app_robots", "App robots contract", "fail", {
            url: robotsUrl,
            detail: robotsIssues.join("; "),
          })
        : buildStep("app_robots", "App robots contract", "pass", {
            url: robotsUrl,
          }),
      sitemapIssues.length > 0
        ? buildStep("app_sitemap_absent", "App sitemap removed from crawl surface", "fail", {
            url: sitemapUrl,
            detail: sitemapIssues.join("; "),
          })
        : buildStep("app_sitemap_absent", "App sitemap removed from crawl surface", "pass", {
            url: sitemapUrl,
          }),
    ];
  } catch (error) {
    return [
      buildStep("app_robots", "App robots contract", "fail", {
        url: robotsUrl,
        failureCode: String(getErrorCode(error)),
        detail: "Unable to fetch app-host robots.txt.",
      }),
      buildStep("app_sitemap_absent", "App sitemap removed from crawl surface", "fail", {
        url: sitemapUrl,
        failureCode: String(getErrorCode(error)),
        detail: "Unable to fetch app-host sitemap.xml.",
      }),
    ];
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
  const fallbackBaseUrl =
    args.SMOKE_BASE_URL ??
    process.env.SMOKE_BASE_URL ??
    args.JOURNEY_BASE_URL ??
    process.env.JOURNEY_BASE_URL ??
    "";
  const compatibilityBaseUrl = shouldUseCompatibilityBaseUrl(fallbackBaseUrl) ? fallbackBaseUrl : "";
  const explicitMarketingBaseUrl = readSetting(
    ["SMOKE_MARKETING_BASE_URL", "JOURNEY_MARKETING_BASE_URL"],
    "",
  );
  const explicitAppBaseUrl = readSetting(["SMOKE_APP_BASE_URL", "JOURNEY_APP_BASE_URL"], "");
  const marketingBaseUrl =
    options.marketingBaseUrl ??
    (explicitMarketingBaseUrl || (!explicitAppBaseUrl && compatibilityBaseUrl) || "https://www.zokorp.com");
  const appBaseUrl =
    options.appBaseUrl ??
    (explicitAppBaseUrl || (!explicitMarketingBaseUrl && compatibilityBaseUrl) || "https://app.zokorp.com");
  const expectedMarketingCanonicalBaseUrl =
    options.expectedMarketingCanonicalBaseUrl ??
    resolveExpectedCanonicalBaseUrl({
      observedBaseUrl: marketingBaseUrl,
      explicitBaseUrl: readSetting(
        [
          "SMOKE_EXPECTED_MARKETING_CANONICAL_BASE_URL",
          "JOURNEY_EXPECTED_MARKETING_CANONICAL_BASE_URL",
        ],
        "",
      ),
      defaultBaseUrl: "https://www.zokorp.com",
    });
  const expectedAppCanonicalBaseUrl =
    options.expectedAppCanonicalBaseUrl ??
    resolveExpectedCanonicalBaseUrl({
      observedBaseUrl: appBaseUrl,
      explicitBaseUrl: readSetting(
        ["SMOKE_EXPECTED_APP_CANONICAL_BASE_URL", "JOURNEY_EXPECTED_APP_CANONICAL_BASE_URL"],
        "",
      ),
      defaultBaseUrl: "https://app.zokorp.com",
    });
  const apexBaseUrl =
    options.apexBaseUrl ??
    readSetting(
      ["SMOKE_APEX_BASE_URL", "JOURNEY_APEX_BASE_URL"],
      new URL(marketingBaseUrl).host === "www.zokorp.com" ? "https://zokorp.com" : "",
    );
  const timeoutMs =
    options.timeoutMs ?? Number(readSetting(["SMOKE_TIMEOUT_MS", "JOURNEY_TIMEOUT_MS"], "15000"));
  const requestHeaders = resolveVercelProtectionBypassHeaders(readSetting);
  const steps = [];
  const marketingHost = new URL(marketingBaseUrl).host;
  const appHost = new URL(appBaseUrl).host;
  const productionMarketingBlockAllowed = expectedProductionMarketingBlock(marketingBaseUrl, appBaseUrl);
  const hostSplitSkipped = sameOrigin(marketingBaseUrl, appBaseUrl);
  const localSameOriginRun =
    hostSplitSkipped && isLocalHostUrl(marketingBaseUrl) && isLocalHostUrl(appBaseUrl);
  const compatibilityHostSplit =
    shouldUseCompatibilityBaseUrl(marketingBaseUrl) || shouldUseCompatibilityBaseUrl(appBaseUrl);

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
        requestHeaders,
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
      buildStep("app_root_landing", "App root renders the app landing page", "skipped", {
        detail: "Skipped because marketing and app are using the same origin for this run.",
      }),
    );
  } else {
    steps.push(
      await runPageCheck({
        id: "app_root_landing",
        label: "App root renders the app landing page",
        baseUrl: appBaseUrl,
        marketingBaseUrl: expectedMarketingCanonicalBaseUrl,
        appBaseUrl: expectedAppCanonicalBaseUrl,
        path: APP_ROOT_EXPECTATION.path,
        marker: APP_ROOT_EXPECTATION.marker,
        timeoutMs,
        expectedHost: appHost,
        expectedCanonicalHost: APP_ROOT_EXPECTATION.expectedCanonicalHost,
        expectedRobotsHeader: APP_ROOT_EXPECTATION.expectedRobotsHeader,
        expectedRobotsContent: APP_ROOT_EXPECTATION.expectedRobotsContent,
        requestHeaders,
      }),
    );
  }

  for (const route of MARKETING_ROUTE_EXPECTATIONS) {
    steps.push(
      await runPageCheck({
        id: `marketing_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
        label: `Marketing page: ${route.label}`,
        baseUrl: marketingBaseUrl,
        marketingBaseUrl: expectedMarketingCanonicalBaseUrl,
        appBaseUrl: expectedAppCanonicalBaseUrl,
        path: route.path,
        marker: route.marker,
        timeoutMs,
        expectedHost: marketingHost,
        blockedHost: productionMarketingBlockAllowed ? appHost : null,
        requestHeaders,
      }),
    );
  }

  for (const route of APP_ROUTE_EXPECTATIONS) {
    steps.push(
      await runPageCheck({
        id: `app_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
        label: `App route: ${route.label}`,
        baseUrl: appBaseUrl,
        marketingBaseUrl: expectedMarketingCanonicalBaseUrl,
        appBaseUrl: expectedAppCanonicalBaseUrl,
        path: route.path,
        marker: route.marker,
        timeoutMs,
        expectedHost: appHost,
        expectedCanonicalHost: route.expectedCanonicalHost,
        expectedRobotsHeader: route.expectedRobotsHeader,
        expectedRobotsContent: route.expectedRobotsContent,
        checkRobotsHeader: !hostSplitSkipped,
        requestHeaders,
      }),
    );
  }

  for (const product of APP_PRODUCT_EXPECTATIONS) {
    steps.push(
      await runPageCheck({
        id: `product_${product.slug}`,
        label: `App product page: ${product.label}`,
        baseUrl: appBaseUrl,
        marketingBaseUrl: expectedMarketingCanonicalBaseUrl,
        appBaseUrl: expectedAppCanonicalBaseUrl,
        path: product.path,
        marker: product.titleMarker,
        timeoutMs,
        expectedHost: appHost,
        expectedCanonicalHost: product.expectedCanonicalHost,
        expectedRobotsHeader: product.expectedRobotsHeader,
        expectedRobotsContent: product.expectedRobotsContent,
        checkRobotsHeader: !hostSplitSkipped,
        requestHeaders,
      }),
    );
  }

  for (const metaExpectation of APP_META_EXPECTATIONS) {
    steps.push(
      await runMetaCheck({
        id: metaExpectation.id,
        label: metaExpectation.label,
        baseUrl: appBaseUrl,
        path: metaExpectation.path,
        timeoutMs,
        expectedCanonicalHost: metaExpectation.expectedCanonicalHost,
        expectedRobotsContent: metaExpectation.expectedRobotsContent,
        marketingBaseUrl: expectedMarketingCanonicalBaseUrl,
        appBaseUrl: expectedAppCanonicalBaseUrl,
        requestHeaders,
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
        ignoreProtocol: localSameOriginRun || compatibilityHostSplit,
        requestHeaders,
      }),
    );
  }

  if (hostSplitSkipped) {
    for (const route of APP_HOST_MARKETING_REDIRECT_EXPECTATIONS) {
      steps.push(
        buildStep(
          `app_marketing_redirect_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
          `App host redirects marketing route: ${route.label}`,
          "skipped",
          {
            detail: "Skipped because marketing and app are using the same origin for this run.",
          },
        ),
      );
    }

    for (const route of APP_SIGNED_OUT_REDIRECT_EXPECTATIONS) {
      steps.push(
        buildStep(
          `app_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}_redirect_to_login`,
          `Signed-out ${route.label.toLowerCase()} redirects to login`,
          "skipped",
          {
            detail: "Skipped because marketing and app are using the same origin for this run.",
          },
        ),
      );
    }

    steps.push(
      buildStep("app_robots", "App robots contract", "skipped", {
        detail: "Skipped because marketing and app are using the same origin for this run.",
      }),
    );
    steps.push(
      buildStep("app_sitemap_absent", "App sitemap removed from crawl surface", "skipped", {
        detail: "Skipped because marketing and app are using the same origin for this run.",
      }),
    );
  } else {
    for (const route of APP_HOST_MARKETING_REDIRECT_EXPECTATIONS) {
      steps.push(
        await runRedirectCheck({
          id: `app_marketing_redirect_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
          label: `App host redirects marketing route: ${route.label}`,
          sourceUrl: toAbsoluteUrl(route.path, appBaseUrl),
          expectedLocation: toAbsoluteUrl(route.path, marketingBaseUrl),
          timeoutMs,
          ignoreProtocol: compatibilityHostSplit,
          requestHeaders,
        }),
      );
    }

    for (const route of APP_SIGNED_OUT_REDIRECT_EXPECTATIONS) {
      steps.push(
        await runRedirectCheck({
          id: `app_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}_redirect_to_login`,
          label: `Signed-out ${route.label.toLowerCase()} redirects to login`,
          sourceUrl: toAbsoluteUrl(route.path, appBaseUrl),
          expectedLocation: toAbsoluteUrl(route.expectedLocation, appBaseUrl),
          timeoutMs,
          ignoreProtocol: compatibilityHostSplit,
          requestHeaders,
        }),
      );
    }

    steps.push(...(await runAppSeoChecks({ appBaseUrl, timeoutMs, requestHeaders })));
  }

  steps.push(
    await runMarketingSeoCheck({
      marketingBaseUrl,
      timeoutMs,
      requestHeaders,
    }),
  );

  const controlResults = [];
  for (const host of controlHosts) {
    controlResults.push(await probeControlHost(host, timeoutMs, requestHeaders));
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
