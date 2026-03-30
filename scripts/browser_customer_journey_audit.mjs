#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");

function parseEnvFile(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function loadJourneyEnv() {
  const configuredPath = process.env.JOURNEY_ENV_FILE ? resolve(process.cwd(), process.env.JOURNEY_ENV_FILE) : null;
  const candidates = [
    configuredPath,
    resolve(repoRoot, ".env.audit.local"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return parseEnvFile(candidate);
    }
  }

  return {};
}

const fileEnv = loadJourneyEnv();

function readSetting(name, fallback = "") {
  return process.env[name] ?? fileEnv[name] ?? fallback;
}

const baseUrl = readSetting("JOURNEY_BASE_URL", "https://app.zokorp.com");
const outputDir = readSetting("JOURNEY_OUTPUT_DIR", "output/playwright/customer-journey-audit");
const headed = readSetting("JOURNEY_HEADED") === "true";
const browserChannel = readSetting("JOURNEY_BROWSER_CHANNEL", "chrome");
const visibilityTimeoutMs = Number.parseInt(readSetting("JOURNEY_TIMEOUT_MS", "30000"), 10);
const loginEmail = readSetting("JOURNEY_EMAIL");
const loginPassword = readSetting("JOURNEY_PASSWORD");
const expectSubscription = readSetting("JOURNEY_EXPECT_SUBSCRIPTION") === "true";

const publicNavChecks = [
  {
    label: "Software",
    href: "/software",
    marker: "Three product surfaces, one account",
  },
  {
    label: "Services",
    href: "/services",
    marker: "Build with confidence, not guesswork",
  },
  {
    label: "Case Studies",
    href: "/case-studies",
    marker: "Representative delivery patterns",
  },
  {
    label: "Contact Us",
    href: "/contact",
    marker: "Start the right conversation",
  },
  {
    label: "About",
    href: "/about",
    marker: "ZoKorp is built for practical delivery work",
  },
];

const launchProducts = [
  {
    name: "Architecture Diagram Reviewer",
    href: "/software/architecture-diagram-reviewer",
    publicMarker: "Verified business-email account required",
    authenticatedMarker: "Architecture Description (required)",
  },
  {
    name: "ZoKorpValidator",
    href: "/software/zokorp-validator",
    publicMarker: "Sign in first",
    authenticatedMarker: "Run ZoKorpValidator",
  },
  {
    name: "ZoKorp MLOps Foundation Platform",
    href: "/software/mlops-foundation-platform",
    publicMarker: "Subscription required",
    authenticatedMarker: expectSubscription ? "Active subscription" : "Subscription required",
  },
];

const retiredProducts = [
  "AI Decider",
  "Landing Zone Readiness Checker",
  "Cloud Cost Leak Finder",
];

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
}

function sanitizeFileComponent(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function writeStepScreenshot(page, stepId) {
  const filePath = join(outputDir, `${sanitizeFileComponent(stepId)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function buildStep(id, label, status, details = {}) {
  return {
    id,
    label,
    status,
    ...details,
  };
}

function buildSummary(steps) {
  return {
    checkedAt: new Date().toISOString(),
    baseUrl,
    totals: {
      pass: steps.filter((step) => step.status === "pass").length,
      fail: steps.filter((step) => step.status === "fail").length,
      skipped: steps.filter((step) => step.status === "skipped").length,
    },
    steps,
    outcome: steps.some((step) => step.status === "fail") ? "fail" : "pass",
  };
}

async function assertVisibleText(page, text) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: visibilityTimeoutMs });
}

async function withRetry(label, fn, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(`${label} failed after ${attempts} attempt(s): ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function navigateAndAssert(page, href, marker) {
  await withRetry(`Navigate ${href}`, async () => {
    await page.goto(new URL(href, baseUrl).toString(), { waitUntil: "networkidle" });
    await assertVisibleText(page, marker);
  });
}

function headerNavLink(page, label) {
  return page.locator("header nav").first().getByRole("link", { name: label, exact: true });
}

async function runPublicJourney(page, steps) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await assertVisibleText(page, "Practical AI delivery software, AWS guidance, and billing in one customer platform.");
  steps.push(
    buildStep("home", "Home page renders", "pass", {
      url: page.url(),
      screenshot: await writeStepScreenshot(page, "home"),
    }),
  );

  for (const navItem of publicNavChecks) {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await headerNavLink(page, navItem.label).click();
    await page.waitForURL(new RegExp(`${navItem.href.replace("/", "\\/")}$`), { timeout: 20_000 });
    await assertVisibleText(page, navItem.marker);
    steps.push(
      buildStep(`nav_${sanitizeFileComponent(navItem.label)}`, `Header nav: ${navItem.label}`, "pass", {
        url: page.url(),
      }),
    );
  }

  await navigateAndAssert(page, "/software", "Three product surfaces, one account");
  for (const product of launchProducts) {
    await assertVisibleText(page, product.name);
  }
  for (const retiredProduct of retiredProducts) {
    const retiredVisible = await page.getByText(retiredProduct, { exact: false }).count();
    if (retiredVisible > 0) {
      throw new Error(`Retired product still visible in catalog: ${retiredProduct}`);
    }
  }
  steps.push(
    buildStep("software_catalog", "Software catalog shows only launch products", "pass", {
      url: page.url(),
      screenshot: await writeStepScreenshot(page, "software-catalog"),
    }),
  );

  for (const product of launchProducts) {
    await navigateAndAssert(page, product.href, product.publicMarker);
    steps.push(
      buildStep(`public_${sanitizeFileComponent(product.name)}`, `Public product page: ${product.name}`, "pass", {
        url: page.url(),
      }),
    );
  }
}

async function runAuthJourney(page, steps) {
  if (!loginEmail || !loginPassword) {
    steps.push(
      buildStep("auth_login", "Authenticated journey", "skipped", {
        reason: "Set JOURNEY_EMAIL and JOURNEY_PASSWORD to enable authenticated browser checks.",
      }),
    );
    return;
  }

  await withRetry("Authenticated login", async () => {
    await page.context().clearCookies();
    await navigateAndAssert(page, "/login", "Sign in");
    await page.locator("#email").fill(loginEmail);
    await page.locator("#password").fill(loginPassword);
    await page.locator("form").first().getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(new RegExp("\\/account$"), { timeout: visibilityTimeoutMs });
    await assertVisibleText(page, "Welcome back");
    await assertVisibleText(page, loginEmail);
  });

  steps.push(
    buildStep("auth_login", "Sign in with configured account", "pass", {
      url: page.url(),
      screenshot: await writeStepScreenshot(page, "account-home"),
    }),
  );

  await assertVisibleText(page, "Billing and Invoices");
  await assertVisibleText(page, "Formal Estimates");
  steps.push(
    buildStep("account_hub", "Account hub renders", "pass", {
      url: page.url(),
    }),
  );

  for (const product of launchProducts) {
    await navigateAndAssert(page, product.href, product.authenticatedMarker);
    steps.push(
      buildStep(`auth_${sanitizeFileComponent(product.name)}`, `Authenticated product page: ${product.name}`, "pass", {
        url: page.url(),
      }),
    );
  }
}

async function main() {
  ensureOutputDir();

  const steps = [];
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
  const page = await context.newPage();

  try {
    await runPublicJourney(page, steps);
    await runAuthJourney(page, steps);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const screenshot = await writeStepScreenshot(page, "failure");
    steps.push(
      buildStep("failure", "Browser journey audit failure", "fail", {
        error: message,
        url: page.url(),
        screenshot,
      }),
    );
  } finally {
    await context.close();
    await browser.close();
  }

  const summary = buildSummary(steps);
  writeFileSync(join(outputDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`Base URL: ${summary.baseUrl}`);
  console.log(`Checked at: ${summary.checkedAt}`);
  console.log("");
  for (const step of summary.steps) {
    const suffix = step.status === "skipped" && step.reason ? ` (${step.reason})` : "";
    console.log(`- ${step.status.toUpperCase()} ${step.label}${suffix}`);
  }
  console.log("");
  console.log("JSON summary:");
  console.log(JSON.stringify(summary, null, 2));

  process.exit(summary.outcome === "pass" ? 0 : 1);
}

main().catch((error) => {
  console.error("Browser customer journey audit crashed:", error instanceof Error ? error.message : error);
  process.exit(3);
});
