export type ReadinessLevel = "pass" | "warning" | "fail";

type RuntimeEnv = Record<string, string | undefined>;

export type ReadinessCheck = {
  id: string;
  label: string;
  level: ReadinessLevel;
  summary: string;
  details?: string[];
  operatorAction?: string;
};

export type ReadinessSection = {
  id: string;
  label: string;
  checks: ReadinessCheck[];
};

export type RuntimeReadinessReport = {
  sections: ReadinessSection[];
  totals: {
    pass: number;
    warning: number;
    fail: number;
  };
};

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function originOf(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function isTruthy(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return !["0", "false", "off", "no", "disabled"].includes(normalized);
}

function totalByLevel(sections: ReadinessSection[], level: ReadinessLevel) {
  return sections.reduce(
    (count, section) => count + section.checks.filter((check) => check.level === level).length,
    0,
  );
}

export function buildRuntimeReadinessReport(env: RuntimeEnv = process.env): RuntimeReadinessReport {
  const passwordAuthEnabled = isTruthy(env.AUTH_PASSWORD_ENABLED, true);
  const nextAuthSecretConfigured = configured(env.NEXTAUTH_SECRET);
  const authSecretFallbackConfigured = configured(env.AUTH_SECRET);
  const nextAuthOrigin = originOf(env.NEXTAUTH_URL);
  const siteOrigin = originOf(env.NEXT_PUBLIC_SITE_URL);
  const smtpConfigured =
    configured(env.EMAIL_SERVER_HOST) &&
    configured(env.EMAIL_SERVER_PORT) &&
    configured(env.EMAIL_SERVER_USER) &&
    configured(env.EMAIL_SERVER_PASSWORD) &&
    configured(env.EMAIL_FROM);
  const resendConfigured = configured(env.RESEND_API_KEY) && configured(env.RESEND_FROM_EMAIL);
  const stripeSecretConfigured = configured(env.STRIPE_SECRET_KEY);
  const stripeWebhookConfigured = configured(env.STRIPE_WEBHOOK_SECRET);
  const priceIds = [
    env.STRIPE_PRICE_ID_FTR_SINGLE,
    env.STRIPE_PRICE_ID_SDP_SRP_SINGLE,
    env.STRIPE_PRICE_ID_COMPETENCY_REVIEW,
    env.STRIPE_PRICE_ID_PLATFORM_MONTHLY,
    env.STRIPE_PRICE_ID_PLATFORM_ANNUAL,
  ];
  const configuredPriceIds = priceIds.filter(configured).length;
  const archWorkerSecretConfigured = configured(env.ARCH_REVIEW_WORKER_SECRET);
  const followupSecretConfigured = configured(env.ARCH_REVIEW_FOLLOWUP_SECRET);
  const zohoSyncSecretConfigured = configured(env.ZOHO_SYNC_SECRET);
  const followupAndZohoSecretsEqual =
    followupSecretConfigured &&
    zohoSyncSecretConfigured &&
    env.ARCH_REVIEW_FOLLOWUP_SECRET === env.ZOHO_SYNC_SECRET;
  const zohoDirectAccessConfigured = configured(env.ZOHO_CRM_ACCESS_TOKEN);
  const zohoRefreshConfigured =
    configured(env.ZOHO_CRM_REFRESH_TOKEN) &&
    configured(env.ZOHO_CLIENT_ID) &&
    configured(env.ZOHO_CLIENT_SECRET);
  const workdriveDirectAccessConfigured = configured(env.ZOHO_WORKDRIVE_ACCESS_TOKEN);
  const workdriveRefreshConfigured =
    configured(env.ZOHO_WORKDRIVE_REFRESH_TOKEN) &&
    configured(env.ZOHO_WORKDRIVE_CLIENT_ID) &&
    configured(env.ZOHO_WORKDRIVE_CLIENT_SECRET);
  const workdriveFolderConfigured = configured(env.ZOHO_WORKDRIVE_FOLDER_ID);
  const adminAllowlistConfigured = configured(env.ZOKORP_ADMIN_EMAILS);

  const sections: ReadinessSection[] = [
    {
      id: "auth",
      label: "Auth and Identity",
      checks: [
        nextAuthSecretConfigured
          ? {
              id: "auth-secret",
              label: "Primary auth secret",
              level: "pass",
              summary: "NEXTAUTH_SECRET is configured.",
            }
          : authSecretFallbackConfigured
            ? {
                id: "auth-secret",
                label: "Primary auth secret",
                level: "warning",
                summary: "Runtime is still relying on AUTH_SECRET fallback instead of NEXTAUTH_SECRET.",
                operatorAction: "Set NEXTAUTH_SECRET explicitly in every deployed environment.",
              }
            : {
                id: "auth-secret",
                label: "Primary auth secret",
                level: "fail",
                summary: "No auth secret is configured.",
                operatorAction: "Set NEXTAUTH_SECRET before treating auth/session flows as production-ready.",
              },
        nextAuthOrigin && siteOrigin
          ? nextAuthOrigin === siteOrigin
            ? {
                id: "auth-origin-alignment",
                label: "Callback origin alignment",
                level: "pass",
                summary: "NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL resolve to the same origin.",
              }
            : {
                id: "auth-origin-alignment",
                label: "Callback origin alignment",
                level: "fail",
                summary: "NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL point at different origins.",
                details: [`NEXTAUTH_URL origin: ${nextAuthOrigin}`, `NEXT_PUBLIC_SITE_URL origin: ${siteOrigin}`],
                operatorAction: "Align auth callback and canonical site origins to avoid redirect and origin-check drift.",
              }
          : {
              id: "auth-origin-alignment",
              label: "Callback origin alignment",
              level: "warning",
              summary: "NEXTAUTH_URL or NEXT_PUBLIC_SITE_URL is missing or not a valid URL.",
              operatorAction: "Set both origins explicitly in deployed environments.",
            },
        passwordAuthEnabled
          ? smtpConfigured
            ? {
                id: "password-email-delivery",
                label: "Password auth email delivery",
                level: "pass",
                summary: "Password auth is enabled and SMTP verification/reset delivery is configured.",
              }
            : {
                id: "password-email-delivery",
                label: "Password auth email delivery",
                level: "warning",
                summary: "Password auth is enabled but SMTP email delivery is incomplete.",
                operatorAction: "Configure EMAIL_SERVER_* and EMAIL_FROM or disable password auth intentionally.",
              }
          : {
              id: "password-email-delivery",
              label: "Password auth email delivery",
              level: "pass",
              summary: "Password auth is disabled, so SMTP verification/reset delivery is not required.",
            },
      ],
    },
    {
      id: "billing",
      label: "Billing",
      checks: [
        stripeSecretConfigured && stripeWebhookConfigured
          ? {
              id: "stripe-core",
              label: "Stripe runtime secrets",
              level: "pass",
              summary: "Stripe API and webhook secrets are both configured.",
            }
          : stripeSecretConfigured || stripeWebhookConfigured
            ? {
                id: "stripe-core",
                label: "Stripe runtime secrets",
                level: "fail",
                summary: "Stripe is only partially configured.",
                operatorAction: "Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET together.",
              }
            : {
                id: "stripe-core",
                label: "Stripe runtime secrets",
                level: "warning",
                summary: "Stripe runtime secrets are not configured in this environment.",
                operatorAction: "Configure Stripe secrets before enabling live billing flows here.",
              },
        configuredPriceIds === priceIds.length
          ? {
              id: "stripe-price-ids",
              label: "Stripe price map",
              level: "pass",
              summary: "Core Stripe price IDs are configured.",
            }
          : {
              id: "stripe-price-ids",
              label: "Stripe price map",
              level: "warning",
              summary: `${configuredPriceIds}/${priceIds.length} core Stripe price IDs are configured.`,
              operatorAction: "Finish the Stripe product/price map before treating billing as launch-ready.",
            },
      ],
    },
    {
      id: "internal-jobs",
      label: "Internal Jobs and Secrets",
      checks: [
        archWorkerSecretConfigured
          ? {
              id: "arch-worker-secret",
              label: "Architecture worker secret",
              level: "pass",
              summary: "ARCH_REVIEW_WORKER_SECRET is configured.",
            }
          : {
              id: "arch-worker-secret",
              label: "Architecture worker secret",
              level: "warning",
              summary: "ARCH_REVIEW_WORKER_SECRET is missing.",
              operatorAction: "Set the worker secret before relying on the scheduled queue drain.",
            },
        followupSecretConfigured
          ? {
              id: "arch-followup-secret",
              label: "Follow-up route secret",
              level: "pass",
              summary: "ARCH_REVIEW_FOLLOWUP_SECRET is configured explicitly.",
            }
          : zohoSyncSecretConfigured
            ? {
                id: "arch-followup-secret",
                label: "Follow-up route secret",
                level: "warning",
                summary: "ARCH_REVIEW_FOLLOWUP_SECRET is missing, so the follow-up route will fall back to ZOHO_SYNC_SECRET.",
                operatorAction: "Set a dedicated ARCH_REVIEW_FOLLOWUP_SECRET before removing the compatibility fallback.",
              }
            : {
                id: "arch-followup-secret",
                label: "Follow-up route secret",
                level: "warning",
                summary: "ARCH_REVIEW_FOLLOWUP_SECRET is missing.",
                operatorAction: "Set a dedicated follow-up secret before relying on the scheduled follow-up route.",
              },
        zohoSyncSecretConfigured
          ? {
              id: "zoho-sync-secret",
              label: "Zoho sync route secret",
              level: "pass",
              summary: "ZOHO_SYNC_SECRET is configured.",
            }
          : {
              id: "zoho-sync-secret",
              label: "Zoho sync route secret",
              level: "warning",
              summary: "ZOHO_SYNC_SECRET is missing.",
              operatorAction: "Set the Zoho sync secret before relying on the scheduled lead-sync route.",
            },
        followupAndZohoSecretsEqual
          ? {
              id: "scheduled-secret-separation",
              label: "Scheduled route secret separation",
              level: "fail",
              summary: "ARCH_REVIEW_FOLLOWUP_SECRET and ZOHO_SYNC_SECRET are configured to the same value.",
              operatorAction: "Rotate one of the secrets so follow-ups and Zoho sync do not share a bearer secret.",
            }
          : followupSecretConfigured && zohoSyncSecretConfigured
            ? {
                id: "scheduled-secret-separation",
                label: "Scheduled route secret separation",
                level: "pass",
                summary: "Dedicated follow-up and Zoho sync secrets are configured separately.",
              }
            : {
                id: "scheduled-secret-separation",
                label: "Scheduled route secret separation",
                level: "warning",
                summary: "Secret separation cannot be fully verified until both dedicated secrets are configured.",
              },
      ],
    },
    {
      id: "integrations",
      label: "Email and External Integrations",
      checks: [
        resendConfigured || smtpConfigured
          ? {
              id: "email-provider",
              label: "Result email provider",
              level: "pass",
              summary: resendConfigured
                ? "Resend is configured for result delivery."
                : "SMTP is configured for email delivery.",
            }
          : {
              id: "email-provider",
              label: "Result email provider",
              level: "warning",
              summary: "No result-email provider is fully configured.",
              operatorAction: "Configure Resend or SMTP before relying on verification, resets, or follow-up emails.",
            },
        zohoDirectAccessConfigured || zohoRefreshConfigured
          ? {
              id: "zoho-crm",
              label: "Zoho CRM credentials",
              level: "pass",
              summary: zohoDirectAccessConfigured
                ? "Zoho CRM direct access token is configured."
                : "Zoho CRM refresh-token credentials are configured.",
            }
          : {
              id: "zoho-crm",
              label: "Zoho CRM credentials",
              level: "warning",
              summary: "Zoho CRM credentials are not configured.",
              operatorAction: "Configure Zoho CRM credentials if lead sync is expected in this environment.",
            },
        workdriveFolderConfigured && (workdriveDirectAccessConfigured || workdriveRefreshConfigured)
          ? {
              id: "zoho-workdrive",
              label: "Zoho WorkDrive archival",
              level: "pass",
              summary: "WorkDrive folder and access credentials are configured.",
            }
          : workdriveFolderConfigured ||
              workdriveDirectAccessConfigured ||
              workdriveRefreshConfigured
            ? {
                id: "zoho-workdrive",
                label: "Zoho WorkDrive archival",
                level: "warning",
                summary: "WorkDrive archival is only partially configured.",
                operatorAction: "Set both the WorkDrive folder and access credentials, or disable archival intentionally.",
              }
            : {
                id: "zoho-workdrive",
                label: "Zoho WorkDrive archival",
                level: "warning",
                summary: "WorkDrive archival is not configured.",
                operatorAction: "Configure WorkDrive only if architecture-review archival is expected in this environment.",
              },
      ],
    },
    {
      id: "admin",
      label: "Admin and Manual Verification",
      checks: [
        adminAllowlistConfigured
          ? {
              id: "admin-allowlist",
              label: "Admin allowlist",
              level: "pass",
              summary: "ZOKORP_ADMIN_EMAILS is configured.",
            }
          : {
              id: "admin-allowlist",
              label: "Admin allowlist",
              level: "warning",
              summary: "ZOKORP_ADMIN_EMAILS is missing.",
              operatorAction: "Set the admin allowlist before expecting live admin access.",
            },
        {
          id: "manual-provider-verification",
          label: "Manual provider verification",
          level: "warning",
          summary: "Stripe dashboard binding, Zoho dashboard state, workflow URL values, and runtime response headers still require external verification.",
          operatorAction: "Use provider dashboards or header-aware tooling to verify masked secrets, endpoint targets, and production response headers.",
        },
      ],
    },
  ];

  return {
    sections,
    totals: {
      pass: totalByLevel(sections, "pass"),
      warning: totalByLevel(sections, "warning"),
      fail: totalByLevel(sections, "fail"),
    },
  };
}
