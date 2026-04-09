import { resolveZohoInvoiceRuntimeConfig } from "@/lib/zoho-invoice";

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

function zohoCredentialSourceLabel(source: "invoice" | "crm" | null) {
  if (source === "invoice") {
    return "invoice";
  }

  if (source === "crm") {
    return "CRM";
  }

  return "refresh";
}

export function buildRuntimeReadinessReport(env: RuntimeEnv = process.env): RuntimeReadinessReport {
  const passwordAuthEnabled = isTruthy(env.AUTH_PASSWORD_ENABLED, true);
  const nextAuthSecretConfigured = configured(env.NEXTAUTH_SECRET);
  const authSecretFallbackConfigured = configured(env.AUTH_SECRET);
  const nextAuthOrigin = originOf(env.NEXTAUTH_URL);
  const appOrigin = originOf(env.APP_SITE_URL) ?? originOf(env.NEXT_PUBLIC_SITE_URL);
  const marketingOrigin = originOf(env.MARKETING_SITE_URL);
  const smtpConfigured =
    configured(env.EMAIL_SERVER_HOST) &&
    configured(env.EMAIL_SERVER_PORT) &&
    configured(env.EMAIL_SERVER_USER) &&
    configured(env.EMAIL_SERVER_PASSWORD) &&
    configured(env.EMAIL_FROM);
  const resendConfigured = configured(env.RESEND_API_KEY) && configured(env.RESEND_FROM_EMAIL);
  const sentryServerConfigured = configured(env.SENTRY_DSN);
  const sentryClientConfigured = configured(env.NEXT_PUBLIC_SENTRY_DSN);
  const analyticsConfigured = configured(env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const stripeSecretConfigured = configured(env.STRIPE_SECRET_KEY);
  const stripeWebhookConfigured = configured(env.STRIPE_WEBHOOK_SECRET);
  const publicSubscriptionPricingApproved = env.PUBLIC_SUBSCRIPTION_PRICING_APPROVED === "true";
  const priceIds = [
    env.STRIPE_PRICE_ID_FTR_SINGLE,
    env.STRIPE_PRICE_ID_SDP_SRP_SINGLE,
    env.STRIPE_PRICE_ID_COMPETENCY_REVIEW,
    env.STRIPE_PRICE_ID_PLATFORM_MONTHLY,
    env.STRIPE_PRICE_ID_PLATFORM_ANNUAL,
  ];
  const configuredPriceIds = priceIds.filter(configured).length;
  const archWorkerSecretConfigured = configured(env.ARCH_REVIEW_WORKER_SECRET);
  const cronSecretConfigured = configured(env.CRON_SECRET);
  const archiveEncryptionSecretConfigured = configured(env.ARCHIVE_ENCRYPTION_SECRET);
  const archReviewEmlSecretConfigured = configured(env.ARCH_REVIEW_EML_SECRET);
  const archReviewCtaSecretConfigured = configured(env.ARCH_REVIEW_CTA_SECRET);
  const followupSecretConfigured = configured(env.ARCH_REVIEW_FOLLOWUP_SECRET);
  const zohoSyncSecretConfigured = configured(env.ZOHO_SYNC_SECRET);
  const calendlySyncSecretConfigured = configured(env.CALENDLY_SYNC_SECRET);
  const archiveFallingBackToNextAuth = !archiveEncryptionSecretConfigured && nextAuthSecretConfigured;
  const archReviewEmlFallingBackToNextAuth = !archReviewEmlSecretConfigured && nextAuthSecretConfigured;
  const archReviewCtaFallingBackToEml =
    !archReviewCtaSecretConfigured && archReviewEmlSecretConfigured;
  const archReviewCtaFallingBackToNextAuth =
    !archReviewCtaSecretConfigured && !archReviewEmlSecretConfigured && nextAuthSecretConfigured;
  const followupAndZohoSecretsEqual =
    followupSecretConfigured &&
    zohoSyncSecretConfigured &&
    env.ARCH_REVIEW_FOLLOWUP_SECRET === env.ZOHO_SYNC_SECRET;
  const zohoDirectAccessConfigured = configured(env.ZOHO_CRM_ACCESS_TOKEN);
  const zohoRefreshConfigured =
    configured(env.ZOHO_CRM_REFRESH_TOKEN) &&
    configured(env.ZOHO_CLIENT_ID) &&
    configured(env.ZOHO_CLIENT_SECRET);
  const zohoInvoiceConfig = resolveZohoInvoiceRuntimeConfig(env);
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
        nextAuthOrigin && appOrigin
          ? nextAuthOrigin === appOrigin
            ? {
                id: "auth-origin-alignment",
                label: "Callback origin alignment",
                level: "pass",
                summary: "NEXTAUTH_URL and the configured app origin resolve to the same origin.",
              }
            : {
                id: "auth-origin-alignment",
                label: "Callback origin alignment",
                level: "fail",
                summary: "NEXTAUTH_URL and the configured app origin point at different origins.",
                details: [`NEXTAUTH_URL origin: ${nextAuthOrigin}`, `App origin: ${appOrigin}`],
                operatorAction: "Align auth callback and app origins to avoid redirect and origin-check drift.",
              }
          : {
              id: "auth-origin-alignment",
              label: "Callback origin alignment",
              level: "warning",
              summary: "NEXTAUTH_URL or the app origin is missing or not a valid URL.",
              operatorAction: "Set NEXTAUTH_URL and APP_SITE_URL explicitly in deployed environments.",
            },
        marketingOrigin
          ? {
              id: "marketing-origin",
              label: "Canonical marketing origin",
              level: "pass",
              summary: "MARKETING_SITE_URL is configured.",
              details: [`Marketing origin: ${marketingOrigin}`],
            }
          : {
              id: "marketing-origin",
              label: "Canonical marketing origin",
              level: "warning",
              summary: "MARKETING_SITE_URL is missing or not a valid URL.",
              operatorAction: "Set MARKETING_SITE_URL explicitly so marketing canonicals and sitemap output stay stable.",
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
        publicSubscriptionPricingApproved
          ? {
              id: "subscription-pricing-approval",
              label: "Public subscription pricing approval",
              level: "pass",
              summary: "Public subscription pricing is approved for subscription product surfaces.",
            }
          : {
              id: "subscription-pricing-approval",
              label: "Public subscription pricing approval",
              level: "warning",
              summary: "Subscription pricing is still gated behind the launch approval flag.",
              operatorAction: "Set PUBLIC_SUBSCRIPTION_PRICING_APPROVED=true only when the public subscription offer is ready to launch.",
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
        cronSecretConfigured
          ? {
              id: "cron-secret",
              label: "Cron route secret",
              level: "pass",
              summary: "CRON_SECRET is configured for internal scheduled routes.",
            }
          : {
              id: "cron-secret",
              label: "Cron route secret",
              level: "warning",
              summary: "CRON_SECRET is missing.",
              operatorAction: "Set CRON_SECRET before relying on Vercel cron or any internal scheduled route protection.",
            },
        archiveEncryptionSecretConfigured
          ? {
              id: "archive-encryption-secret",
              label: "Archive encryption secret",
              level: "pass",
              summary: "ARCHIVE_ENCRYPTION_SECRET is configured explicitly.",
            }
          : archiveFallingBackToNextAuth
            ? {
                id: "archive-encryption-secret",
                label: "Archive encryption secret",
                level: "warning",
                summary: "ARCHIVE_ENCRYPTION_SECRET is missing, so archive encryption falls back to NEXTAUTH_SECRET.",
                operatorAction: "Set a dedicated ARCHIVE_ENCRYPTION_SECRET so archive confidentiality does not share the auth secret boundary.",
              }
            : {
                id: "archive-encryption-secret",
                label: "Archive encryption secret",
                level: "fail",
                summary: "ARCHIVE_ENCRYPTION_SECRET is missing.",
                operatorAction: "Set a dedicated archive encryption secret before relying on encrypted archival flows.",
              },
        archReviewEmlSecretConfigured
          ? {
              id: "arch-review-eml-secret",
              label: "Architecture .eml secret",
              level: "pass",
              summary: "ARCH_REVIEW_EML_SECRET is configured explicitly.",
            }
          : archReviewEmlFallingBackToNextAuth
            ? {
                id: "arch-review-eml-secret",
                label: "Architecture .eml secret",
                level: "warning",
                summary: "ARCH_REVIEW_EML_SECRET is missing, so signed .eml downloads fall back to NEXTAUTH_SECRET.",
                operatorAction: "Set a dedicated ARCH_REVIEW_EML_SECRET so signed email artifacts do not share the auth secret boundary.",
              }
            : {
                id: "arch-review-eml-secret",
                label: "Architecture .eml secret",
                level: "fail",
                summary: "ARCH_REVIEW_EML_SECRET is missing.",
                operatorAction: "Set a dedicated .eml secret before relying on fallback email downloads.",
              },
        archReviewCtaSecretConfigured
          ? {
              id: "arch-review-cta-secret",
              label: "Architecture CTA signing secret",
              level: "pass",
              summary: "ARCH_REVIEW_CTA_SECRET is configured explicitly.",
            }
          : archReviewCtaFallingBackToEml
            ? {
                id: "arch-review-cta-secret",
                label: "Architecture CTA signing secret",
                level: "warning",
                summary: "ARCH_REVIEW_CTA_SECRET is missing, so CTA signing falls back to ARCH_REVIEW_EML_SECRET.",
                operatorAction: "Set a dedicated ARCH_REVIEW_CTA_SECRET so CTA links do not share the .eml signing boundary.",
              }
            : archReviewCtaFallingBackToNextAuth
              ? {
                  id: "arch-review-cta-secret",
                  label: "Architecture CTA signing secret",
                  level: "warning",
                  summary: "ARCH_REVIEW_CTA_SECRET is missing, so CTA signing falls back to NEXTAUTH_SECRET.",
                  operatorAction: "Set a dedicated ARCH_REVIEW_CTA_SECRET so CTA links do not share the auth secret boundary.",
                }
              : {
                  id: "arch-review-cta-secret",
                  label: "Architecture CTA signing secret",
                  level: "fail",
                  summary: "ARCH_REVIEW_CTA_SECRET is missing.",
                  operatorAction: "Set a dedicated CTA signing secret before relying on architecture follow-up links.",
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
        calendlySyncSecretConfigured
          ? {
              id: "calendly-sync-secret",
              label: "Calendly sync ingest secret",
              level: "pass",
              summary: "CALENDLY_SYNC_SECRET is configured.",
            }
          : {
              id: "calendly-sync-secret",
              label: "Calendly sync ingest secret",
              level: "warning",
              summary: "CALENDLY_SYNC_SECRET is missing.",
              operatorAction: "Set the Calendly sync secret before relying on the free-plan booked-call poller.",
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
        zohoInvoiceConfig.isConfigured
          ? {
              id: "zoho-invoice",
              label: "Zoho Invoice estimate companion",
              level: "pass",
              summary: zohoInvoiceConfig.accessTokenSource
                ? `Zoho Invoice organization and ${zohoCredentialSourceLabel(zohoInvoiceConfig.accessTokenSource)} access token are configured.`
                : `Zoho Invoice organization and ${zohoCredentialSourceLabel(zohoInvoiceConfig.refreshTokenSource)} refresh-token credentials are configured.`,
              details: [
                `Organization ID: ${zohoInvoiceConfig.organizationId || "missing"}`,
                `Access token source: ${zohoInvoiceConfig.accessTokenSource ?? "none"}`,
                `Refresh token source: ${zohoInvoiceConfig.refreshTokenSource ?? "none"}`,
              ],
            }
          : zohoInvoiceConfig.organizationId ||
              zohoInvoiceConfig.accessToken ||
              zohoInvoiceConfig.refreshTokenSource
            ? {
                id: "zoho-invoice",
                label: "Zoho Invoice estimate companion",
                level: "warning",
                summary: "Zoho Invoice estimate companion is only partially configured.",
                details: [
                  `Organization ID: ${zohoInvoiceConfig.organizationId || "missing"}`,
                  `Access token source: ${zohoInvoiceConfig.accessTokenSource ?? "none"}`,
                  `Refresh token source: ${zohoInvoiceConfig.refreshTokenSource ?? "none"}`,
                ],
                operatorAction:
                  "Set ZOHO_INVOICE_ORGANIZATION_ID and either a direct token or refresh-token credentials before relying on automatic estimate mirroring.",
              }
            : {
                id: "zoho-invoice",
                label: "Zoho Invoice estimate companion",
                level: "warning",
                summary: "Zoho Invoice estimate companion is not configured.",
                details: [
                  `Access token source: ${zohoInvoiceConfig.accessTokenSource ?? "none"}`,
                  `Refresh token source: ${zohoInvoiceConfig.refreshTokenSource ?? "none"}`,
                ],
                operatorAction:
                  "Configure Zoho Invoice only if automatic formal estimate mirroring is expected in this environment.",
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
      id: "external-schedulers",
      label: "External Schedulers",
      checks: [
        {
          id: "github-actions-schedulers",
          label: "GitHub Actions scheduler dependencies",
          level: "warning",
          summary: "High-frequency jobs are operator-managed in GitHub Actions and cannot be verified from app runtime config alone.",
          details: [
            "Drain Architecture Review Queue -> ARCH_REVIEW_WORKER_URL + ARCH_REVIEW_WORKER_SECRET",
            "Architecture review follow-ups -> ARCH_REVIEW_FOLLOWUP_URL + ARCH_REVIEW_FOLLOWUP_SECRET",
            "Calendly booking sync -> CALENDLY_PERSONAL_ACCESS_TOKEN + CALENDLY_SYNC_INGEST_URL + CALENDLY_SYNC_SECRET",
            "Zoho lead sync -> ZOHO_SYNC_URL + ZOHO_SYNC_SECRET",
          ],
          operatorAction: "Verify repo-level secrets and recent successful workflow runs in GitHub Actions before declaring scheduler health.",
        },
      ],
    },
    {
      id: "monitoring",
      label: "Monitoring and Observability",
      checks: [
        sentryServerConfigured || sentryClientConfigured
          ? {
              id: "external-error-monitoring",
              label: "External error monitoring",
              level: "pass",
              summary: sentryServerConfigured && sentryClientConfigured
                ? "Server and browser Sentry DSNs are configured."
                : sentryServerConfigured
                  ? "Server-side Sentry DSN is configured."
                  : "Browser-side Sentry DSN is configured.",
            }
          : {
              id: "external-error-monitoring",
              label: "External error monitoring",
              level: "warning",
              summary: "No external error sink is configured. Runtime failures currently rely on internal audit records and platform logs.",
              operatorAction: "Add SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN only when you are ready to route browser and server errors to an external incident tool.",
            },
        analyticsConfigured
          ? {
              id: "visitor-analytics",
              label: "Visitor analytics",
              level: "pass",
              summary: "Google Analytics is configured for public traffic visibility.",
            }
          : {
              id: "visitor-analytics",
              label: "Visitor analytics",
              level: "warning",
              summary: "No visitor analytics signal is configured from runtime env.",
              operatorAction: "Set NEXT_PUBLIC_GA_MEASUREMENT_ID or enable a privacy-safe platform analytics tool before relying on passive traffic visibility.",
            },
        {
          id: "health-endpoint",
          label: "Public health endpoint",
          level: "pass",
          summary: "The app serves /api/health for uptime checks on the current deployment.",
        },
        {
          id: "internal-incident-feed",
          label: "Internal incident feed",
          level: "pass",
          summary: "Unhandled request failures, key route failures, and CSP signals are persisted into operator-visible audit records.",
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
