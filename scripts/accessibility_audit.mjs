#!/usr/bin/env node

import { join } from "node:path";
import { pathToFileURL } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import {
  APP_ROOT_EXPECTATION,
  APP_ROUTE_EXPECTATIONS,
  MARKETING_ROUTE_EXPECTATIONS,
} from "./playwright_audit_contract.mjs";
import { runProductionSmokeCheck } from "./production_smoke_check.mjs";
import {
  attachContextDiagnostics,
  buildStep,
  buildTotals,
  createBrowserDiagnostics,
  createSettingsReader,
  ensureDir,
  loadAuditEnv,
  outcomeFromSteps,
  parseArgs,
  persistDiagnostics,
  readBoolean,
  readNumber,
  resolveVercelProtectionBypassHeaders,
  resolveOutputPath,
  writeJsonFile,
  writePageScreenshot,
  writeTextFile,
} from "./playwright_audit_support.mjs";

const desktopViewport = { width: 1440, height: 960 };
const mobileViewport = { width: 390, height: 844 };
const axeTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

function routeIdFragment(path) {
  if (path === "/") {
    return "home";
  }

  return path.replaceAll("/", "_").replace(/^_+/, "").replaceAll(/[^a-z0-9_]+/gi, "_");
}

async function assertVisibleText(page, text, timeoutMs) {
  await page.getByText(text, { exact: false }).first().waitFor({
    state: "visible",
    timeout: timeoutMs,
  });
}

function buildMarkdownSummary(summary) {
  const lines = [
    "# ZoKorp accessibility audit",
    "",
    `- Checked at: ${summary.checkedAt}`,
    `- Marketing base URL: ${summary.baseUrls.marketing}`,
    `- App base URL: ${summary.baseUrls.app}`,
    `- Outcome: ${summary.outcome.toUpperCase()}`,
    "",
    "## Steps",
  ];

  for (const step of summary.steps) {
    const detail = step.detail ? ` - ${step.detail}` : "";
    lines.push(`- [${step.status.toUpperCase()}] ${step.label}${detail}`);
  }

  lines.push("");
  lines.push("## Artifacts");
  lines.push(`- Trace: ${summary.artifacts.tracePath}`);
  lines.push(`- Console log: ${summary.artifacts.consolePath}`);
  lines.push(`- Network log: ${summary.artifacts.networkPath}`);
  lines.push(`- Violations JSON: ${summary.artifacts.violationsPath}`);
  lines.push(`- Screenshots: ${summary.artifacts.screenshotsDir}`);

  return `${lines.join("\n")}\n`;
}

async function runA11yCheck(page, steps, violations, config, item) {
  await page.setViewportSize(item.viewport);
  await page.goto(new URL(item.path, item.baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  await page.waitForLoadState("networkidle", { timeout: config.timeoutMs });
  await assertVisibleText(page, item.marker, config.timeoutMs);

  const result = await new AxeBuilder({ page }).withTags(axeTags).analyze();
  const screenshot = await writePageScreenshot(page, config.screenshotsDir, item.id);
  const violationSummary = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact ?? "unknown",
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      html: node.html,
      failureSummary: node.failureSummary,
    })),
  }));

  violations[item.id] = violationSummary;
  steps.push(
    buildStep(item.id, item.label, violationSummary.length === 0 ? "pass" : "fail", {
      url: page.url(),
      screenshot,
      violations: violationSummary.length,
      detail:
        violationSummary.length === 0
          ? undefined
          : violationSummary.map((entry) => `${entry.id}${entry.impact ? `:${entry.impact}` : ""}`).join(", "),
    }),
  );
}

async function loginIfConfigured(page, config) {
  if (!config.loginEmail || !config.loginPassword) {
    return false;
  }

  await page.goto(new URL("/login", config.appBaseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: config.timeoutMs,
  });
  await page.locator("#email").fill(config.loginEmail);
  await page.locator("#password").fill(config.loginPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  try {
    await page.waitForURL(/\/(account|software)(\/|$)|\/login\?error=/, { timeout: config.timeoutMs });
  } catch {
    return false;
  }

  return !page.url().includes("/login");
}

export async function runAccessibilityAudit(options = {}) {
  const args = parseArgs(process.argv.slice(2));
  const envFile = loadAuditEnv(args["journey-env-file"] ?? process.env.JOURNEY_ENV_FILE);
  const readSetting = createSettingsReader({ args, envFile });
  const marketingBaseUrl =
    options.marketingBaseUrl ?? readSetting(["JOURNEY_MARKETING_BASE_URL"], "https://www.zokorp.com");
  const appBaseUrl =
    options.appBaseUrl ?? readSetting(["JOURNEY_APP_BASE_URL"], "https://app.zokorp.com");
  const outputDir =
    options.outputDir ?? resolveOutputPath(readSetting("JOURNEY_A11Y_OUTPUT_DIR", "output/playwright/accessibility-audit"));
  const screenshotsDir = join(outputDir, "screenshots");
  const headed = readBoolean(readSetting("JOURNEY_HEADED", "false"));
  const browserChannel = readSetting("JOURNEY_BROWSER_CHANNEL", "chrome");
  const timeoutMs = readNumber(readSetting("JOURNEY_TIMEOUT_MS", "30000"), 30000);
  const loginEmail = readSetting("JOURNEY_EMAIL", "");
  const loginPassword = readSetting("JOURNEY_PASSWORD", "");
  const protectionBypassHeaders = resolveVercelProtectionBypassHeaders(readSetting, {
    setCookie: true,
  });

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

  const diagnostics = createBrowserDiagnostics();
  const violations = {};
  let browser;
  let context;
  let tracePath = join(outputDir, "trace.zip");

  try {
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

    context = await browser.newContext({
      extraHTTPHeaders: protectionBypassHeaders,
      viewport: desktopViewport,
      reducedMotion: "reduce",
    });
    attachContextDiagnostics(context, diagnostics);
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
    });

    const page = await context.newPage();
    const marketingDesktopMatrix = MARKETING_ROUTE_EXPECTATIONS.map((route) => ({
      id: `a11y_marketing_${routeIdFragment(route.path)}_desktop`,
      label: `Accessibility: ${route.label} desktop`,
      baseUrl: marketingBaseUrl,
      path: route.path,
      marker: route.marker,
      viewport: desktopViewport,
    }));
    const marketingMobileMatrix = MARKETING_ROUTE_EXPECTATIONS.filter((route) =>
      ["/", "/services", "/about", "/contact", "/pricing", "/software"].includes(route.path),
    ).map((route) => ({
      id: `a11y_marketing_${routeIdFragment(route.path)}_mobile`,
      label: `Accessibility: ${route.label} mobile`,
      baseUrl: marketingBaseUrl,
      path: route.path,
      marker: route.marker,
      viewport: mobileViewport,
    }));
    const appMatrix = [
      !sameOrigin(marketingBaseUrl, appBaseUrl)
        ? {
            id: "a11y_app_root_desktop",
            label: "Accessibility: app landing desktop",
            baseUrl: appBaseUrl,
            path: APP_ROOT_EXPECTATION.path,
            marker: APP_ROOT_EXPECTATION.marker,
            viewport: desktopViewport,
          }
        : null,
      {
        id: "a11y_app_software_mobile",
        label: "Accessibility: app software mobile",
        baseUrl: appBaseUrl,
        path: "/software",
        marker: APP_ROUTE_EXPECTATIONS.find((route) => route.path === "/software")?.marker ?? "Software",
        viewport: mobileViewport,
      },
      {
        id: "a11y_app_login_desktop",
        label: "Accessibility: login desktop",
        baseUrl: appBaseUrl,
        path: "/login",
        marker: APP_ROUTE_EXPECTATIONS.find((route) => route.path === "/login")?.marker ?? "Sign in",
        viewport: desktopViewport,
      },
    ].filter(Boolean);
    const matrix = [...marketingDesktopMatrix, ...marketingMobileMatrix, ...appMatrix];

    for (const item of matrix) {
      await runA11yCheck(page, steps, violations, { timeoutMs, screenshotsDir }, item);
    }

    if (await loginIfConfigured(page, { appBaseUrl, timeoutMs, loginEmail, loginPassword })) {
      await runA11yCheck(page, steps, violations, { timeoutMs, screenshotsDir }, {
        id: "a11y_app_account_desktop",
        label: "Accessibility: account desktop",
        baseUrl: appBaseUrl,
        path: "/account",
        marker: "Welcome back",
        viewport: desktopViewport,
      });
      await runA11yCheck(page, steps, violations, { timeoutMs, screenshotsDir }, {
        id: "a11y_app_billing_desktop",
        label: "Accessibility: billing desktop",
        baseUrl: appBaseUrl,
        path: "/account/billing",
        marker: "Billing and Subscriptions",
        viewport: desktopViewport,
      });
    } else {
      steps.push(
        buildStep("a11y_app_account_desktop", "Accessibility: account desktop", "skipped", {
          detail: "Skipped because JOURNEY_EMAIL and JOURNEY_PASSWORD are not configured.",
        }),
      );
      steps.push(
        buildStep("a11y_app_billing_desktop", "Accessibility: billing desktop", "skipped", {
          detail: "Skipped because JOURNEY_EMAIL and JOURNEY_PASSWORD are not configured.",
        }),
      );
    }
  } finally {
    if (context) {
      try {
        await context.tracing.stop({ path: tracePath });
      } catch {
        tracePath = "";
      }
      await context.close();
    }

    if (browser) {
      await browser.close();
    }
  }

  const diagnosticPaths = persistDiagnostics(outputDir, diagnostics);
  const violationsPath = join(outputDir, "violations.json");
  writeJsonFile(violationsPath, violations);

  const summary = {
    checkedAt: new Date().toISOString(),
    baseUrls: {
      marketing: marketingBaseUrl,
      app: appBaseUrl,
    },
    preflight,
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
    artifacts: {
      tracePath,
      consolePath: diagnosticPaths.consolePath,
      networkPath: diagnosticPaths.networkPath,
      violationsPath,
      screenshotsDir,
    },
  };

  writeJsonFile(join(outputDir, "summary.json"), summary);
  writeTextFile(join(outputDir, "summary.md"), buildMarkdownSummary(summary));
  return summary;
}

async function main() {
  const summary = await runAccessibilityAudit();
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
      "Accessibility audit crashed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(3);
  });
}
