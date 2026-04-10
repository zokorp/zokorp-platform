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
  promptUser,
  readBoolean,
  readNumber,
  resolveExpectedCanonicalBaseUrl,
  resolveVercelProtectionBypassHeaders,
  resolveOutputPath,
  writeLocatorScreenshot,
  writeJsonFile,
  writePageScreenshot,
  writeTextFile,
} from "./playwright_audit_support.mjs";

const VALID_MUTATION_MODES = new Set(["readonly", "low-risk", "full"]);
const mobileViewport = { width: 390, height: 844 };

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

function defaultApexUrl(marketingBaseUrl) {
  try {
    return new URL(marketingBaseUrl).host === "www.zokorp.com" ? "https://zokorp.com" : "";
  } catch {
    return "";
  }
}

function currentTimestampTag() {
  return new Date().toISOString().replaceAll(/[:.]/g, "-");
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
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
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

async function writeStableSectionScreenshot(locator, screenshotsDir, stepId) {
  await locator.scrollIntoViewIfNeeded();
  return writeLocatorScreenshot(locator, screenshotsDir, stepId);
}

function buildMarkdownSummary(summary) {
  const lines = [
    "# ZoKorp full GUI walkthrough",
    "",
    `- Checked at: ${summary.checkedAt}`,
    `- Marketing base URL: ${summary.baseUrls.marketing}`,
    `- App base URL: ${summary.baseUrls.app}`,
    `- Mutation mode: ${summary.mutationMode}`,
    `- Outcome: ${summary.outcome.toUpperCase()}`,
    "",
    "## Steps",
  ];

  for (const step of summary.steps) {
    const detail = step.detail ? ` - ${step.detail}` : "";
    lines.push(`- [${step.status.toUpperCase()}] ${step.label}${detail}`);
  }

  if (summary.syntheticLead) {
    lines.push("");
    lines.push("## Synthetic lead");
    lines.push(`- Email: ${summary.syntheticLead.email}`);
    lines.push(`- Company: ${summary.syntheticLead.company}`);
    lines.push(`- Tracking code: ${summary.syntheticLead.trackingCode ?? "not captured"}`);
  }

  lines.push("");
  lines.push("## Artifacts");
  lines.push(`- Trace: ${summary.artifacts.tracePath}`);
  lines.push(`- Console log: ${summary.artifacts.consolePath}`);
  lines.push(`- Network log: ${summary.artifacts.networkPath}`);
  lines.push(`- Summary JSON: ${summary.artifacts.summaryPath}`);
  lines.push(`- Screenshots: ${summary.artifacts.screenshotsDir}`);

  return `${lines.join("\n")}\n`;
}

async function runMarketingDesktop(page, steps, config) {
  if (config.marketingBlocked) {
    for (const route of MARKETING_ROUTE_EXPECTATIONS) {
      steps.push(
        buildStep(
          `marketing_desktop_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
          `Marketing desktop: ${route.label}`,
          "blocked",
          { detail: "Skipped because the marketing host still resolves to the app host." },
        ),
      );
    }
    return;
  }

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(new URL("/", config.marketingBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  await assertVisibleText(page, MARKETING_ROUTE_EXPECTATIONS[0].marker, config.timeoutMs);
  const homeLandmarks = await assertLandmarkBaseline(page, config.timeoutMs);
  const homeHeroSection = page.locator("section").first();
  const homeHeroScreenshot = await writeStableSectionScreenshot(
    homeHeroSection,
    config.screenshotsDir,
    "marketing-home-hero",
  );

  steps.push(
    buildStep("marketing_desktop_home", "Marketing desktop: Homepage", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "marketing-desktop-home"),
      heroScreenshot: homeHeroScreenshot,
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
  const moreToggle = header.getByRole("button", { name: "More", exact: true });
  await moreToggle.click();
  for (const label of MARKETING_MORE_MENU_LABELS) {
    await page.getByLabel("More pages").getByRole("link", { name: label, exact: true }).waitFor({
      state: "visible",
      timeout: config.timeoutMs,
    });
  }
  await moreToggle.click();

  const main = page.getByRole("main");
  const bookingHref = await main
    .getByRole("link", { name: "Book a call", exact: true })
    .first()
    .getAttribute("href");
  const quoteHref = await main
    .getByRole("link", { name: "Get a quote", exact: true })
    .first()
    .getAttribute("href");
  const softwareHref = await main
    .getByRole("link", { name: "Explore software", exact: true })
    .first()
    .getAttribute("href");
  if (!bookingHref || !bookingHref.includes("utm_source=zokorp")) {
    throw new Error("Homepage Book a call CTA is missing expected UTM parameters.");
  }
  if (!quoteHref || !quoteHref.includes("/services#service-request")) {
    throw new Error("Homepage Get a quote CTA is not pointing at /services#service-request.");
  }
  if (!softwareHref || !softwareHref.includes("/software")) {
    throw new Error("Homepage Explore software CTA is not pointing at /software.");
  }

  steps.push(
    buildStep("marketing_desktop_navigation", "Marketing desktop: Navigation and CTAs", "pass", {
      bookingHref,
      quoteHref,
      softwareHref,
    }),
  );

  for (const route of MARKETING_ROUTE_EXPECTATIONS.slice(1)) {
    await gotoAndAssert(page, new URL(route.path, config.marketingBaseUrl).toString(), route.marker, config.timeoutMs);
    steps.push(
      buildStep(
        `marketing_desktop_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`,
        `Marketing desktop: ${route.label}`,
        "pass",
        {
          url: page.url(),
          screenshot: await writePageScreenshot(
            page,
            config.screenshotsDir,
            `marketing-desktop-${route.label}`,
          ),
          landmarks: await collectLandmarkSnapshot(page),
        },
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
  await assertVisibleText(page, "Request consultation or delivery", config.timeoutMs);
  const servicesLandmarks = await assertLandmarkBaseline(page, config.timeoutMs);
  const serviceRequestScreenshot = await writeStableSectionScreenshot(
    page.locator("section#service-request"),
    config.screenshotsDir,
    "marketing-services-service-request",
  );
  steps.push(
    buildStep("marketing_desktop_services_detail", "Marketing desktop: Services pricing and request hub", "pass", {
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "marketing-desktop-services-detail"),
      serviceRequestScreenshot,
      landmarks: servicesLandmarks,
    }),
  );

  await page.goto(new URL("/", config.marketingBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
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
    buildStep("marketing_desktop_footer", "Marketing desktop: Footer trust links", "pass", {
      labels: FOOTER_LEGAL_LINK_LABELS,
    }),
  );
}

async function runMarketingMobile(page, steps, config) {
  if (config.marketingBlocked) {
    steps.push(
      buildStep("marketing_mobile", "Marketing mobile walkthrough", "blocked", {
        detail: "Skipped because the marketing host still resolves to the app host.",
      }),
    );
    return;
  }

  await page.setViewportSize(mobileViewport);
  await page.goto(new URL("/", config.marketingBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  await assertVisibleText(page, MARKETING_ROUTE_EXPECTATIONS[0].marker, config.timeoutMs);
  const header = page.getByRole("banner");
  const mobileMenuToggle = header.getByRole("button", { name: "Menu", exact: true });
  await mobileMenuToggle.click();
  const mobileNav = page.getByLabel("Mobile navigation");
  await mobileNav.waitFor({
    state: "visible",
    timeout: config.timeoutMs,
  });
  await mobileNav.getByRole("link", { name: "Services", exact: true }).waitFor({
    state: "visible",
    timeout: config.timeoutMs,
  });
  await mobileNav.getByRole("link", { name: "Create account", exact: true }).waitFor({
    state: "visible",
    timeout: config.timeoutMs,
  });
  steps.push(
    buildStep("marketing_mobile", "Marketing mobile walkthrough", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "marketing-mobile-home"),
      landmarks: await collectLandmarkSnapshot(page),
    }),
  );
  await mobileMenuToggle.click();
  await page.setViewportSize({ width: 1440, height: 960 });
}

async function runAppUnauthenticated(page, steps, config) {
  await page.context().clearCookies();

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
        buildStep(`app_route_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`, `App route: ${route.label}`, "pass", {
          url: page.url(),
          screenshot: await writePageScreenshot(
            page,
            config.screenshotsDir,
            `app-route-${route.label}`,
          ),
        }),
      );
    } catch (error) {
      steps.push(
        buildStep(`app_route_${route.label.toLowerCase().replaceAll(/\s+/g, "_")}`, `App route: ${route.label}`, "fail", {
          url: page.url(),
          screenshot: await writePageScreenshot(
            page,
            config.screenshotsDir,
            `app-route-${route.label}-failure`,
          ),
          detail: errorDetail(error),
        }),
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
        buildStep(`app_public_${product.slug}`, `App public product: ${product.label}`, "pass", {
          url: page.url(),
          matchedMarker,
          screenshot: await writePageScreenshot(
            page,
            config.screenshotsDir,
            `app-public-${product.slug}`,
          ),
        }),
      );
    } catch (error) {
      steps.push(
        buildStep(`app_public_${product.slug}`, `App public product: ${product.label}`, "fail", {
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

async function ensureAppAuthentication(page, steps, config) {
  await page.goto(new URL("/login", config.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });

  if (config.loginEmail && config.loginPassword) {
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
  } else {
    await promptUser(
      "Sign in to the ZoKorp app in the opened browser window, then press Enter here to continue the walkthrough.",
    );
  }

  const accountResponse = await page.goto(new URL("/account", config.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });

  if (page.url().includes("/login")) {
    steps.push(
      buildStep("app_auth_login", "App authentication handoff", "blocked", {
        detail: "Configured JOURNEY_EMAIL/JOURNEY_PASSWORD did not establish a local authenticated session.",
        url: page.url(),
      }),
    );
    return false;
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
  await page.context().storageState({ path: config.appAuthStatePath });

  steps.push(
    buildStep("app_auth_login", "App authentication handoff", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-account-home"),
      authStatePath: config.appAuthStatePath,
    }),
  );

  return true;
}

async function runAppAuthenticated(page, steps, config) {
  if (!config.loginEmail || !config.loginPassword) {
    steps.push(
      buildStep("app_auth_login", "App authentication handoff", "skipped", {
        detail: "Skipped because JOURNEY_EMAIL and JOURNEY_PASSWORD are not configured.",
      }),
    );
    steps.push(
      buildStep("app_billing", "Billing page", "skipped", {
        detail: "Skipped because authenticated browser credentials are not configured.",
      }),
    );

    for (const product of APP_PRODUCT_EXPECTATIONS) {
      steps.push(
        buildStep(`app_auth_${product.slug}`, `Authenticated product: ${product.label}`, "skipped", {
          detail: "Skipped because authenticated browser credentials are not configured.",
        }),
      );
    }
    return;
  }

  const authenticated = await ensureAppAuthentication(page, steps, config);
  if (!authenticated) {
    steps.push(
      buildStep("app_billing", "Billing page", "blocked", {
        detail: "Blocked because the configured authenticated session could not be established.",
      }),
    );
    for (const product of APP_PRODUCT_EXPECTATIONS) {
      steps.push(
        buildStep(`app_auth_${product.slug}`, `Authenticated product: ${product.label}`, "blocked", {
          detail: "Blocked because the configured authenticated session could not be established.",
        }),
      );
    }
    return;
  }

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
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "app-billing"),
      stripePortalButtonVisible: await page
        .getByRole("button", { name: "Open Stripe Billing Portal", exact: true })
        .isVisible(),
    }),
  );

  for (const product of APP_PRODUCT_EXPECTATIONS) {
    await page.goto(new URL(product.path, config.appBaseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });
    const matchedMarker = await assertVisibleAny(page, product.authenticatedMarkers, config.timeoutMs);
    steps.push(
      buildStep(`app_auth_${product.slug}`, `Authenticated product: ${product.label}`, "pass", {
        url: page.url(),
        matchedMarker,
        screenshot: await writePageScreenshot(
          page,
          config.screenshotsDir,
          `app-auth-${product.slug}`,
        ),
      }),
    );
  }
}

async function runSyntheticServiceRequest(page, steps, config) {
  if (config.mutationMode === "readonly") {
    steps.push(
      buildStep("service_request", "Synthetic service request", "skipped", {
        detail: "Skipped because JOURNEY_MUTATION_MODE is readonly.",
      }),
    );
    return null;
  }

  const requestBaseUrl = config.marketingBlocked ? config.appBaseUrl : config.marketingBaseUrl;
  const syntheticLead = {
    email: config.serviceRequestEmail,
    name: config.serviceRequestName,
    company: config.serviceRequestCompany,
  };

  await page.context().clearCookies();
  try {
    await page.goto(new URL("/services#service-request", requestBaseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: config.timeoutMs,
    });
    await assertVisibleText(page, "Request consultation or delivery", config.timeoutMs);

    await page.getByLabel("Request type").selectOption("CONSULTATION");
    await page.getByLabel("Preferred start date").fill(config.syntheticStartDate);
    await page.getByLabel("Work email").fill(syntheticLead.email);
    await page.getByLabel("Your name").fill(syntheticLead.name);
    await page.getByLabel("Company").fill(syntheticLead.company);
    await page
      .getByLabel("Request title")
      .fill(`Codex GUI walkthrough synthetic request ${config.syntheticRunTag}`);
    await page.getByLabel("What do you need?").fill(
      "Synthetic low-risk browser walkthrough request for ZoKorp. Please ignore for production sales follow-up. This is only validating the public service request flow and Zoho lead verification path.",
    );
    await page.getByLabel("Budget range").selectOption("Undecided");
    await page.getByRole("button", { name: "Submit service request", exact: true }).click();

    await assertVisibleText(page, "Request recorded", config.timeoutMs);
    const requestText = await page.locator("section#service-request").textContent();
    const trackingCodeMatch = requestText?.match(/Tracking code:\s*([A-Z0-9-]+)/i) ?? null;
    const trackingCode = trackingCodeMatch?.[1] ?? null;

    steps.push(
      buildStep("service_request", "Synthetic service request", "pass", {
        url: page.url(),
        trackingCode,
        email: syntheticLead.email,
        screenshot: await writePageScreenshot(page, config.screenshotsDir, "service-request-success"),
      }),
    );

    return {
      ...syntheticLead,
      trackingCode,
    };
  } catch (error) {
    steps.push(
      buildStep("service_request", "Synthetic service request", "blocked", {
        url: page.url(),
        screenshot: await writePageScreenshot(page, config.screenshotsDir, "service-request-blocked"),
        detail: `Public service request flow does not match the current walkthrough contract on this host. ${errorDetail(error)}`,
      }),
    );
    return null;
  }
}

async function runOptionalSignup(page, steps, config) {
  if (config.mutationMode === "readonly") {
    steps.push(
      buildStep("signup_flow", "Optional synthetic signup", "skipped", {
        detail: "Skipped because JOURNEY_MUTATION_MODE is readonly.",
      }),
    );
    return;
  }

  if (!config.signupEmail || !config.signupPassword) {
    steps.push(
      buildStep("signup_flow", "Optional synthetic signup", "skipped", {
        detail: "Skipped because JOURNEY_SIGNUP_EMAIL and JOURNEY_SIGNUP_PASSWORD are not configured.",
      }),
    );
    return;
  }

  await page.context().clearCookies();
  await page.goto(new URL("/register", config.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  await page.getByLabel("Name").fill(config.signupName);
  await page.getByLabel("Business email").fill(config.signupEmail);
  await page.getByLabel("Password").fill(config.signupPassword);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await assertVisibleAny(
    page,
    [
      "Account created. Verify your email before signing in.",
      "Verification email sent to",
    ],
    config.timeoutMs,
  );

  steps.push(
    buildStep("signup_flow", "Optional synthetic signup", "pass", {
      url: page.url(),
      screenshot: await writePageScreenshot(page, config.screenshotsDir, "signup-success"),
      email: config.signupEmail,
    }),
  );
}

async function locateZohoLead(page, syntheticLead, config) {
  const searchCandidates = [
    page.getByPlaceholder(/Search/i).first(),
    page.getByRole("textbox", { name: /Search/i }).first(),
    page.locator('input[placeholder*="Search"]').first(),
  ];

  for (const candidate of searchCandidates) {
    try {
      await candidate.waitFor({ state: "visible", timeout: 8000 });
      await candidate.fill(syntheticLead.email);
      await candidate.press("Enter");
      await page.getByText(syntheticLead.email, { exact: false }).first().waitFor({
        state: "visible",
        timeout: config.timeoutMs,
      });
      return true;
    } catch {
      // Try the next selector.
    }
  }

  return false;
}

async function runZohoVerification(context, steps, config, syntheticLead) {
  if (config.skipZoho) {
    steps.push(
      buildStep("zoho_verification", "Zoho CRM lead verification", "skipped", {
        detail: "Skipped because JOURNEY_SKIP_ZOHO is enabled for this run.",
      }),
    );
    return;
  }

  if (!syntheticLead) {
    steps.push(
      buildStep("zoho_verification", "Zoho CRM lead verification", "skipped", {
        detail: "Skipped because no synthetic service request was submitted.",
      }),
    );
    return;
  }

  const zohoPage = await context.newPage();
  await zohoPage.goto(config.zohoLoginUrl, {
    waitUntil: "load",
    timeout: config.timeoutMs,
  });
  await promptUser(
    "Log into Zoho CRM in the opened browser window. When you reach the CRM app, press Enter here so the walkthrough can continue.",
  );

  try {
    await zohoPage.getByRole("link", { name: /^Leads$/ }).first().click({ timeout: 10000 });
  } catch {
    await promptUser("Open the Zoho CRM Leads module manually, then press Enter here to continue.");
  }

  const foundByAutomation = await locateZohoLead(zohoPage, syntheticLead, config);
  if (!foundByAutomation) {
    await promptUser(
      `Zoho search did not resolve automatically. Search Zoho CRM for ${syntheticLead.email}, open the lead record or search result, and press Enter here when it is visible.`,
    );
  }

  const markersVisible = [];
  for (const marker of [syntheticLead.email, syntheticLead.company]) {
    try {
      await zohoPage.getByText(marker, { exact: false }).first().waitFor({
        state: "visible",
        timeout: 12000,
      });
      markersVisible.push(marker);
    } catch {
      // Best-effort GUI verification.
    }
  }

  if (markersVisible.length === 0) {
    steps.push(
      buildStep("zoho_verification", "Zoho CRM lead verification", "blocked", {
        detail: `Lead data for ${syntheticLead.email} was not visible in Zoho CRM during this run.`,
        screenshot: await writePageScreenshot(zohoPage, config.screenshotsDir, "zoho-lead-not-found"),
      }),
    );
    return;
  }

  await context.storageState({ path: config.zohoAuthStatePath });
  steps.push(
    buildStep("zoho_verification", "Zoho CRM lead verification", "pass", {
      markersVisible,
      screenshot: await writePageScreenshot(zohoPage, config.screenshotsDir, "zoho-lead-verification"),
      authStatePath: config.zohoAuthStatePath,
    }),
  );
}

export async function runFullGuiWalkthrough(options = {}) {
  const args = parseArgs(process.argv.slice(2));
  const envFile = loadAuditEnv(args["journey-env-file"] ?? process.env.JOURNEY_ENV_FILE);
  const readSetting = createSettingsReader({ args, envFile });
  const fallbackBaseUrl = args.JOURNEY_BASE_URL ?? process.env.JOURNEY_BASE_URL ?? "";
  const marketingBaseUrl =
    options.marketingBaseUrl ??
    readSetting(["JOURNEY_MARKETING_BASE_URL"], fallbackBaseUrl || "https://www.zokorp.com");
  const appBaseUrl =
    options.appBaseUrl ??
    readSetting(["JOURNEY_APP_BASE_URL"], fallbackBaseUrl || "https://app.zokorp.com");
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
  const apexBaseUrl =
    options.apexBaseUrl ??
    readSetting(["JOURNEY_APEX_BASE_URL"], defaultApexUrl(marketingBaseUrl));
  const outputDir =
    options.outputDir ??
    resolveOutputPath(readSetting("JOURNEY_OUTPUT_DIR", "output/playwright/full-gui-walkthrough"));
  const screenshotsDir = join(outputDir, "screenshots");
  const authDir = resolveOutputPath(readSetting("JOURNEY_AUTH_DIR", "output/playwright/.auth"));
  const profileDir = resolveOutputPath(
    readSetting("JOURNEY_PROFILE_DIR", "output/playwright/.profiles/full-gui-walkthrough"),
  );
  const headed = readBoolean(readSetting("JOURNEY_HEADED", "true"), true);
  const browserChannel = readSetting("JOURNEY_BROWSER_CHANNEL", "chrome");
  const timeoutMs = readNumber(readSetting("JOURNEY_TIMEOUT_MS", "30000"), 30000);
  const mutationMode = readSetting("JOURNEY_MUTATION_MODE", "readonly");
  const keepBrowserOpen = readBoolean(readSetting("JOURNEY_KEEP_BROWSER_OPEN", "false"), false);
  const skipZoho = readBoolean(readSetting("JOURNEY_SKIP_ZOHO", "false"), false);
  const protectionBypassHeaders = resolveVercelProtectionBypassHeaders(readSetting, {
    setCookie: true,
  });

  if (!VALID_MUTATION_MODES.has(mutationMode)) {
    throw new Error(`Unsupported JOURNEY_MUTATION_MODE: ${mutationMode}`);
  }

  const syntheticRunTag = currentTimestampTag();
  const config = {
    marketingBaseUrl,
    appBaseUrl,
    apexBaseUrl,
    outputDir,
    screenshotsDir,
    authDir,
    profileDir,
    headed,
    browserChannel,
    timeoutMs,
    mutationMode,
    keepBrowserOpen,
    skipZoho,
    hostSplitSkipped: sameOrigin(marketingBaseUrl, appBaseUrl),
    expectedMarketingCanonicalBaseUrl,
    expectedAppCanonicalBaseUrl,
    loginEmail: readSetting("JOURNEY_EMAIL", ""),
    loginPassword: readSetting("JOURNEY_PASSWORD", ""),
    signupEmail: readSetting("JOURNEY_SIGNUP_EMAIL", ""),
    signupPassword: readSetting("JOURNEY_SIGNUP_PASSWORD", ""),
    signupName: readSetting("JOURNEY_SIGNUP_NAME", `ZoKorp GUI Test ${syntheticRunTag}`),
    serviceRequestEmail: readSetting(
      "JOURNEY_SERVICE_REQUEST_EMAIL",
      `codex-gui-${Date.now()}@example.com`,
    ).toLowerCase(),
    serviceRequestName: readSetting("JOURNEY_SERVICE_REQUEST_NAME", "Codex GUI Walkthrough"),
    serviceRequestCompany: readSetting(
      "JOURNEY_SERVICE_REQUEST_COMPANY",
      `ZoKorp GUI Test ${syntheticRunTag}`,
    ),
    syntheticStartDate: readSetting("JOURNEY_SERVICE_REQUEST_START_DATE", "2026-04-30"),
    syntheticRunTag,
    zohoLoginUrl: readSetting("JOURNEY_ZOHO_LOGIN_URL", "https://www.zoho.com/crm/login.html"),
    appAuthStatePath: join(authDir, "full-gui-walkthrough-app.json"),
    zohoAuthStatePath: join(authDir, "full-gui-walkthrough-zoho.json"),
  };

  ensureDir(outputDir);
  ensureDir(screenshotsDir);
  ensureDir(authDir);
  ensureDir(profileDir);

  const preflight = await runProductionSmokeCheck({
    marketingBaseUrl,
    appBaseUrl,
    apexBaseUrl,
    timeoutMs,
  });
  const steps = preflight.steps.map((step) => ({
    ...step,
    phase: "preflight",
  }));
  const marketingBlocked = preflight.steps.some(
    (step) => step.id === "marketing_homepage" && step.status === "blocked",
  );

  const diagnostics = createBrowserDiagnostics();
  let browserContext;
  let tracePath = join(outputDir, "trace.zip");
  let syntheticLead = null;

  try {
    try {
      browserContext = await chromium.launchPersistentContext(profileDir, {
        channel: browserChannel,
        extraHTTPHeaders: protectionBypassHeaders,
        headless: !headed,
        viewport: { width: 1440, height: 960 },
      });
    } catch (error) {
      if (browserChannel !== "chrome") {
        throw error;
      }

      browserContext = await chromium.launchPersistentContext(profileDir, {
        extraHTTPHeaders: protectionBypassHeaders,
        headless: !headed,
        viewport: { width: 1440, height: 960 },
      });
    }

    attachContextDiagnostics(browserContext, diagnostics);
    await browserContext.tracing.start({
      screenshots: true,
      snapshots: true,
    });

    const page = browserContext.pages()[0] ?? (await browserContext.newPage());
    await browserContext.clearCookies();

    const runtimeConfig = {
      ...config,
      marketingBlocked,
    };

    await runMarketingDesktop(page, steps, runtimeConfig);
    await runMarketingMobile(page, steps, runtimeConfig);
    await runAppUnauthenticated(page, steps, runtimeConfig);
    syntheticLead = await runSyntheticServiceRequest(page, steps, runtimeConfig);
    await runOptionalSignup(page, steps, runtimeConfig);
    await runAppAuthenticated(page, steps, runtimeConfig);
    await runZohoVerification(browserContext, steps, runtimeConfig, syntheticLead);
  } catch (error) {
    const page = browserContext?.pages()[0] ?? null;
    steps.push(
      buildStep("full_gui_failure", "Full GUI walkthrough", "fail", {
        detail: error instanceof Error ? error.message : String(error),
        screenshot:
          page ? await writePageScreenshot(page, screenshotsDir, "full-gui-failure") : null,
      }),
    );
  } finally {
    if (browserContext) {
      try {
        await browserContext.tracing.stop({ path: tracePath });
      } catch {
        tracePath = "";
      }
    }
  }

  const diagnosticPaths = persistDiagnostics(outputDir, diagnostics);
  const summary = {
    checkedAt: new Date().toISOString(),
    mutationMode,
    baseUrls: {
      apex: apexBaseUrl || null,
      marketing: marketingBaseUrl,
      app: appBaseUrl,
    },
    totals: buildTotals(steps),
    preflight,
    diagnostics: {
      consoleMessages: diagnostics.consoleMessages.length,
      pageErrors: diagnostics.pageErrors.length,
      requestFailures: diagnostics.requestFailures.length,
      ignoredRequestFailures: diagnostics.ignoredRequestFailures.length,
      responseFailures: diagnostics.responseFailures.length,
    },
    syntheticLead,
    steps,
    artifacts: {
      screenshotsDir,
      tracePath,
      consolePath: diagnosticPaths.consolePath,
      networkPath: diagnosticPaths.networkPath,
      summaryPath: join(outputDir, "summary.json"),
      markdownPath: join(outputDir, "summary.md"),
      appAuthStatePath: config.appAuthStatePath,
      zohoAuthStatePath: config.zohoAuthStatePath,
    },
    outcome: outcomeFromSteps(steps),
  };

  writeJsonFile(summary.artifacts.summaryPath, summary);
  writeTextFile(summary.artifacts.markdownPath, buildMarkdownSummary(summary));

  if (browserContext) {
    if (config.keepBrowserOpen) {
      await promptUser(
        "The Playwright browser is still open for inspection. Press Enter here when you want me to close it and finish the walkthrough.",
      );
    }

    await browserContext.close();
  }

  return summary;
}

async function main() {
  const summary = await runFullGuiWalkthrough();

  console.log(`Marketing base URL: ${summary.baseUrls.marketing}`);
  console.log(`App base URL: ${summary.baseUrls.app}`);
  console.log(`Mutation mode: ${summary.mutationMode}`);
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
      "Full GUI walkthrough crashed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(3);
  });
}
