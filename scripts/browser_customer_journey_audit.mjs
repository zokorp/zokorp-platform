#!/usr/bin/env node

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import {
  APP_PRODUCT_EXPECTATIONS,
  APP_ROOT_EXPECTATION,
  APP_ROUTE_EXPECTATIONS,
  APP_META_EXPECTATIONS,
  CONSULTING_PRICE_MARKERS,
  FOOTER_LEGAL_LINK_LABELS,
  MARKETING_MORE_MENU_LABELS,
  MARKETING_PRIMARY_NAV_LABELS,
  MARKETING_ROUTE_EXPECTATIONS,
} from "./playwright_audit_contract.mjs";
import { runProductionSmokeCheck } from "./production_smoke_check.mjs";
import {
  attachContextDiagnostics,
  buildStep,
  buildTotals,
  collectLandmarkSnapshot,
  collectHeadSnapshot,
  createBrowserDiagnostics,
  createSettingsReader,
  ensureDir,
  loadAuditEnv,
  outcomeFromSteps,
  parseArgs,
  persistDiagnostics,
  readBoolean,
  readNumber,
  resolveExpectedCanonicalBaseUrl,
  resolveVercelProtectionBypassHeaders,
  resolveOutputPath,
  shouldUseCompatibilityBaseUrl,
  writeJsonFile,
  writePageScreenshot,
} from "./playwright_audit_support.mjs";

function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function urlsMatch(left, right) {
  if (!left || !right) {
    return false;
  }

  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return (
      leftUrl.origin === rightUrl.origin &&
      leftUrl.pathname === rightUrl.pathname &&
      leftUrl.search === rightUrl.search &&
      leftUrl.hash === rightUrl.hash
    );
  } catch {
    return left === right;
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

function errorDetail(error) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeCompact(value) {
  return value.replaceAll(/\s+/g, "").toLowerCase();
}

function canonicalBaseUrlFor(config, canonicalHost) {
  return canonicalHost === "app"
    ? config.expectedAppCanonicalBaseUrl
    : config.expectedMarketingCanonicalBaseUrl;
}

async function assertVisibleText(page, text, timeoutMs) {
  await page.getByText(text, { exact: false }).first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
}

async function assertVisibleAny(page, texts, timeoutMs) {
  let lastError = null;

  for (const text of texts) {
    try {
      await assertVisibleText(page, text, timeoutMs);
      return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to find any expected marker: ${texts.join(", ")}`);
}

async function gotoAndAssert(page, url, marker, timeoutMs) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await assertVisibleText(page, marker, timeoutMs);
  return response;
}

async function assertLandmarkBaseline(page, timeoutMs) {
  const snapshot = await collectLandmarkSnapshot(page);
  if (snapshot.landmarks.headerCount < 1 || snapshot.landmarks.mainCount < 1 || snapshot.headings.length < 1) {
    throw new Error("Expected header, main, and at least one heading to be present.");
  }

  await page.getByRole("main").getByRole("heading").first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });

  return snapshot;
}

function pushBlockedSteps(steps, routeExpectations, prefix, reason) {
  for (const route of routeExpectations) {
    steps.push(
      buildStep(
        `${prefix}_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
        `${prefix === "marketing" ? "Marketing page" : "App route"}: ${route.label}`,
        "blocked",
        { detail: reason },
      ),
    );
  }
}

async function runMarketingJourney(page, steps, config) {
  const marketingHome = new URL("/", config.marketingBaseUrl).toString();
  await page.goto(marketingHome, {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });

  const currentHost = new URL(page.url()).host;
  if (currentHost !== config.marketingHost) {
    const status = config.productionMarketingBlockAllowed && currentHost === config.appHost ? "blocked" : "fail";
    steps.push(
      buildStep("marketing_home", "Marketing page: Homepage", status, {
        url: page.url(),
        detail: `Expected marketing host ${config.marketingHost}, got ${currentHost}.`,
      }),
    );

    if (status === "blocked") {
      pushBlockedSteps(
        steps,
        MARKETING_ROUTE_EXPECTATIONS.slice(1),
        "marketing",
        "Skipped because the marketing host still resolves to the app host.",
      );
      return;
    }

    throw new Error(`Marketing homepage loaded on unexpected host ${currentHost}.`);
  }

  await assertVisibleText(page, MARKETING_ROUTE_EXPECTATIONS[0].marker, config.timeoutMs);
  const homeLandmarks = await assertLandmarkBaseline(page, config.timeoutMs);
  steps.push(
    buildStep("marketing_home", "Marketing page: Homepage", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "marketing-home"),
      landmarks: homeLandmarks,
    }),
  );

  const header = page.getByRole("banner");
  const primaryNav = header.getByRole("navigation").first();

  for (const label of MARKETING_PRIMARY_NAV_LABELS) {
    await primaryNav.getByRole("link", { name: label, exact: true }).waitFor({
      state: "visible",
      timeout: config.timeoutMs,
    });
  }
  steps.push(
    buildStep("marketing_primary_nav", "Marketing header primary navigation", "pass", {
      labels: MARKETING_PRIMARY_NAV_LABELS,
    }),
  );

  const moreToggle = header.getByRole("button", { name: "More", exact: true });
  await moreToggle.click();
  for (const label of MARKETING_MORE_MENU_LABELS) {
    await page.getByLabel("More pages").getByRole("link", { name: label, exact: true }).waitFor({
      state: "visible",
      timeout: config.timeoutMs,
    });
  }
  await moreToggle.click();
  steps.push(
    buildStep("marketing_more_menu", "Marketing more menu", "pass", {
      labels: MARKETING_MORE_MENU_LABELS,
    }),
  );

  const homeCtas = [
    { label: "Book a call", expectedFragment: "utm_source=zokorp" },
    { label: "Get a quote", expectedFragment: "/services#service-request" },
    { label: "Explore software", expectedFragment: "/software" },
  ];

  for (const cta of homeCtas) {
    const href = await page.getByRole("main").getByRole("link", { name: cta.label, exact: true }).first().getAttribute("href");
    if (!href || !href.includes(cta.expectedFragment)) {
      throw new Error(`CTA ${cta.label} is missing expected destination fragment ${cta.expectedFragment}.`);
    }
  }

  steps.push(
    buildStep("marketing_home_ctas", "Homepage CTA map", "pass", {
      labels: homeCtas.map((item) => item.label),
    }),
  );

  const footer = page.getByRole("contentinfo");
  for (const footerLabel of FOOTER_LEGAL_LINK_LABELS) {
    const footerLink = footer.getByRole("link", { name: footerLabel, exact: true });
    await footerLink.scrollIntoViewIfNeeded();
    await footerLink.waitFor({
      state: "visible",
      timeout: config.timeoutMs,
    });
  }
  steps.push(
    buildStep("marketing_footer_links", "Marketing footer trust links", "pass", {
      labels: FOOTER_LEGAL_LINK_LABELS,
    }),
  );

  const routeScreenshots = new Set(["Services", "About", "Contact", "Pricing", "Software", "Support"]);
  for (const route of MARKETING_ROUTE_EXPECTATIONS.slice(1)) {
    await gotoAndAssert(page, new URL(route.path, config.marketingBaseUrl).toString(), route.marker, config.timeoutMs);
    const details = {
      url: page.url(),
      landmarks: await collectLandmarkSnapshot(page),
    };

    if (routeScreenshots.has(route.label)) {
      details.screenshot = await writePageScreenshot(
        page,
        config.screenshotsDir,
        `marketing-${route.label}`,
      );
    }

    steps.push(
      buildStep(
        `marketing_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
        `Marketing page: ${route.label}`,
        "pass",
        details,
      ),
    );
  }

  await page.goto(new URL("/services", config.marketingBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  for (const marker of CONSULTING_PRICE_MARKERS) {
    await assertVisibleText(page, marker, config.timeoutMs);
  }
  await assertLandmarkBaseline(page, config.timeoutMs);
  steps.push(
    buildStep("marketing_services_pricing", "Services pricing anchors", "pass", {
      markers: CONSULTING_PRICE_MARKERS,
    }),
  );
}

async function runAppJourney(page, steps, config) {
  if (config.hostSplitSkipped) {
    steps.push(
      buildStep("app_root_landing", "App root renders the app landing page", "skipped", {
        detail: "Skipped because marketing and app are using the same origin for this run.",
      }),
    );
  } else {
    await gotoAndAssert(
      page,
      new URL(APP_ROOT_EXPECTATION.path, config.appBaseUrl).toString(),
      APP_ROOT_EXPECTATION.marker,
      config.timeoutMs,
    );
    const headSnapshot = await collectHeadSnapshot(page);
    const expectedCanonicalUrl = new URL(APP_ROOT_EXPECTATION.path, config.expectedAppCanonicalBaseUrl).toString();
    const robotsContent = normalizeCompact(headSnapshot.robotsContent ?? "");
    if (!urlsMatch(headSnapshot.canonicalHref, expectedCanonicalUrl)) {
      steps.push(
        buildStep("app_root_landing", "App root renders the app landing page", "fail", {
          url: page.url(),
          screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-root-landing-failure"),
          detail: `Expected canonical ${expectedCanonicalUrl}, got ${headSnapshot.canonicalHref ?? "missing"}.`,
        }),
      );
    } else if (robotsContent !== normalizeCompact(APP_ROOT_EXPECTATION.expectedRobotsContent)) {
      steps.push(
        buildStep("app_root_landing", "App root renders the app landing page", "fail", {
          url: page.url(),
          screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-root-landing-failure"),
          detail: `Expected robots meta ${APP_ROOT_EXPECTATION.expectedRobotsContent}, got ${headSnapshot.robotsContent ?? "missing"}.`,
        }),
      );
    } else {
      steps.push(
        buildStep("app_root_landing", "App root renders the app landing page", "pass", {
          url: page.url(),
          screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-root-landing"),
        }),
      );
    }
  }

  for (const route of APP_ROUTE_EXPECTATIONS) {
    try {
      const response = await gotoAndAssert(page, new URL(route.path, config.appBaseUrl).toString(), route.marker, config.timeoutMs);
      if (!config.hostSplitSkipped && route.expectedRobotsHeader) {
        const robotsHeader = response?.headers()?.["x-robots-tag"] ?? null;
        if (robotsHeader !== route.expectedRobotsHeader) {
          throw new Error(`Expected x-robots-tag=${route.expectedRobotsHeader}, got ${robotsHeader ?? "missing"}.`);
        }
      }
      if (route.expectedCanonicalHost || route.expectedRobotsContent) {
        const headSnapshot = await collectHeadSnapshot(page);
        if (route.expectedCanonicalHost) {
          const expectedCanonicalUrl = new URL(
            route.path,
            canonicalBaseUrlFor(config, route.expectedCanonicalHost),
          ).toString();
          if (!urlsMatch(headSnapshot.canonicalHref, expectedCanonicalUrl)) {
            throw new Error(`Expected canonical ${expectedCanonicalUrl}, got ${headSnapshot.canonicalHref ?? "missing"}.`);
          }
        }
        if (
          route.expectedRobotsContent &&
          normalizeCompact(headSnapshot.robotsContent ?? "") !== normalizeCompact(route.expectedRobotsContent)
        ) {
          throw new Error(
            `Expected robots meta ${route.expectedRobotsContent}, got ${headSnapshot.robotsContent ?? "missing"}.`,
          );
        }
      }
      steps.push(
        buildStep(
          `app_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
          `App route: ${route.label}`,
          "pass",
          {
            url: page.url(),
          },
        ),
      );
    } catch (error) {
      steps.push(
        buildStep(
          `app_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
          `App route: ${route.label}`,
          "fail",
          {
            url: page.url(),
            screenshot: await writePageScreenshot(
              page,
              config.screenshotsDir,
              `app-route-${route.label}-failure`,
            ),
            detail: errorDetail(error),
          },
        ),
      );
    }
  }

  for (const product of APP_PRODUCT_EXPECTATIONS) {
    try {
      const response = await page.goto(new URL(product.path, config.appBaseUrl).toString(), {
        waitUntil: "domcontentloaded",
        timeout: config.timeoutMs,
      });
      await assertVisibleText(page, product.titleMarker, config.timeoutMs);
      const matchedMarker = await assertVisibleAny(page, product.publicMarkers, config.timeoutMs);
      if (!config.hostSplitSkipped && product.expectedRobotsHeader) {
        const robotsHeader = response?.headers()?.["x-robots-tag"] ?? null;
        if (robotsHeader !== product.expectedRobotsHeader) {
          throw new Error(`Expected x-robots-tag=${product.expectedRobotsHeader}, got ${robotsHeader ?? "missing"}.`);
        }
      }
      if (product.expectedCanonicalHost || product.expectedRobotsContent) {
        const headSnapshot = await collectHeadSnapshot(page);
        if (product.expectedCanonicalHost) {
          const expectedCanonicalUrl = new URL(
            product.path,
            canonicalBaseUrlFor(config, product.expectedCanonicalHost),
          ).toString();
          if (!urlsMatch(headSnapshot.canonicalHref, expectedCanonicalUrl)) {
            throw new Error(`Expected canonical ${expectedCanonicalUrl}, got ${headSnapshot.canonicalHref ?? "missing"}.`);
          }
        }
        if (
          product.expectedRobotsContent &&
          normalizeCompact(headSnapshot.robotsContent ?? "") !== normalizeCompact(product.expectedRobotsContent)
        ) {
          throw new Error(
            `Expected robots meta ${product.expectedRobotsContent}, got ${headSnapshot.robotsContent ?? "missing"}.`,
          );
        }
      }
      steps.push(
        buildStep(`app_public_${product.slug}`, `App public product page: ${product.label}`, "pass", {
          url: page.url(),
          matchedMarker,
        }),
      );
    } catch (error) {
      steps.push(
        buildStep(`app_public_${product.slug}`, `App public product page: ${product.label}`, "fail", {
          url: page.url(),
          screenshot: await writePageScreenshot(
            page,
            config.screenshotsDir,
            `app-public-${product.slug}-failure`,
          ),
          detail: errorDetail(error),
        }),
      );
    }
  }

  for (const metaExpectation of APP_META_EXPECTATIONS) {
    try {
      await page.goto(new URL(metaExpectation.path, config.appBaseUrl).toString(), {
        waitUntil: "domcontentloaded",
        timeout: config.timeoutMs,
      });
      const headSnapshot = await collectHeadSnapshot(page);
      if (metaExpectation.expectedCanonicalHost) {
        const expectedCanonicalUrl = new URL(
          metaExpectation.path,
          canonicalBaseUrlFor(config, metaExpectation.expectedCanonicalHost),
        ).toString();
        if (!urlsMatch(headSnapshot.canonicalHref, expectedCanonicalUrl)) {
          throw new Error(`Expected canonical ${expectedCanonicalUrl}, got ${headSnapshot.canonicalHref ?? "missing"}.`);
        }
      }
      if (
        metaExpectation.expectedRobotsContent &&
        normalizeCompact(headSnapshot.robotsContent ?? "") !== normalizeCompact(metaExpectation.expectedRobotsContent)
      ) {
        throw new Error(
          `Expected robots meta ${metaExpectation.expectedRobotsContent}, got ${headSnapshot.robotsContent ?? "missing"}.`,
        );
      }
      steps.push(
        buildStep(metaExpectation.id, `App meta: ${metaExpectation.label}`, "pass", {
          url: page.url(),
        }),
      );
    } catch (error) {
      steps.push(
        buildStep(metaExpectation.id, `App meta: ${metaExpectation.label}`, "fail", {
          url: page.url(),
          detail: errorDetail(error),
        }),
      );
    }
  }
}

async function runAuthenticatedJourney(page, steps, config) {
  if (!config.loginEmail || !config.loginPassword) {
    steps.push(
      buildStep("app_auth_login", "Authenticated app journey", "skipped", {
        detail: "Set JOURNEY_EMAIL and JOURNEY_PASSWORD to enable authenticated browser checks.",
      }),
    );
    return;
  }

  await page.goto(new URL("/login", config.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  await page.locator("#email").fill(config.loginEmail);
  await page.locator("#password").fill(config.loginPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  try {
    await page.waitForURL(/\/(account|software)(\/|$)|\/login\?error=/, {
      timeout: config.timeoutMs,
    });
  } catch {
    // Fall through to the explicit /account verification below.
  }
  const accountResponse = await page.goto(new URL("/account", config.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });

  if (page.url().includes("/login")) {
    steps.push(
      buildStep("app_auth_login", "Authenticated app journey", "blocked", {
        detail: "Configured JOURNEY_EMAIL/JOURNEY_PASSWORD did not establish a local authenticated session.",
        url: page.url(),
      }),
    );
    steps.push(
      buildStep("app_billing", "Billing page", "blocked", {
        detail: "Blocked because the configured authenticated session could not be established.",
      }),
    );
    for (const product of APP_PRODUCT_EXPECTATIONS) {
      steps.push(
        buildStep(`app_auth_${product.slug}`, `Authenticated product page: ${product.label}`, "blocked", {
          detail: "Blocked because the configured authenticated session could not be established.",
        }),
      );
    }
    return;
  }

  if (!config.hostSplitSkipped) {
    const accountRobotsHeader = accountResponse?.headers()?.["x-robots-tag"] ?? null;
    if (accountRobotsHeader !== "noindex, nofollow") {
      throw new Error(`Expected /account to emit x-robots-tag=noindex, nofollow, got ${accountRobotsHeader ?? "missing"}.`);
    }
  }

  await assertVisibleText(page, "Welcome back", config.timeoutMs);
  await assertVisibleText(page, "Billing and Invoices", config.timeoutMs);
  const accountHeadSnapshot = await collectHeadSnapshot(page);
  if (!urlsMatch(accountHeadSnapshot.canonicalHref, new URL("/account", config.expectedAppCanonicalBaseUrl).toString())) {
    throw new Error(`Expected /account canonical to stay on the app host, got ${accountHeadSnapshot.canonicalHref ?? "missing"}.`);
  }
  if (normalizeCompact(accountHeadSnapshot.robotsContent ?? "") !== "noindex,nofollow") {
    throw new Error(`Expected /account robots meta noindex,nofollow, got ${accountHeadSnapshot.robotsContent ?? "missing"}.`);
  }

  steps.push(
    buildStep("app_auth_login", "Authenticated app journey", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-account"),
    }),
  );

  const billingResponse = await page.goto(new URL("/account/billing", config.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  await assertVisibleText(page, "Billing and Subscriptions", config.timeoutMs);
  if (!config.hostSplitSkipped) {
    const billingRobotsHeader = billingResponse?.headers()?.["x-robots-tag"] ?? null;
    if (billingRobotsHeader !== "noindex, nofollow") {
      throw new Error(`Expected /account/billing to emit x-robots-tag=noindex, nofollow, got ${billingRobotsHeader ?? "missing"}.`);
    }
  }
  const billingHeadSnapshot = await collectHeadSnapshot(page);
  if (!urlsMatch(billingHeadSnapshot.canonicalHref, new URL("/account/billing", config.expectedAppCanonicalBaseUrl).toString())) {
    throw new Error(`Expected /account/billing canonical to stay on the app host, got ${billingHeadSnapshot.canonicalHref ?? "missing"}.`);
  }
  if (normalizeCompact(billingHeadSnapshot.robotsContent ?? "") !== "noindex,nofollow") {
    throw new Error(`Expected /account/billing robots meta noindex,nofollow, got ${billingHeadSnapshot.robotsContent ?? "missing"}.`);
  }
  steps.push(
    buildStep("app_billing", "Billing page", "pass", {
      url: page.url(),
    }),
  );

  for (const product of APP_PRODUCT_EXPECTATIONS) {
    await page.goto(new URL(product.path, config.appBaseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });
    const matchedMarker = await assertVisibleAny(page, product.authenticatedMarkers, config.timeoutMs);
    steps.push(
      buildStep(
        `app_auth_${product.slug}`,
        `Authenticated product page: ${product.label}`,
        "pass",
        {
          url: page.url(),
          matchedMarker,
        },
      ),
    );
  }
}

export async function runBrowserCustomerJourneyAudit(options = {}) {
  const args = parseArgs(process.argv.slice(2));
  const envFile = loadAuditEnv(args["journey-env-file"] ?? process.env.JOURNEY_ENV_FILE);
  const readSetting = createSettingsReader({ args, envFile });
  const fallbackBaseUrl = args.JOURNEY_BASE_URL ?? process.env.JOURNEY_BASE_URL ?? "";
  const compatibilityBaseUrl = shouldUseCompatibilityBaseUrl(fallbackBaseUrl) ? fallbackBaseUrl : "";
  const explicitMarketingBaseUrl = readSetting("JOURNEY_MARKETING_BASE_URL", "");
  const explicitAppBaseUrl = readSetting("JOURNEY_APP_BASE_URL", "");
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
      explicitBaseUrl: readSetting("JOURNEY_EXPECTED_MARKETING_CANONICAL_BASE_URL", ""),
      defaultBaseUrl: "https://www.zokorp.com",
    });
  const expectedAppCanonicalBaseUrl =
    options.expectedAppCanonicalBaseUrl ??
    resolveExpectedCanonicalBaseUrl({
      observedBaseUrl: appBaseUrl,
      explicitBaseUrl: readSetting("JOURNEY_EXPECTED_APP_CANONICAL_BASE_URL", ""),
      defaultBaseUrl: "https://app.zokorp.com",
    });
  const outputDir =
    options.outputDir ??
    resolveOutputPath(readSetting("JOURNEY_OUTPUT_DIR", "output/playwright/customer-journey-audit"));
  const screenshotsDir = join(outputDir, "screenshots");
  const headed = readBoolean(readSetting("JOURNEY_HEADED", "false"));
  const browserChannel = readSetting("JOURNEY_BROWSER_CHANNEL", "chrome");
  const timeoutMs = readNumber(readSetting("JOURNEY_TIMEOUT_MS", "30000"), 30000);
  const loginEmail = readSetting("JOURNEY_EMAIL", "");
  const loginPassword = readSetting("JOURNEY_PASSWORD", "");
  const diagnostics = createBrowserDiagnostics();
  const protectionBypassHeaders = resolveVercelProtectionBypassHeaders(readSetting, {
    setCookie: true,
  });
  const hostSplitSkipped = sameOrigin(marketingBaseUrl, appBaseUrl);
  const config = {
    marketingBaseUrl,
    appBaseUrl,
    outputDir,
    screenshotsDir,
    headed,
    browserChannel,
    timeoutMs,
    loginEmail,
    loginPassword,
    hostSplitSkipped,
    expectedMarketingCanonicalBaseUrl,
    expectedAppCanonicalBaseUrl,
    marketingHost: new URL(marketingBaseUrl).host,
    appHost: new URL(appBaseUrl).host,
    productionMarketingBlockAllowed: expectedProductionMarketingBlock(marketingBaseUrl, appBaseUrl),
  };

  ensureDir(outputDir);
  ensureDir(screenshotsDir);

  const preflight = await runProductionSmokeCheck({
    marketingBaseUrl,
    appBaseUrl,
    timeoutMs,
  });
  const steps = preflight.steps.map((step) => ({
    ...step,
    phase: "preflight",
  }));

  let browser;
  try {
    browser = await chromium.launch({
      channel: browserChannel,
      headless: !headed,
    });
  } catch (error) {
    if (browserChannel !== "chrome") {
      throw error;
    }

    browser = await chromium.launch({
      headless: !headed,
    });
  }

  const context = await browser.newContext({
    extraHTTPHeaders: protectionBypassHeaders,
    viewport: { width: 1440, height: 960 },
  });
  attachContextDiagnostics(context, diagnostics);
  const page = await context.newPage();

  try {
    await runMarketingJourney(page, steps, config);
    await runAppJourney(page, steps, config);
    await runAuthenticatedJourney(page, steps, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    steps.push(
      buildStep("journey_failure", "Browser customer journey audit", "fail", {
        error: message,
        url: page.url(),
        screenshot: await writePageScreenshot(page, screenshotsDir, "journey-failure"),
      }),
    );
  } finally {
    await context.close();
    await browser.close();
  }

  const diagnosticPaths = persistDiagnostics(outputDir, diagnostics);
  const summary = {
    checkedAt: new Date().toISOString(),
    baseUrls: {
      marketing: marketingBaseUrl,
      app: appBaseUrl,
    },
    totals: buildTotals(steps),
    diagnostics: {
      consolePath: diagnosticPaths.consolePath,
      networkPath: diagnosticPaths.networkPath,
      consoleMessages: diagnostics.consoleMessages.length,
      pageErrors: diagnostics.pageErrors.length,
      requestFailures: diagnostics.requestFailures.length,
      ignoredRequestFailures: diagnostics.ignoredRequestFailures.length,
      responseFailures: diagnostics.responseFailures.length,
    },
    steps,
    outcome: outcomeFromSteps(steps),
  };

  writeJsonFile(join(outputDir, "summary.json"), summary);
  return summary;
}

async function main() {
  const summary = await runBrowserCustomerJourneyAudit();

  console.log(`Marketing base URL: ${summary.baseUrls.marketing}`);
  console.log(`App base URL: ${summary.baseUrls.app}`);
  console.log(`Checked at: ${summary.checkedAt}`);
  console.log("");
  for (const step of summary.steps) {
    const suffix = step.detail ? ` (${step.detail})` : "";
    console.log(`- ${step.status.toUpperCase()} ${step.label}${suffix}`);
  }
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
      "Browser customer journey audit crashed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(3);
  });
}
