#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runProductionSmokeCheck } from "./production_smoke_check.mjs";

const repo = process.env.AUDIT_GITHUB_REPO ?? "leggoboyo/zokorp-platform";
const baseUrl = process.env.AUDIT_BASE_URL ?? "https://app.zokorp.com";
const expectedStripeWebhookUrl = new URL("/api/stripe/webhook", baseUrl).toString();

const requiredStripeEvents = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

const schedulerWorkflows = [
  {
    workflow: "architecture-review-worker.yml",
    label: "Architecture review queue drain",
  },
  {
    workflow: "architecture-followups.yml",
    label: "Architecture review follow-ups",
  },
  {
    workflow: "calendly-booking-sync.yml",
    label: "Calendly booking sync",
  },
  {
    workflow: "zoho-sync-leads.yml",
    label: "Zoho lead sync",
  },
  {
    workflow: "zoho-sync-estimate-companions.yml",
    label: "Zoho estimate companion sync",
  },
];

function runCommand(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

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

function resultStatus(ok, details = {}) {
  return {
    ok,
    ...details,
  };
}

async function pullProductionEnv() {
  const tempDir = mkdtempSync(join(tmpdir(), "zokorp-audit-"));
  const envFile = join(tempDir, "production.env");
  try {
    runCommand("npx", ["vercel", "env", "pull", envFile, "--environment=production", "--yes"]);
    return {
      envFile,
      cleanup() {
        rmSync(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

async function verifyHeaders() {
  const response = await fetch(baseUrl, {
    redirect: "follow",
    headers: {
      "user-agent": "zokorp-production-provider-audit/1.0",
    },
  });

  const requiredHeaders = {
    "content-security-policy": "present",
    "strict-transport-security": "present",
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
  };

  const missing = [];
  for (const [header, expected] of Object.entries(requiredHeaders)) {
    const actual = response.headers.get(header);
    if (!actual) {
      missing.push(`${header}: missing`);
      continue;
    }
    if (expected !== "present" && actual.toLowerCase() !== expected.toLowerCase()) {
      missing.push(`${header}: expected ${expected}, got ${actual}`);
    }
  }

  return resultStatus(response.ok && missing.length === 0, {
    status: response.status,
    missing,
  });
}

async function verifyStripe(env) {
  const response = await fetch("https://api.stripe.com/v1/webhook_endpoints", {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  const payload = await response.json();
  const endpoints = Array.isArray(payload.data) ? payload.data : [];
  const webhook = endpoints.find((endpoint) => endpoint.url === expectedStripeWebhookUrl);
  const missingEvents =
    webhook?.enabled_events?.filter
      ? requiredStripeEvents.filter((event) => !webhook.enabled_events.includes(event))
      : requiredStripeEvents;

  return resultStatus(Boolean(webhook) && webhook.status === "enabled" && missingEvents.length === 0, {
    httpStatus: response.status,
    webhookId: webhook?.id ?? null,
    webhookStatus: webhook?.status ?? null,
    configuredUrl: webhook?.url ?? null,
    missingEvents,
  });
}

async function refreshZohoInvoiceToken(env) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: env.ZOHO_INVOICE_REFRESH_TOKEN ?? "",
    client_id: env.ZOHO_INVOICE_CLIENT_ID ?? "",
    client_secret: env.ZOHO_INVOICE_CLIENT_SECRET ?? "",
  });

  const response = await fetch(`${env.ZOHO_INVOICE_ACCOUNTS_DOMAIN}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const payload = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function verifyZohoInvoice(env) {
  const refresh = await refreshZohoInvoiceToken(env);
  if (!refresh.ok || !refresh.payload?.access_token) {
    return resultStatus(false, {
      refreshStatus: refresh.status,
      message: refresh.payload?.error ?? refresh.payload?.message ?? "refresh_failed",
    });
  }

  const response = await fetch(
    `${env.ZOHO_INVOICE_API_DOMAIN}/invoice/v3/contacts?organization_id=${encodeURIComponent(env.ZOHO_INVOICE_ORGANIZATION_ID)}&per_page=1&page=1`,
    {
      headers: {
        Authorization: `Zoho-oauthtoken ${refresh.payload.access_token}`,
      },
    },
  );

  const payload = await response.json();
  return resultStatus(response.ok && payload?.code === 0, {
    refreshStatus: refresh.status,
    invoiceStatus: response.status,
    message: payload?.message ?? null,
    code: payload?.code ?? null,
  });
}

function verifyEnvPresence(env) {
  const requiredKeys = [
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_SITE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID_PLATFORM_MONTHLY",
    "STRIPE_PRICE_ID_PLATFORM_ANNUAL",
    "PUBLIC_SUBSCRIPTION_PRICING_APPROVED",
    "ZOHO_INVOICE_ORGANIZATION_ID",
    "ZOHO_INVOICE_CLIENT_ID",
    "ZOHO_INVOICE_CLIENT_SECRET",
    "ZOHO_INVOICE_REFRESH_TOKEN",
    "ZOHO_INVOICE_API_DOMAIN",
    "ZOHO_INVOICE_ACCOUNTS_DOMAIN",
    "CRON_SECRET",
  ];

  const missing = requiredKeys.filter((key) => !env[key]?.trim());
  const pricingApproved = env.PUBLIC_SUBSCRIPTION_PRICING_APPROVED === "true";
  return resultStatus(missing.length === 0 && pricingApproved, {
    missing,
    pricingApproved,
  });
}

function verifyCanonicalOrigins(env) {
  const authUrl = env.NEXTAUTH_URL ?? "";
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";
  try {
    return resultStatus(new URL(authUrl).origin === new URL(siteUrl).origin, {
      authOrigin: new URL(authUrl).origin,
      siteOrigin: new URL(siteUrl).origin,
    });
  } catch {
    return resultStatus(false, {
      authOrigin: authUrl || null,
      siteOrigin: siteUrl || null,
    });
  }
}

function verifyGithubRuns() {
  const runs = schedulerWorkflows.map((item) => {
    const output = runCommand("gh", [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      item.workflow,
      "--limit",
      "1",
      "--json",
      "databaseId,workflowName,status,conclusion,createdAt,event,url",
    ]);
    const parsed = JSON.parse(output);
    const latest = parsed[0] ?? null;
    return {
      workflow: item.workflow,
      label: item.label,
      latest,
      ok: Boolean(latest) && latest.status === "completed" && latest.conclusion === "success",
    };
  });

  return resultStatus(runs.every((item) => item.ok), {
    runs: runs.map((item) => ({
      workflow: item.workflow,
      label: item.label,
      ok: item.ok,
      latest: item.latest,
    })),
  });
}

function summarizeChecks(checks) {
  return {
    pass: checks.filter((check) => check.ok).length,
    fail: checks.filter((check) => !check.ok).length,
  };
}

async function main() {
  const pulledEnv = await pullProductionEnv();
  let env = {};
  try {
    env = parseEnvFile(pulledEnv.envFile);
  } finally {
    pulledEnv.cleanup();
  }

  const smoke = await runProductionSmokeCheck({ baseUrl });
  const checks = [
    {
      id: "env_presence",
      label: "Production env presence",
      ...(verifyEnvPresence(env)),
    },
    {
      id: "origin_alignment",
      label: "Canonical auth/site origin alignment",
      ...(verifyCanonicalOrigins(env)),
    },
    {
      id: "smoke",
      label: "Production route smoke check",
      ok: smoke.outcome === "pass",
      outcome: smoke.outcome,
      regressions: smoke.regressions,
    },
    {
      id: "headers",
      label: "Canonical response security headers",
      ...(await verifyHeaders()),
    },
    {
      id: "stripe",
      label: "Stripe webhook binding",
      ...(await verifyStripe(env)),
    },
    {
      id: "zoho_invoice",
      label: "Zoho Invoice API access",
      ...(await verifyZohoInvoice(env)),
    },
    {
      id: "github_schedulers",
      label: "GitHub scheduler workflow health",
      ...(verifyGithubRuns()),
    },
  ];

  const totals = summarizeChecks(checks);
  const outcome = totals.fail === 0 ? "pass" : "fail";
  const summary = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    outcome,
    totals,
    checks,
  };

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Checked at: ${summary.checkedAt}`);
  console.log("");
  for (const check of checks) {
    console.log(`- ${check.ok ? "PASS" : "FAIL"} ${check.label}`);
  }
  console.log("");
  console.log("JSON summary:");
  console.log(JSON.stringify(summary, null, 2));

  process.exit(outcome === "pass" ? 0 : 1);
}

main().catch((error) => {
  console.error("Production provider audit crashed:", error instanceof Error ? error.message : error);
  process.exit(3);
});
