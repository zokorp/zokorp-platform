import { db } from "@/lib/db";
import { getAppSiteUrl, getMarketingSiteUrl, siteConfig } from "@/lib/site";

export type PublicHealthReport = {
  status: "ok" | "degraded";
  service: string;
  checkedAt: string;
  environment: string;
  revision: string | null;
  observedHost: string | null;
  hosts: {
    marketing: string;
    app: string;
  };
  checks: {
    app: "ok";
    database: "ok" | "error";
  };
};

function buildReport(input: {
  observedHost: string | null;
  database: "ok" | "error";
}): PublicHealthReport {
  return {
    status: input.database === "ok" ? "ok" : "degraded",
    service: siteConfig.name,
    checkedAt: new Date().toISOString(),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    revision: process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null,
    observedHost: input.observedHost,
    hosts: {
      marketing: getMarketingSiteUrl(),
      app: getAppSiteUrl(),
    },
    checks: {
      app: "ok",
      database: input.database,
    },
  };
}

export async function buildPublicHealthReport(input: {
  observedHost?: string | null;
} = {}) {
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return buildReport({
      observedHost: input.observedHost ?? null,
      database: "ok",
    });
  } catch {
    return buildReport({
      observedHost: input.observedHost ?? null,
      database: "error",
    });
  }
}
