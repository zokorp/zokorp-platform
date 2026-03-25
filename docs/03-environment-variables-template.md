# Environment Variables Contract

Use `.env.example` as the editable starter for local development. This document is the human-readable contract for what each variable does, which ones are secrets, and which environments actually need them.

Do not commit real secrets.

## Public non-secret config

These values can ship to the browser or public metadata surfaces.

- `NEXT_PUBLIC_SITE_URL`
  - Purpose: canonical site origin used by metadata, CTA links, and fallback URL generation.
  - Local: usually `http://localhost:3000`.
  - Production: final public origin.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  - Purpose: optional Google Analytics measurement ID.
  - Local: usually empty.
  - Production: set only when GA is approved.
- `GOOGLE_SITE_VERIFICATION`
  - Purpose: optional Google Search Console verification token.
- `BING_SITE_VERIFICATION`
  - Purpose: optional Bing verification token.
- `PUBLIC_SUBSCRIPTION_PRICING_APPROVED`
  - Purpose: non-secret launch flag that controls whether subscription pricing can appear in public UI.
  - Default: unset or `false`.
  - Production: set to `true` only after pricing, refund posture, and tax setup are approved.

## Core app and auth

These values are required for a normal local app and production runtime.

- `DATABASE_URL`
  - Secret: yes.
  - Purpose: Prisma/Postgres connection string.
- `NEXTAUTH_SECRET`
  - Secret: yes.
  - Purpose: canonical auth/session secret for NextAuth and several signed internal flows.
- `AUTH_SECRET`
  - Secret: yes.
  - Purpose: legacy fallback for auth secret lookup. Prefer `NEXTAUTH_SECRET`.
- `NEXTAUTH_URL`
  - Secret: no.
  - Purpose: explicit auth callback base URL. Useful locally and in some deployments.
- `ARCHIVE_ENCRYPTION_SECRET`
  - Secret: yes.
  - Purpose: encrypts opt-in archived tool payloads at rest.
  - Production guidance: set this explicitly and keep it distinct from auth, cron, and provider webhook secrets.
- `AUTH_PASSWORD_ENABLED`
  - Secret: no.
  - Purpose: enables the credentials login flow. Defaults to enabled unless set to a false-like value.

## Email delivery

These values control verification, password reset, and tool-result delivery.

- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`
  - Secret: host/user/password are secrets; `EMAIL_FROM` is not.
  - Purpose: SMTP path for auth emails and fallback delivery.
- `RESEND_API_KEY`
  - Secret: yes.
  - Purpose: preferred provider key for result-email delivery where Resend is used.
- `RESEND_FROM_EMAIL`
  - Secret: no.
  - Purpose: sender identity for Resend-delivered emails.

If these are missing, login-related email flows and some tool-result delivery paths will be unavailable. The UI should still load, but those workflows will degrade or stop.

## Stripe and billing

These values are required for checkout, webhook verification, and billing-driven entitlements.

- `STRIPE_SECRET_KEY`
  - Secret: yes.
  - Purpose: server-side Stripe API access.
- `STRIPE_WEBHOOK_SECRET`
  - Secret: yes.
  - Purpose: Stripe webhook signature verification.
- `STRIPE_PRICE_ID_FTR_SINGLE`
- `STRIPE_PRICE_ID_SDP_SRP_SINGLE`
- `STRIPE_PRICE_ID_COMPETENCY_REVIEW`
- `STRIPE_PRICE_ID_PLATFORM_MONTHLY`
- `STRIPE_PRICE_ID_PLATFORM_ANNUAL`
  - Secret: no, but operationally sensitive.
  - Purpose: map current product prices to checkout and entitlement logic.

Price IDs can exist before public display. Subscription prices should still stay hidden publicly until `PUBLIC_SUBSCRIPTION_PRICING_APPROVED=true`.

## Upload and diagnostic controls

- `UPLOAD_MAX_MB`
  - Secret: no.
  - Purpose: default upload size cap used across routes.
- `ARCHITECTURE_REVIEW_UPLOAD_MAX_MB`
  - Secret: no.
  - Purpose: architecture-review-specific upload cap.
- `ARCH_REVIEW_DAILY_LIMIT`
  - Secret: no.
  - Purpose: rate cap for architecture review submissions.
- `ARCH_REVIEW_RATE_USD_PER_HOUR`
  - Secret: no.
  - Purpose: internal pricing input for architecture-review quote math.

## Architecture review worker, follow-up, and CTA signing

- `ARCH_REVIEW_EML_SECRET`
  - Secret: yes.
  - Purpose: signs fallback `.eml` download flows and related review artifacts.
- `ARCH_REVIEW_CTA_SECRET`
  - Secret: yes.
  - Purpose: signs architecture-review CTA links.
- `ARCH_REVIEW_WORKER_SECRET`
  - Secret: yes.
  - Purpose: authenticates the architecture worker route.
- `ARCH_REVIEW_FOLLOWUP_SECRET`
  - Secret: yes.
  - Purpose: authenticates the architecture follow-up sender route.
  - Production guidance: set this explicitly and keep it distinct from `ZOHO_SYNC_SECRET`. The route still accepts `ZOHO_SYNC_SECRET` as a temporary compatibility fallback today, but that fallback should not be relied on for long-term production posture.
- `CRON_SECRET`
  - Secret: yes.
  - Purpose: authenticates Vercel cron invocations for retention sweeps and any future cron-compatible internal routes.
  - Production guidance: on the current Hobby deployment, Vercel cron is used only for the daily retention sweep. Higher-frequency internal jobs remain scheduled through GitHub Actions. Vercel cron sends this as `Authorization: Bearer <CRON_SECRET>`; keep it distinct from worker, follow-up, and provider webhook secrets.
- `ARCH_REVIEW_BOOK_CALL_URL`
  - Secret: no.
  - Purpose: operator-controlled CTA destination for booking.
- `ARCH_REVIEW_REMEDIATION_PLAN_URL`
  - Secret: no.
  - Purpose: operator-controlled remediation CTA destination.
- `CALENDLY_SYNC_SECRET`
  - Secret: yes.
  - Purpose: authenticates the internal booked-call ingest route used by the GitHub Actions Calendly poller.
  - Production guidance: keep this distinct from `CRON_SECRET`, `ARCH_REVIEW_WORKER_SECRET`, and `CALENDLY_WEBHOOK_SIGNING_KEY`.
- `CALENDLY_WEBHOOK_SIGNING_KEY`
  - Secret: yes.
  - Purpose: verifies signed Calendly webhook deliveries for booked-call automation.
  - Production guidance: this is optional on the current free-plan posture. Set it only if Calendly webhook automation is enabled on a paid Calendly subscription, and keep it distinct from `CRON_SECRET` and `CALENDLY_SYNC_SECRET`.

### GitHub Actions-only secrets for free Calendly polling

These are not application runtime env vars; they live in GitHub Actions secrets.

- `CALENDLY_PERSONAL_ACCESS_TOKEN`
  - Secret: yes.
  - Purpose: authenticates the scheduled GitHub Actions poller against the Calendly API for free-plan booked-call sync.
- `CALENDLY_SYNC_INGEST_URL`
  - Secret: yes.
  - Purpose: target URL for the internal booked-call ingest route, typically `https://app.zokorp.com/api/internal/calendly/booked-call`.

## Zoho CRM and WorkDrive

These values are needed only when CRM sync and WorkDrive archival are enabled.

- `ZOHO_SYNC_SECRET`
  - Secret: yes.
  - Purpose: authenticates the Zoho lead-sync route.
  - Production guidance: keep this secret dedicated to the Zoho sync job rather than reusing it across unrelated internal routes.
- `ZOHO_CRM_ACCESS_TOKEN`
- `ZOHO_CRM_REFRESH_TOKEN`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
  - Secret: yes.
  - Purpose: Zoho CRM API access and token refresh.
- `ZOHO_CRM_API_DOMAIN`
- `ZOHO_ACCOUNTS_DOMAIN`
  - Secret: no.
  - Purpose: Zoho API/account endpoints.
- `ZOHO_WORKDRIVE_FOLDER_ID`
  - Secret: operationally sensitive.
  - Purpose: target folder for archival uploads.
- `ZOHO_WORKDRIVE_ACCESS_TOKEN`
- `ZOHO_WORKDRIVE_REFRESH_TOKEN`
- `ZOHO_WORKDRIVE_CLIENT_ID`
- `ZOHO_WORKDRIVE_CLIENT_SECRET`
  - Secret: yes.
  - Purpose: WorkDrive API access.
- `ZOHO_WORKDRIVE_BASE_API_URI`
- `ZOHO_WORKDRIVE_ACCOUNTS_DOMAIN`
  - Secret: no.
  - Purpose: WorkDrive endpoint overrides.

## Admin and operator config

- `ZOKORP_ADMIN_EMAILS`
  - Secret: no.
  - Purpose: comma-separated admin email allowlist.
  - Behavior: only verified allowlisted accounts receive admin workspace access; the same allowlist is also the source of truth for any explicit admin testing overrides on paid tools.
- `SMOKE_BASE_URL`
  - Secret: no.
  - Purpose: override target for route smoke checks.
- `SMOKE_TIMEOUT_MS`
  - Secret: no.
  - Purpose: smoke-check timeout override.

## GitHub Actions deployment and migration secrets

These are not app runtime env vars. They exist so manual GitHub workflows can operate safely against production.

- `PRODUCTION_DIRECT_DATABASE_URL`
  - Secret: yes.
  - Scope: GitHub Actions `production` environment secret.
  - Purpose: preferred direct Postgres connection string for production Prisma migrations.
  - Format: must start with `postgres://` or `postgresql://`.
  - Guidance: for Supabase, prefer the direct connection string over a pooled URL for migration workflows.
- `PRODUCTION_DATABASE_URL`
  - Secret: yes.
  - Scope: GitHub Actions `production` environment secret.
  - Purpose: fallback production Postgres connection string for the manual migration workflow if a dedicated direct URL secret is not set.
  - Format: must start with `postgres://` or `postgresql://`.

## Minimum local setup

Use this set to boot the app and develop most UI flows:

- `NEXT_PUBLIC_SITE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `AUTH_PASSWORD_ENABLED`

Recommended local additions:

- SMTP values plus `EMAIL_FROM` if you want verification and password reset to work
- Stripe secret + webhook secret + price IDs if you want billing flows
- `ARCH_REVIEW_*` secrets if you want worker and CTA flows
- `ZOHO_*` values only if you are testing CRM or WorkDrive integration

## Production-required baseline

Before production is considered launch-ready, confirm:

- core app/auth values are set
- email delivery is configured
- Stripe secret, webhook secret, and live-approved price IDs are configured
- worker and scheduled-route secrets are configured
- archive encryption and booking webhook secrets are configured when those features are enabled
- Zoho credentials are configured if CRM/archival automation is expected
- public pricing approval flag is intentionally set or intentionally left off

## Source of truth notes

- `.env.example` should stay aligned with this document.
- `lib/env.ts` is only a partial env validator today and should not be treated as the complete contract yet.
- When this document and runtime behavior diverge, fix the document or the runtime immediately rather than letting both drift.
