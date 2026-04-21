import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(scriptDir, "..");

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

export function loadJourneyEnv() {
  const configuredPath = process.env.JOURNEY_ENV_FILE
    ? resolve(process.cwd(), process.env.JOURNEY_ENV_FILE)
    : null;
  const candidates = [configuredPath, resolve(repoRoot, ".env.audit.local")].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return parseEnvFile(candidate);
    }
  }

  return {};
}

const fileEnv = loadJourneyEnv();

export function readSetting(name, fallback = "", env = fileEnv) {
  return process.env[name] ?? env[name] ?? fallback;
}

export function readBooleanSetting(name, fallback = false, env = fileEnv) {
  return readSetting(name, fallback ? "true" : "false", env) === "true";
}

export function normalizeBaseUrl(value, fallback) {
  const defaultValue = fallback.replace(/\/$/, "");

  try {
    return new URL(value || fallback).toString().replace(/\/$/, "");
  } catch {
    return defaultValue;
  }
}

export function deriveApexUrl(marketingBaseUrl) {
  try {
    const url = new URL(marketingBaseUrl);
    if (!url.hostname.startsWith("www.")) {
      return null;
    }

    url.hostname = url.hostname.slice(4);
    return url.origin;
  } catch {
    return null;
  }
}

export function toAbsoluteUrl(baseUrl, path) {
  return new URL(path, `${baseUrl}/`).toString();
}

export function getHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

export function sanitizeFileComponent(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeMarkdown(path, value) {
  writeFileSync(path, value.endsWith("\n") ? value : `${value}\n`);
}

export function createStep(id, label, status, details = {}) {
  return {
    id,
    label,
    status,
    ...details,
  };
}

export function buildSummary({ label, marketingBaseUrl, appBaseUrl, steps, extra = {} }) {
  const counts = {
    pass: steps.filter((step) => step.status === "pass").length,
    fail: steps.filter((step) => step.status === "fail").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    blocked: steps.filter((step) => step.status === "blocked").length,
  };

  const outcome = counts.fail > 0 ? "fail" : counts.blocked > 0 ? "blocked" : "pass";

  return {
    checkedAt: new Date().toISOString(),
    label,
    marketingBaseUrl,
    appBaseUrl,
    totals: counts,
    steps,
    outcome,
    ...extra,
  };
}

export const MARKETING_ROUTE_CHECKS = [
  {
    id: "marketing_home",
    label: "Marketing home",
    path: "/",
    marker: "AWS architecture, validation, and optimization for SMB teams that need a clear next step.",
    owner: "marketing-site",
    criticality: "high",
  },
  {
    id: "marketing_services",
    label: "Services",
    path: "/services",
    marker: "Six clear offers. Each one is defined, scoped, and priced.",
    owner: "marketing-site",
    criticality: "high",
  },
  {
    id: "marketing_about",
    label: "About",
    path: "/about",
    marker: "Built by a technical founder who has spent time inside AWS, Microsoft, and real delivery work.",
    owner: "marketing-site",
    criticality: "high",
  },
  {
    id: "marketing_contact",
    label: "Contact",
    path: "/contact",
    marker: "Start the right conversation without getting pushed into signup first.",
    owner: "marketing-site",
    criticality: "high",
  },
  {
    id: "marketing_pricing",
    label: "Pricing",
    path: "/pricing",
    marker: "Public price anchors for consulting, and straightforward pricing for the software that is ready.",
    owner: "marketing-site",
    criticality: "high",
  },
  {
    id: "marketing_software",
    label: "Software",
    path: "/software",
    marker: "Software that supports the consulting model instead of pretending to replace it.",
    owner: "marketing-site",
    criticality: "high",
  },
  {
    id: "marketing_media",
    label: "Insights",
    path: "/media",
    marker: "Guides, notes, and operating perspectives",
    owner: "marketing-site",
    criticality: "medium",
  },
  {
    id: "marketing_privacy",
    label: "Privacy",
    path: "/privacy",
    marker: "Privacy overview",
    owner: "marketing-site",
    criticality: "medium",
  },
  {
    id: "marketing_terms",
    label: "Terms",
    path: "/terms",
    marker: "Platform terms",
    owner: "marketing-site",
    criticality: "medium",
  },
  {
    id: "marketing_refunds",
    label: "Refunds",
    path: "/refunds",
    marker: "Refund posture",
    owner: "marketing-site",
    criticality: "medium",
  },
  {
    id: "marketing_security",
    label: "Security",
    path: "/security",
    marker: "Current platform security posture",
    owner: "marketing-site",
    criticality: "medium",
  },
  {
    id: "marketing_support",
    label: "Support",
    path: "/support",
    marker: "Support lives with the platform",
    owner: "marketing-site",
    criticality: "medium",
  },
];

export const APP_ROUTE_CHECKS = [
  {
    id: "app_login",
    label: "App login",
    path: "/login",
    marker: "Sign in",
    canonicalHost: "app",
    owner: "auth",
    criticality: "high",
  },
  {
    id: "app_register",
    label: "App register",
    path: "/register",
    marker: "Create account",
    canonicalHost: "app",
    owner: "auth",
    criticality: "high",
  },
  {
    id: "app_software",
    label: "App software hub",
    path: "/software",
    marker: "Software that supports the consulting model instead of pretending to replace it.",
    canonicalHost: "marketing",
    owner: "software-site",
    criticality: "high",
  },
  {
    id: "app_architecture_reviewer_public",
    label: "Architecture Diagram Reviewer public state",
    path: "/software/architecture-diagram-reviewer",
    marker: "Verified business-email account required",
    canonicalHost: "marketing",
    owner: "software-tools",
    criticality: "medium",
  },
  {
    id: "app_validator_public",
    label: "ZoKorpValidator public state",
    path: "/software/zokorp-validator",
    marker: "Sign in first",
    canonicalHost: "marketing",
    owner: "software-tools",
    criticality: "medium",
  },
  {
    id: "app_forecasting_public",
    label: "Forecasting beta public state",
    path: "/software/mlops-foundation-platform",
    marker: "Subscription required",
    canonicalHost: "marketing",
    owner: "software-tools",
    criticality: "medium",
  },
  {
    id: "app_architecture_sample_report",
    label: "Architecture sample report",
    path: "/software/architecture-diagram-reviewer/sample-report",
    marker: "Architecture Diagram Reviewer Sample Report",
    canonicalHost: "marketing",
    owner: "software-tools",
    criticality: "medium",
  },
];

export const LEGACY_REDIRECT_CHECKS = [
  {
    id: "legacy_about_us",
    label: "Legacy about redirect",
    path: "/about-us",
    location: "/about",
  },
  {
    id: "legacy_our_services",
    label: "Legacy services redirect",
    path: "/our-services",
    location: "/services",
  },
  {
    id: "legacy_contact_us",
    label: "Legacy contact redirect",
    path: "/contact-us",
    location: "/contact",
  },
  {
    id: "legacy_blog_root",
    label: "Legacy blog redirect",
    path: "/blog",
    location: "/media",
  },
  {
    id: "legacy_blog_article",
    label: "Legacy blog article redirect",
    path: "/blog/example-post",
    location: "/media",
  },
];

export const APP_HOST_MARKETING_SEO_CHECKS = [
  {
    id: "app_host_services_canonical",
    label: "App-host services canonical and robots",
    path: "/services",
    canonicalPath: "/services",
    expectedRobotsHeader: "noindex, follow",
  },
];

export const PRIMARY_HEADER_LINKS = ["Services", "Software", "Pricing", "About", "Contact"];
export const MORE_MENU_LINKS = ["Insights", "Support", "Account"];
export const FOOTER_COMPANY_LINKS = ["Media", "About", "Contact"];
export const FOOTER_TRUST_LINKS = ["Security", "Privacy", "Refunds", "Terms", "Support"];
