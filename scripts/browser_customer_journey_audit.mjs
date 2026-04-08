#!/usr/bin/env node

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import {
  APP_PRODUCT_EXPECTATIONS,
  APP_ROUTE_EXPECTATIONS,
  CONSULTING_PRICE_MARKERS,
  FOOTER_LEGAL_LINK_LABELS,
  MARKETING_MORE_MENU_LABELS,
  MARKETING_PRIMARY_NAV_LABELS,
  MARKETING_ROUTE_EXPECTATIONS,
} from "./playwright_audit_contract.mjs";
import {
  attachContextDiagnostics,
  buildStep,
  buildTotals,
  collectLandmarkSnapshot,
  createBrowserDiagnostics,
  createSettingsReader,
  ensureDir,
  loadAuditEnv,
  outcomeFromSteps,
  parseArgs,
  persistDiagnostics,
  readBoolean,
  readNumber,
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
  await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
  await assertVisibleText(page, marker, timeoutMs);
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
    waitUntil: "networkidle",
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
  steps.push(
    buildStep("marketing_home", "Marketing page: Homepage", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "marketing-home"),
      landmarks: await collectLandmarkSnapshot(page),
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

  await header.getByRole("button", { name: "More", exact: true }).click();
  for (const label of MARKETING_MORE_MENU_LABELS) {
    await page.getByLabel("More pages").getByRole("link", { name: label, exact: true }).waitFor({
      state: "visible",
      timeout: config.timeoutMs,
    });
  }
  await page.keyboard.press("Escape");
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
    waitUntil: "networkidle",
    timeout: config.timeoutMs,
  });
  for (const marker of CONSULTING_PRICE_MARKERS) {
    await assertVisibleText(page, marker, config.timeoutMs);
  }
  steps.push(
    buildStep("marketing_services_pricing", "Services pricing anchors", "pass", {
      markers: CONSULTING_PRICE_MARKERS,
    }),
  );
}

async function runAppJourney(page, steps, config) {
  if (config.hostSplitSkipped) {
    steps.push(
      buildStep("app_root_redirect", "App root redirects to /software", "skipped", {
        detail: "Skipped because marketing and app are using the same origin for this run.",
      }),
    );
  } else {
    await page.goto(config.appBaseUrl, {
      waitUntil: "networkidle",
      timeout: config.timeoutMs,
    });
    if (!page.url().endsWith("/software")) {
      steps.push(
        buildStep("app_root_redirect", "App root redirects to /software", "fail", {
          url: page.url(),
          screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-root-redirect-failure"),
          detail: `Expected app root to redirect to /software, got ${page.url()}.`,
        }),
      );
    } else {
      steps.push(
        buildStep("app_root_redirect", "App root redirects to /software", "pass", {
          url: page.url(),
          screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-software-home"),
        }),
      );
    }
  }

  for (const route of APP_ROUTE_EXPECTATIONS) {
    try {
      await gotoAndAssert(page, new URL(route.path, config.appBaseUrl).toString(), route.marker, config.timeoutMs);
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
      await page.goto(new URL(product.path, config.appBaseUrl).toString(), {
        waitUntil: "networkidle",
        timeout: config.timeoutMs,
      });
      await assertVisibleText(page, product.titleMarker, config.timeoutMs);
      const matchedMarker = await assertVisibleAny(page, product.publicMarkers, config.timeoutMs);
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
    waitUntil: "networkidle",
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
  await page.goto(new URL("/account", config.appBaseUrl).toString(), {
    waitUntil: "networkidle",
    timeout: config.timeoutMs,
  });

  if (page.url().includes("/login")) {
    throw new Error("Authenticated journey did not complete successfully.");
  }

  await assertVisibleText(page, "Welcome back", config.timeoutMs);
  await assertVisibleText(page, "Billing and Invoices", config.timeoutMs);

  steps.push(
    buildStep("app_auth_login", "Authenticated app journey", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-account"),
    }),
  );

  await page.goto(new URL("/account/billing", config.appBaseUrl).toString(), {
    waitUntil: "networkidle",
    timeout: config.timeoutMs,
  });
  await assertVisibleText(page, "Billing and Subscriptions", config.timeoutMs);
  steps.push(
    buildStep("app_billing", "Billing page", "pass", {
      url: page.url(),
    }),
  );

  for (const product of APP_PRODUCT_EXPECTATIONS) {
    await page.goto(new URL(product.path, config.appBaseUrl).toString(), {
      waitUntil: "networkidle",
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
  const outputDir =
    options.outputDir ??
    resolveOutputPath(readSetting("JOURNEY_OUTPUT_DIR", "output/playwright/customer-journey-audit"));
  const screenshotsDir = join(outputDir, "screenshots");
  const headed = readBoolean(readSetting("JOURNEY_HEADED", "false"));
  const browserChannel = readSetting("JOURNEY_BROWSER_CHANNEL", "chrome");
  const timeoutMs = readNumber(readSetting("JOURNEY_TIMEOUT_MS", "30000"), 30000);
  const loginEmail = readSetting("JOURNEY_EMAIL", "");
  const loginPassword = readSetting("JOURNEY_PASSWORD", "");
  const steps = [];
  const diagnostics = createBrowserDiagnostics();
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
    marketingHost: new URL(marketingBaseUrl).host,
    appHost: new URL(appBaseUrl).host,
    productionMarketingBlockAllowed: expectedProductionMarketingBlock(marketingBaseUrl, appBaseUrl),
  };

  ensureDir(outputDir);
  ensureDir(screenshotsDir);

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
