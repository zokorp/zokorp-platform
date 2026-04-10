#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient, Role } from "@prisma/client";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const defaultLocalEnvFile = resolve(repoRoot, ".env.audit.local");

function parseArgs(argv) {
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

function serializeEnvFile(input) {
  return `${Object.entries(input)
    .map(([key, value]) => `${key}=${quoteEnvValue(String(value))}`)
    .join("\n")}\n`;
}

function runCommand(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function quoteEnvValue(value) {
  return JSON.stringify(value);
}

function isFreeEmailDomain(email) {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";

  return new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "aol.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "proton.me",
    "protonmail.com",
    "pm.me",
    "gmx.com",
    "yandex.com",
    "mail.com",
    "zoho.com",
  ]).has(domain);
}

function validateAuditEmail(email) {
  if (!email.includes("@")) {
    throw new Error(`Audit email is invalid: ${email}`);
  }

  if (isFreeEmailDomain(email)) {
    throw new Error(`Audit email must not use a blocked personal domain: ${email}`);
  }
}

function generatePassword() {
  const random = crypto.randomBytes(8).toString("base64url");
  return `ZoKorp!Audit2026-${random}aA1`;
}

function buildScryptOptions() {
  return {
    N: 2 ** 15,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, buildScryptOptions(), (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });

  return [
    "scrypt",
    String(2 ** 15),
    "8",
    "1",
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

function pullVercelEnvironment(environment) {
  const tempDir = mkdtempSync(join(tmpdir(), "zokorp-browser-audit-"));
  const envFile = join(tempDir, `${environment}.env`);

  try {
    runCommand("npx", ["vercel", "env", "pull", envFile, `--environment=${environment}`, "--yes"]);
    return {
      env: parseEnvFile(envFile),
      cleanup() {
        rmSync(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function resolveBaseUrl(environment, pulledEnv) {
  const configuredBaseUrl = pulledEnv.NEXTAUTH_URL ?? pulledEnv.NEXT_PUBLIC_SITE_URL ?? "";

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (environment === "production") {
    return "https://app.zokorp.com";
  }

  if (environment === "preview") {
    return "";
  }

  return "http://localhost:3000";
}

function suggestedNextCommand({ environment, localEnvPath }) {
  const envFlag = `JOURNEY_ENV_FILE=${localEnvPath}`;

  if (environment === "preview") {
    return `${envFlag} JOURNEY_MARKETING_BASE_URL=https://preview-www.example.com JOURNEY_APP_BASE_URL=https://preview-app.example.com npm run journey:audit:preview`;
  }

  return `npm run journey:audit:${environment}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const environment = options.environment ?? process.env.AUDIT_ACCOUNT_ENVIRONMENT ?? "production";
  const email = (options.email ?? process.env.AUDIT_ACCOUNT_EMAIL ?? "browser-audit@zokorp-platform.test").trim().toLowerCase();
  const name = (options.name ?? process.env.AUDIT_ACCOUNT_NAME ?? "ZoKorp Browser Audit").trim();
  const password = options.password ?? process.env.AUDIT_ACCOUNT_PASSWORD ?? generatePassword();
  const localEnvPath = resolve(repoRoot, options["write-env-file"] ?? process.env.AUDIT_ACCOUNT_ENV_FILE ?? defaultLocalEnvFile);

  validateAuditEmail(email);

  let pulled = null;
  let prisma = null;

  try {
    pulled = pullVercelEnvironment(environment);
    const env = pulled.env;
    const databaseUrl = env.DIRECT_DATABASE_URL ?? env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(`No database URL found in pulled Vercel ${environment} environment.`);
    }

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: ["error"],
    });

    const existing = await prisma.user.findUnique({
      where: { email },
      include: { userAuth: true },
    });

    if (existing?.role === Role.ADMIN) {
      throw new Error(`Refusing to reuse an admin account for browser audit login: ${email}`);
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        emailVerified: now,
        role: Role.USER,
        userAuth: existing?.userAuth
          ? {
              update: {
                passwordHash,
                passwordUpdatedAt: now,
                failedLoginAttempts: 0,
                lockedUntil: null,
              },
            }
          : {
              create: {
                passwordHash,
                passwordUpdatedAt: now,
              },
            },
      },
      create: {
        name,
        email,
        emailVerified: now,
        role: Role.USER,
        userAuth: {
          create: {
            passwordHash,
            passwordUpdatedAt: now,
          },
        },
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ops.browser_audit_account_provisioned",
        metadataJson: {
          email,
          environment,
          localEnvFile: localEnvPath,
        },
      },
    });

    const baseUrl = resolveBaseUrl(environment, env);
    const existingEnv = existsSync(localEnvPath) ? parseEnvFile(localEnvPath) : {};
    const preservedEntries = Object.fromEntries(
      Object.entries(existingEnv).filter(([key]) => !["JOURNEY_EMAIL", "JOURNEY_PASSWORD", "JOURNEY_BASE_URL"].includes(key)),
    );

    const nextEnv = {
      ...preservedEntries,
      JOURNEY_EMAIL: email,
      JOURNEY_PASSWORD: password,
    };

    if (baseUrl) {
      nextEnv.JOURNEY_BASE_URL = baseUrl;
    }

    const localEnvContent = [
      "# Local browser audit credentials for ZoKorp CLI checks.",
      "# This file is git-ignored and can be rotated by re-running the provisioning command.",
      serializeEnvFile(nextEnv).trimEnd(),
      "",
    ].join("\n");

    writeFileSync(localEnvPath, localEnvContent, "utf8");

    console.log(`Provisioned browser audit account for ${environment}.`);
    console.log(`Email: ${email}`);
    console.log(`Verified: ${user.emailVerified?.toISOString() ?? "unknown"}`);
    console.log(`Credentials file: ${localEnvPath}`);
    console.log(`Next command: ${suggestedNextCommand({ environment, localEnvPath })}`);
  } finally {
    await prisma?.$disconnect();
    pulled?.cleanup?.();
  }
}

main().catch((error) => {
  console.error("Unable to provision browser audit account:", error instanceof Error ? error.message : error);
  process.exit(1);
});
