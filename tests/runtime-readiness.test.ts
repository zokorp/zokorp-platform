import { describe, expect, it } from "vitest";

import { buildRuntimeReadinessReport } from "@/lib/runtime-readiness";

function findCheck(
  report: ReturnType<typeof buildRuntimeReadinessReport>,
  id: string,
) {
  for (const section of report.sections) {
    const check = section.checks.find((entry) => entry.id === id);
    if (check) {
      return check;
    }
  }

  throw new Error(`Missing check ${id}`);
}

describe("runtime readiness report", () => {
  it("flags reused scheduled-job secrets as a failure", () => {
    const report = buildRuntimeReadinessReport({
      NEXTAUTH_SECRET: "nextauth-secret",
      NEXTAUTH_URL: "https://app.zokorp.com",
      NEXT_PUBLIC_SITE_URL: "https://app.zokorp.com",
      AUTH_PASSWORD_ENABLED: "false",
      ARCH_REVIEW_FOLLOWUP_SECRET: "shared-secret",
      ZOHO_SYNC_SECRET: "shared-secret",
    });

    expect(findCheck(report, "scheduled-secret-separation")).toMatchObject({
      level: "fail",
    });
  });

  it("warns when password auth is enabled without SMTP and only AUTH_SECRET fallback is present", () => {
    const report = buildRuntimeReadinessReport({
      AUTH_SECRET: "legacy-secret",
      NEXTAUTH_URL: "https://app.zokorp.com",
      NEXT_PUBLIC_SITE_URL: "https://app.zokorp.com",
      AUTH_PASSWORD_ENABLED: "true",
    });

    expect(findCheck(report, "auth-secret")).toMatchObject({
      level: "warning",
    });
    expect(findCheck(report, "password-email-delivery")).toMatchObject({
      level: "warning",
    });
  });

  it("fails when NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL do not align", () => {
    const report = buildRuntimeReadinessReport({
      NEXTAUTH_SECRET: "nextauth-secret",
      NEXTAUTH_URL: "https://auth.zokorp.com",
      NEXT_PUBLIC_SITE_URL: "https://app.zokorp.com",
      AUTH_PASSWORD_ENABLED: "false",
    });

    expect(findCheck(report, "auth-origin-alignment")).toMatchObject({
      level: "fail",
      details: [
        "NEXTAUTH_URL origin: https://auth.zokorp.com",
        "NEXT_PUBLIC_SITE_URL origin: https://app.zokorp.com",
      ],
    });
  });

  it("treats partial Stripe secret configuration as a failure", () => {
    const report = buildRuntimeReadinessReport({
      NEXTAUTH_SECRET: "nextauth-secret",
      NEXTAUTH_URL: "https://app.zokorp.com",
      NEXT_PUBLIC_SITE_URL: "https://app.zokorp.com",
      AUTH_PASSWORD_ENABLED: "false",
      STRIPE_SECRET_KEY: "sk_live_123",
    });

    expect(findCheck(report, "stripe-core")).toMatchObject({
      level: "fail",
    });
  });

  it("passes the main checks when critical runtime config is present and separated", () => {
    const report = buildRuntimeReadinessReport({
      NEXTAUTH_SECRET: "nextauth-secret",
      NEXTAUTH_URL: "https://app.zokorp.com",
      NEXT_PUBLIC_SITE_URL: "https://app.zokorp.com",
      AUTH_PASSWORD_ENABLED: "true",
      EMAIL_SERVER_HOST: "smtp.example.com",
      EMAIL_SERVER_PORT: "587",
      EMAIL_SERVER_USER: "user",
      EMAIL_SERVER_PASSWORD: "password",
      EMAIL_FROM: "hello@zokorp.com",
      STRIPE_SECRET_KEY: "sk_live_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      STRIPE_PRICE_ID_FTR_SINGLE: "price_ftr",
      STRIPE_PRICE_ID_SDP_SRP_SINGLE: "price_sdp",
      STRIPE_PRICE_ID_COMPETENCY_REVIEW: "price_comp",
      STRIPE_PRICE_ID_PLATFORM_MONTHLY: "price_monthly",
      STRIPE_PRICE_ID_PLATFORM_ANNUAL: "price_annual",
      ARCH_REVIEW_WORKER_SECRET: "worker-secret",
      ARCH_REVIEW_FOLLOWUP_SECRET: "followup-secret",
      ZOHO_SYNC_SECRET: "zoho-secret",
      CALENDLY_SYNC_SECRET: "calendly-secret",
      RESEND_API_KEY: "re_123",
      RESEND_FROM_EMAIL: "hello@zokorp.com",
      ZOHO_CRM_ACCESS_TOKEN: "crm-token",
      ZOHO_WORKDRIVE_FOLDER_ID: "folder_123",
      ZOHO_WORKDRIVE_ACCESS_TOKEN: "workdrive-token",
      ZOKORP_ADMIN_EMAILS: "ops@zokorp.com",
    });

    expect(findCheck(report, "auth-secret")).toMatchObject({ level: "pass" });
    expect(findCheck(report, "stripe-core")).toMatchObject({ level: "pass" });
    expect(findCheck(report, "scheduled-secret-separation")).toMatchObject({ level: "pass" });
    expect(findCheck(report, "calendly-sync-secret")).toMatchObject({ level: "pass" });
    expect(findCheck(report, "zoho-workdrive")).toMatchObject({ level: "pass" });
    expect(report.totals.fail).toBe(0);
  });
});
