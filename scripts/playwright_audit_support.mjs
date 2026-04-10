import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join, resolve } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(scriptDir, "..");

export function parseArgs(argv) {
  const options = {};

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [rawKey, ...rawValue] = argument.slice(2).split("=");
    options[rawKey] = rawValue.length > 0 ? rawValue.join("=") : "true";
  }

  return options;
}

export function parseEnvFile(path) {
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

export function loadAuditEnv(configuredPath) {
  const candidates = [
    configuredPath ? resolve(process.cwd(), configuredPath) : null,
    resolve(repoRoot, ".env.audit.local"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return parseEnvFile(candidate);
    }
  }

  return {};
}

export function createSettingsReader({ args = {}, envFile = {} } = {}) {
  return function readSetting(names, fallback = "") {
    const keys = Array.isArray(names) ? names : [names];

    for (const key of keys) {
      const value = args[key] ?? process.env[key] ?? envFile[key];
      if (value !== undefined && value !== null && value !== "") {
        return String(value);
      }
    }

    return fallback;
  };
}

export function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function readNumber(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveVercelProtectionBypassHeaders(readSetting, { setCookie = false } = {}) {
  const secret = readSetting(
    [
      "VERCEL_AUTOMATION_BYPASS_SECRET",
      "AUDIT_VERCEL_PROTECTION_BYPASS",
      "JOURNEY_VERCEL_PROTECTION_BYPASS",
      "SMOKE_VERCEL_PROTECTION_BYPASS",
    ],
    "",
  );

  if (!secret) {
    return undefined;
  }

  const headers = {
    "x-vercel-protection-bypass": secret,
  };

  if (setCookie) {
    headers["x-vercel-set-bypass-cookie"] = readSetting(
      [
        "VERCEL_AUTOMATION_BYPASS_SET_COOKIE",
        "AUDIT_VERCEL_PROTECTION_BYPASS_SET_COOKIE",
        "JOURNEY_VERCEL_PROTECTION_BYPASS_SET_COOKIE",
        "SMOKE_VERCEL_PROTECTION_BYPASS_SET_COOKIE",
      ],
      "true",
    );
  }

  return headers;
}

export function isLocalHostUrl(value) {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function resolveExpectedCanonicalBaseUrl({
  observedBaseUrl,
  explicitBaseUrl = "",
  defaultBaseUrl,
}) {
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  return isLocalHostUrl(observedBaseUrl) ? defaultBaseUrl : observedBaseUrl;
}

export function resolveOutputPath(path) {
  return resolve(repoRoot, path);
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function sanitizeFileComponent(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function writePageScreenshot(page, screenshotsDir, stepId) {
  ensureDir(screenshotsDir);
  const filePath = join(screenshotsDir, `${sanitizeFileComponent(stepId)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

export function writeJsonFile(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeTextFile(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, value);
}

export function buildStep(id, label, status, details = {}) {
  return {
    id,
    label,
    status,
    ...details,
  };
}

export function buildTotals(steps) {
  return {
    pass: steps.filter((step) => step.status === "pass").length,
    fail: steps.filter((step) => step.status === "fail").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    blocked: steps.filter((step) => step.status === "blocked").length,
  };
}

export function outcomeFromSteps(steps) {
  if (steps.some((step) => step.status === "fail")) {
    return "fail";
  }

  if (steps.some((step) => step.status === "blocked")) {
    return "blocked";
  }

  return "pass";
}

export function createBrowserDiagnostics() {
  return {
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    ignoredRequestFailures: [],
    responseFailures: [],
  };
}

function captureConsoleMessage(message) {
  return {
    type: message.type(),
    text: message.text(),
    location: message.location(),
  };
}

function shouldRecordResponseFailure(response) {
  const request = response.request();
  const resourceType = request.resourceType();
  return response.status() >= 400 && ["document", "xhr", "fetch"].includes(resourceType);
}

function shouldIgnoreRequestFailure(request) {
  const failureText = request.failure()?.errorText ?? "";
  return failureText === "net::ERR_ABORTED";
}

export function attachContextDiagnostics(context, diagnostics) {
  const observedPages = new WeakSet();

  function observePage(page) {
    if (observedPages.has(page)) {
      return;
    }

    observedPages.add(page);

    page.on("console", (message) => {
      diagnostics.consoleMessages.push(captureConsoleMessage(message));
    });

    page.on("pageerror", (error) => {
      diagnostics.pageErrors.push({
        message: error instanceof Error ? error.message : String(error),
      });
    });

    page.on("requestfailed", (request) => {
      const entry = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        failureText: request.failure()?.errorText ?? "unknown",
      };

      if (shouldIgnoreRequestFailure(request)) {
        diagnostics.ignoredRequestFailures.push(entry);
        return;
      }

      diagnostics.requestFailures.push({
        ...entry,
      });
    });

    page.on("response", (response) => {
      if (!shouldRecordResponseFailure(response)) {
        return;
      }

      diagnostics.responseFailures.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        resourceType: response.request().resourceType(),
        method: response.request().method(),
      });
    });
  }

  for (const page of context.pages()) {
    observePage(page);
  }

  context.on("page", observePage);
}

export function persistDiagnostics(outputDir, diagnostics) {
  const consolePath = join(outputDir, "console.log");
  const networkPath = join(outputDir, "network.json");
  const consoleText = [
    ...diagnostics.consoleMessages.map((entry) => `[console:${entry.type}] ${entry.text}`),
    ...diagnostics.pageErrors.map((entry) => `[pageerror] ${entry.message}`),
  ].join("\n");

  writeTextFile(consolePath, consoleText ? `${consoleText}\n` : "");
  writeJsonFile(networkPath, {
    requestFailures: diagnostics.requestFailures,
    ignoredRequestFailures: diagnostics.ignoredRequestFailures,
    responseFailures: diagnostics.responseFailures,
  });

  return {
    consolePath,
    networkPath,
  };
}

export async function promptUser(message) {
  const readline = createInterface({ input, output });
  try {
    return (await readline.question(`${message}\n> `)).trim();
  } finally {
    readline.close();
  }
}

export async function collectLandmarkSnapshot(page) {
  const [headings, landmarkCounts] = await Promise.all([
    page
      .getByRole("heading")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.textContent?.trim()).filter(Boolean),
      ),
    page.evaluate(() => ({
      headerCount: document.querySelectorAll("header").length,
      mainCount: document.querySelectorAll("main").length,
      footerCount: document.querySelectorAll("footer").length,
      navCount: document.querySelectorAll("nav").length,
    })),
  ]);

  return {
    headings,
    landmarks: landmarkCounts,
  };
}

export async function collectHeadSnapshot(page) {
  return page.evaluate(() => ({
    canonicalHref: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
    robotsContent: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
  }));
}

export async function writeLocatorScreenshot(locator, screenshotsDir, stepId) {
  ensureDir(screenshotsDir);
  const filePath = join(screenshotsDir, `${sanitizeFileComponent(stepId)}.png`);
  await locator.screenshot({ path: filePath });
  return filePath;
}

export async function manualRedirectCheck(url, timeoutMs, userAgent, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        ...extraHeaders,
      },
    });

    return {
      status: response.status,
      location: response.headers.get("location"),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function followFetch(url, timeoutMs, userAgent, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        ...extraHeaders,
      },
    });

    return {
      status: response.status,
      finalUrl: response.url,
      body: await response.text(),
      headers: Object.fromEntries(response.headers.entries()),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function toAbsoluteUrl(pathname, baseUrl) {
  return new URL(pathname, baseUrl).toString();
}

export function shouldUseCompatibilityBaseUrl(baseUrl) {
  if (!baseUrl) {
    return false;
  }

  try {
    const hostname = new URL(baseUrl).hostname;
    return !["zokorp.com", "www.zokorp.com", "app.zokorp.com"].includes(hostname);
  } catch {
    return false;
  }
}
