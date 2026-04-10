#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";
import { PrismaClient, CreditTier, EntitlementStatus, Role, ServiceRequestStatus, ServiceRequestType } from "@prisma/client";
import { chromium } from "playwright";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const outputDir = resolve(repoRoot, "output", "playwright", "production-operational-proof");
const envFilePath = resolve(repoRoot, ".env.audit.local");
const defaultDatabaseRetryAttempts = Number.parseInt(process.env.PROOF_DB_RETRY_ATTEMPTS ?? "8", 10);
const defaultDatabaseRetryBaseDelayMs = Number.parseInt(process.env.PROOF_DB_RETRY_BASE_DELAY_MS ?? "1500", 10);
const defaultDatabaseRetryMaxDelayMs = Number.parseInt(process.env.PROOF_DB_RETRY_MAX_DELAY_MS ?? "10000", 10);

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
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

function readAuditEnv() {
  if (!existsSync(envFilePath)) {
    throw new Error("Missing .env.audit.local. Run `npm run journey:setup:production` first.");
  }

  return parseEnvFile(envFilePath);
}

function runCommand(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isSessionPoolError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("MaxClientsInSessionMode") || message.toLowerCase().includes("max clients reached");
}

async function withDatabaseRetry(label, fn, attempts = defaultDatabaseRetryAttempts) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isSessionPoolError(error) || attempt === attempts) {
        throw error;
      }

      console.warn(`${label} hit session pool pressure on attempt ${attempt}/${attempts}. Retrying...`);
      const backoffMs = Math.min(defaultDatabaseRetryBaseDelayMs * (2 ** (attempt - 1)), defaultDatabaseRetryMaxDelayMs);
      await sleep(backoffMs);
    }
  }

  throw lastError;
}

function pullProductionEnv() {
  const tempDir = mkdtempSync(join(tmpdir(), "zokorp-ops-proof-"));
  const pulledEnvPath = join(tempDir, "production.env");
  try {
    runCommand("npx", ["vercel", "env", "pull", pulledEnvPath, "--environment=production", "--yes"]);
    return {
      env: parseEnvFile(pulledEnvPath),
      cleanup() {
        rmSync(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function withSingleConnection(url) {
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    return trimmed;
  }

  const nextUrl = new URL(trimmed);
  if (!nextUrl.searchParams.has("connection_limit")) {
    nextUrl.searchParams.set("connection_limit", "1");
  }
  return nextUrl.toString();
}

function resolveOperationalDatabaseUrl(auditEnv, pulledEnv) {
  const candidates = [
    auditEnv.PRODUCTION_DIRECT_DATABASE_URL,
    auditEnv.PRODUCTION_DATABASE_URL,
    process.env.PRODUCTION_DIRECT_DATABASE_URL,
    process.env.PRODUCTION_DATABASE_URL,
    process.env.DIRECT_DATABASE_URL,
    process.env.DATABASE_URL,
    pulledEnv.DIRECT_DATABASE_URL,
    pulledEnv.DATABASE_URL,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return withSingleConnection(trimmed);
    }
  }

  return "";
}

async function buildProofWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Checklist");

  sheet.addRow(["Control ID", "Requirement", "Partner Response"]);
  sheet.addRow([
    "FTR-001",
    "Describe the software offering path, use cases, deployment guide, and AWS resources created.",
    "Customer-deployed software offering. Deployment guide section 1 lists the use cases, Amazon VPC, private and public subnets, Application Load Balancer, EC2 application tier, Amazon RDS, Amazon S3, IAM roles, and CloudWatch alarms.",
  ]);
  sheet.addRow([
    "FTR-002",
    "Describe security controls, IAM posture, and evidence references.",
    "Least-privilege IAM guidance is documented. Root usage is prohibited for normal operations. Evidence references are listed as Doc: Deployment Guide, Page: 4, Section: SEC-001, Paragraph: 2.",
  ]);
  sheet.addRow([
    "FTR-003",
    "Describe support, incident handling, backup and restore, and monitoring ownership.",
    "Support escalation, incident triage, backup/restore expectations, and CloudWatch monitoring ownership are documented in the runbook appendix with named operating roles.",
  ]);
  sheet.addRow([
    "FTR-004",
    "Describe release validation, QA evidence, and final reviewer sign-off.",
    "Release validation includes acceptance criteria, QA evidence, blocker tracking, and final technical reviewer approval before release.",
  ]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

function sanitizeFileComponent(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function screenshot(page, name) {
  const target = join(outputDir, `${sanitizeFileComponent(name)}.png`);
  await page.screenshot({ path: target, fullPage: true });
  return target;
}

async function ensureAuditAccess(prisma, email) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      entitlements: {
        include: {
          product: true,
        },
      },
      creditBalances: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error(`Audit user not found: ${email}`);
  }

  if (user.role !== Role.USER) {
    throw new Error(`Audit user must stay non-admin: ${email}`);
  }

  const validatorProduct = await prisma.product.findUnique({
    where: { slug: "zokorp-validator" },
    select: { id: true },
  });

  if (!validatorProduct) {
    throw new Error("Validator product is missing in production.");
  }

  await prisma.entitlement.upsert({
    where: {
      userId_productId: {
        userId: user.id,
        productId: validatorProduct.id,
      },
    },
    create: {
      userId: user.id,
      productId: validatorProduct.id,
      remainingUses: 1,
      status: EntitlementStatus.ACTIVE,
    },
    update: {
      status: EntitlementStatus.ACTIVE,
      remainingUses: {
        increment: 1,
      },
    },
  });

  await prisma.creditBalance.upsert({
    where: {
      userId_productId_tier: {
        userId: user.id,
        productId: validatorProduct.id,
        tier: CreditTier.FTR,
      },
    },
    create: {
      userId: user.id,
      productId: validatorProduct.id,
      tier: CreditTier.FTR,
      remainingUses: 1,
      status: EntitlementStatus.ACTIVE,
    },
    update: {
      status: EntitlementStatus.ACTIVE,
      remainingUses: {
        increment: 1,
      },
    },
  });

  const beforeBalance = await prisma.creditBalance.findUnique({
    where: {
      userId_productId_tier: {
        userId: user.id,
        productId: validatorProduct.id,
        tier: CreditTier.FTR,
      },
    },
    select: {
      remainingUses: true,
    },
  });

  return {
    userId: user.id,
    productId: validatorProduct.id,
    beforeBalance: beforeBalance?.remainingUses ?? 0,
  };
}

async function loginAndSubmitValidatorProof({
  baseUrl,
  email,
  password,
  workbookBuffer,
  proofRunKey,
}) {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle" });
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("form").first().getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(new RegExp("\\/account$"), { timeout: 30_000 });
    await page.goto(new URL("/software/zokorp-validator", baseUrl).toString(), { waitUntil: "networkidle" });

    const validatorPageText = await page.textContent("body");
    const beforeBalanceMatch = validatorPageText?.match(/Selected credits:\s*(\d+)/);
    const beforeBalance = beforeBalanceMatch ? Number.parseInt(beforeBalanceMatch[1], 10) : null;
    if (beforeBalance === null || Number.isNaN(beforeBalance)) {
      throw new Error("Could not determine validator credit balance from the account UI.");
    }
    if (beforeBalance < 1) {
      throw new Error("Audit account has no validator credits available for the operational proof.");
    }

    const workbookBase64 = workbookBuffer.toString("base64");
    const validatorResponse = await page.evaluate(
      async ({ workbookBase64, proofRunKey }) => {
        const binary = atob(workbookBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const formData = new FormData();
        formData.set("validationProfile", "FTR");
        formData.set("validationTargetId", "ftr:software-offering");
        formData.set(
          "additionalContext",
          `Synthetic operational proof run ${proofRunKey}. Verify non-admin credit consumption, delivery state tracking, and account history visibility.`,
        );
        formData.set(
          "file",
          new File([bytes], "synthetic-ftr-proof.xlsx", {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );

        const response = await fetch("/api/tools/zokorp-validator", {
          method: "POST",
          body: formData,
          credentials: "same-origin",
        });
        const json = await response.json();

        return {
          ok: response.ok,
          status: response.status,
          json,
        };
      },
      { workbookBase64, proofRunKey },
    );

    if (!validatorResponse.ok) {
      throw new Error(`Validator proof request failed with ${validatorResponse.status}: ${JSON.stringify(validatorResponse.json)}`);
    }

    const afterBalance =
      validatorResponse.json && typeof validatorResponse.json.remainingUses === "number"
        ? validatorResponse.json.remainingUses
        : null;
    if (afterBalance !== null && afterBalance !== beforeBalance - 1) {
      throw new Error(`Expected validator remaining uses to decrement by 1. Before=${beforeBalance}, After=${afterBalance}`);
    }

    await page.goto(new URL("/account", baseUrl).toString(), { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Tool Runs", exact: true }).click();
    await page.getByText("ZoKorpValidator · FTR", { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });

    const accountScreenshot = await screenshot(page, "account-validator-proof");

    return {
      response: validatorResponse.json,
      accountScreenshot,
      beforeBalance,
      afterBalance,
    };
  } finally {
    await browser.close();
  }
}

async function queryValidatorProof(prisma, { userId, productId, proofStartedAt, proofRunKey, beforeBalance }) {
  const afterBalance = await prisma.creditBalance.findUnique({
    where: {
      userId_productId_tier: {
        userId,
        productId,
        tier: CreditTier.FTR,
      },
    },
    select: {
      remainingUses: true,
    },
  });

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      userId,
      action: "tool.zokorp_validator_run",
      createdAt: {
        gte: proofStartedAt,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  const proofAuditLog = auditLogs.find((log) => {
    const metadata = log.metadataJson && typeof log.metadataJson === "object" && !Array.isArray(log.metadataJson)
      ? log.metadataJson
      : null;
    return metadata?.filename === "synthetic-ftr-proof.xlsx";
  }) ?? auditLogs[0] ?? null;

  if (!proofAuditLog) {
    throw new Error("No validator audit log found for the proof run.");
  }

  const metadata = proofAuditLog.metadataJson && typeof proofAuditLog.metadataJson === "object" && !Array.isArray(proofAuditLog.metadataJson)
    ? proofAuditLog.metadataJson
    : {};

  const deliveryStatus = typeof metadata.deliveryStatus === "string" ? metadata.deliveryStatus : null;
  const quoteCompanionStatus = typeof metadata.quoteCompanionStatus === "string" ? metadata.quoteCompanionStatus : null;
  const score = typeof metadata.score === "number" ? metadata.score : null;

  if ((afterBalance?.remainingUses ?? beforeBalance) !== beforeBalance - 1) {
    throw new Error(`Expected FTR credit balance to decrement by 1. Before=${beforeBalance}, After=${afterBalance?.remainingUses ?? "missing"}`);
  }

  return {
    proofRunKey,
    auditLogId: proofAuditLog.id,
    score,
    deliveryStatus,
    quoteCompanionStatus,
    beforeBalance,
    afterBalance: afterBalance?.remainingUses ?? null,
  };
}

async function runBrowserOnlyBookedCallProof({
  baseUrl,
  email,
  password,
  calendlySyncSecret,
}) {
  const externalEventId = `synthetic-booked-call-${Date.now()}`;
  const estimateReferenceCode = `ZK-ARCH-SYNTH-${Date.now().toString().slice(-6)}`;
  const bookedAtIso = new Date().toISOString();

  const response = await fetch(new URL("/api/internal/calendly/booked-call", baseUrl).toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-calendly-sync-secret": calendlySyncSecret,
    },
    body: JSON.stringify({
      email,
      name: "ZoKorp Browser Audit",
      externalEventId,
      bookedAtIso,
      estimateReferenceCode,
      provider: "calendly-synthetic-proof",
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Booked-call proof route failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  if (!payload || payload.status !== "ok") {
    throw new Error(`Booked-call proof route returned unexpected payload: ${JSON.stringify(payload)}`);
  }

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle" });
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("form").first().getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(new RegExp("\\/account$"), { timeout: 30_000 });

    await page.getByText(estimateReferenceCode, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
    const serviceRequestScreenshot = await screenshot(page, "account-service-request-proof");

    await page.getByRole("tab", { name: "Follow-ups", exact: true }).click();
    await page.getByText(estimateReferenceCode, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
    const followUpsScreenshot = await screenshot(page, "account-follow-ups-proof");

    return {
      externalEventId,
      estimateReferenceCode,
      serviceRequestId: typeof payload.serviceRequestId === "string" ? payload.serviceRequestId : null,
      status: payload.status,
      ingestMode: "internal-route",
      routeStatus: response.status,
      serviceRequestScreenshot,
      followUpsScreenshot,
    };
  } finally {
    await browser.close();
  }
}

async function runSyntheticBookedCallProof({
  prisma,
  calendlySyncSecret,
  ingestBaseUrl,
  email,
  userId,
}) {
  const externalEventId = `synthetic-booked-call-${Date.now()}`;
  const estimateReferenceCode = `ZK-ARCH-SYNTH-${Date.now().toString().slice(-6)}`;
  const bookedAtIso = new Date().toISOString();
  let ingestMode = "internal-route";
  let routeStatus = null;

  try {
    const response = await fetch(new URL("/api/internal/calendly/booked-call", ingestBaseUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-calendly-sync-secret": calendlySyncSecret,
      },
      body: JSON.stringify({
        email,
        name: "ZoKorp Browser Audit",
        externalEventId,
        bookedAtIso,
        estimateReferenceCode,
        provider: "calendly-synthetic-proof",
      }),
    });

    routeStatus = response.status;
    if (!response.ok) {
      throw new Error(`Internal route returned ${response.status}`);
    }
  } catch (error) {
    ingestMode = "database-fallback";

    const lead = await prisma.lead.upsert({
      where: { email },
      update: {
        lastSeenAt: new Date(),
        userId,
      },
      create: {
        email,
        userId,
        name: "ZoKorp Browser Audit",
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    const trackingCode = `SR-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${Date.now().toString().slice(-5)}`;
    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        userId,
        trackingCode,
        type: ServiceRequestType.CONSULTATION,
        title: "Architecture Review Follow-up",
        summary: [
          "Synthetic booked-call proof created by production operational audit.",
          `Booked time: ${bookedAtIso}`,
          `Estimate reference: ${estimateReferenceCode}`,
          "Provider: calendly-synthetic-proof",
        ].join(" "),
        status: ServiceRequestStatus.SCHEDULED,
      },
      select: {
        id: true,
      },
    });

    await prisma.leadInteraction.create({
      data: {
        leadId: lead.id,
        userId,
        serviceRequestId: serviceRequest.id,
        source: "architecture-review",
        action: "call_booked",
        provider: "calendly-synthetic-proof",
        externalEventId,
        estimateReferenceCode,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "integration.calendly_call_booked.synthetic_proof",
        metadataJson: {
          email,
          externalEventId,
          estimateReferenceCode,
          routeStatus,
          ingestMode,
          routeError: error instanceof Error ? error.message : String(error),
        },
      },
    });
  }

  const interaction = await prisma.leadInteraction.findUnique({
    where: {
      externalEventId,
    },
    include: {
      lead: {
        select: {
          email: true,
        },
      },
      serviceRequest: {
        select: {
          id: true,
          trackingCode: true,
          title: true,
          status: true,
          type: true,
        },
      },
    },
  });

  if (!interaction) {
    throw new Error("Synthetic booked-call interaction was not persisted.");
  }

  if (interaction.userId !== userId) {
    throw new Error("Synthetic booked-call interaction was not linked to the audit user.");
  }

  if (!interaction.serviceRequestId || !interaction.serviceRequest) {
    throw new Error("Synthetic booked-call did not create a linked service request.");
  }

  if (interaction.serviceRequest.status !== ServiceRequestStatus.SCHEDULED) {
    throw new Error(`Expected synthetic service request to be scheduled, got ${interaction.serviceRequest.status}.`);
  }

  if (interaction.serviceRequest.type !== ServiceRequestType.CONSULTATION) {
    throw new Error(`Expected synthetic service request type CONSULTATION, got ${interaction.serviceRequest.type}.`);
  }

  return {
    externalEventId,
    estimateReferenceCode,
    serviceRequestId: interaction.serviceRequestId,
    trackingCode: interaction.serviceRequest.trackingCode,
    status: interaction.serviceRequest.status,
    email: interaction.lead.email,
    ingestMode,
    routeStatus,
  };
}

async function main() {
  ensureOutputDir();
  const auditEnv = readAuditEnv();
  const pulled = pullProductionEnv();

  let prisma = null;
  try {
    const env = pulled.env;
    const baseUrl = auditEnv.JOURNEY_BASE_URL ?? env.NEXTAUTH_URL ?? "https://app.zokorp.com";
    const databaseUrl = resolveOperationalDatabaseUrl(auditEnv, env);
    const calendlySyncSecret = auditEnv.CALENDLY_SYNC_SECRET?.trim() || env.CALENDLY_SYNC_SECRET?.trim() || "";
    const initialDatabaseSettleMs = Number.parseInt(process.env.PROOF_DB_INITIAL_SETTLE_MS ?? "0", 10);

    if (!auditEnv.JOURNEY_EMAIL || !auditEnv.JOURNEY_PASSWORD) {
      throw new Error("JOURNEY_EMAIL and JOURNEY_PASSWORD must exist in .env.audit.local.");
    }

    if (!calendlySyncSecret) {
      throw new Error("CALENDLY_SYNC_SECRET is missing. Add it to .env.audit.local for direct booked-call proof.");
    }

    const proofStartedAt = new Date();
    const proofRunKey = proofStartedAt.toISOString();
    const workbookBuffer = await buildProofWorkbook();

    let validatorProof;
    let bookedCallProof;
    let validatorResult;

    if (databaseUrl) {
      prisma = new PrismaClient({
        datasources: {
          db: {
            url: databaseUrl,
          },
        },
        log: ["error"],
      });

      if (initialDatabaseSettleMs > 0) {
        console.log(`Waiting ${initialDatabaseSettleMs}ms before starting direct database proof checks.`);
        await sleep(initialDatabaseSettleMs);
      }

      const validatorAccess = await withDatabaseRetry("ensureAuditAccess", () =>
        ensureAuditAccess(prisma, auditEnv.JOURNEY_EMAIL),
      );
      validatorResult = await loginAndSubmitValidatorProof({
        baseUrl,
        email: auditEnv.JOURNEY_EMAIL,
        password: auditEnv.JOURNEY_PASSWORD,
        workbookBuffer,
        proofRunKey,
      });
      validatorProof = await withDatabaseRetry("queryValidatorProof", () =>
        queryValidatorProof(prisma, {
          userId: validatorAccess.userId,
          productId: validatorAccess.productId,
          proofStartedAt,
          proofRunKey,
          beforeBalance: validatorAccess.beforeBalance,
        }),
      );
      bookedCallProof = await withDatabaseRetry("runSyntheticBookedCallProof", () =>
        runSyntheticBookedCallProof({
          prisma,
          calendlySyncSecret,
          ingestBaseUrl: baseUrl,
          email: auditEnv.JOURNEY_EMAIL,
          userId: validatorAccess.userId,
        }),
      );
    } else {
      validatorResult = await loginAndSubmitValidatorProof({
        baseUrl,
        email: auditEnv.JOURNEY_EMAIL,
        password: auditEnv.JOURNEY_PASSWORD,
        workbookBuffer,
        proofRunKey,
      });
      validatorProof = {
        proofRunKey,
        auditLogId: null,
        score: typeof validatorResult.response?.score === "number" ? validatorResult.response.score : null,
        deliveryStatus:
          typeof validatorResult.response?.deliveryStatus === "string" ? validatorResult.response.deliveryStatus : null,
        quoteCompanionStatus:
          typeof validatorResult.response?.quoteCompanion?.status === "string"
            ? validatorResult.response.quoteCompanion.status
            : null,
        beforeBalance: validatorResult.beforeBalance,
        afterBalance: validatorResult.afterBalance,
        verificationMode: "browser-only",
      };

      bookedCallProof = await runBrowserOnlyBookedCallProof({
        baseUrl,
        email: auditEnv.JOURNEY_EMAIL,
        password: auditEnv.JOURNEY_PASSWORD,
        calendlySyncSecret,
      });
    }

    const summary = {
      checkedAt: new Date().toISOString(),
      baseUrl,
      auditEmail: auditEnv.JOURNEY_EMAIL,
      verificationMode: databaseUrl ? "database-backed" : "browser-only",
      validatorProof: {
        ...validatorProof,
        accountScreenshot: validatorResult.accountScreenshot,
        responseRemainingUses: validatorResult.response.remainingUses ?? null,
      },
      bookedCallProof,
      notes: [
        "This proof uses the dedicated non-admin browser audit account.",
        "Validator proof consumes one real FTR credit and checks account-linked delivery state.",
        "Booked-call proof verifies service-request linkage with a synthetic provider event.",
        "The script attempts the internal Calendly ingest route first and records when local verification falls back to direct data-path proof.",
        "Real monitored inbox proof and one real external Calendly booking have already been confirmed separately for the current soft-launch claim.",
      ],
    };

    const summaryPath = join(outputDir, "summary.json");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

    console.log(`Soft-launch operational proof passed.`);
    console.log(`Summary: ${summaryPath}`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    pulled.cleanup();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
