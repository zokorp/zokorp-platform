# ZoKorp Platform

Production-oriented Next.js platform for `zokorp.com` SaaS migration.

## Stack
- Next.js App Router + TypeScript + Tailwind
- NextAuth credentials authentication (business email + password)
- Prisma + Postgres
- Stripe Checkout + Webhooks + Customer Portal

## Product scope (current)
- Marketing pages: `/`, `/services`, `/case-studies`, `/media`
- Software catalog: `/software`, `/software/[slug]`
- Account pages: `/account`, `/account/billing`
- Admin pages: `/admin/products`, `/admin/prices`, `/admin/service-requests`
- Service request workflow: `/services#service-request` (submission) + account timeline tracking
- First tool: `ZoKorpValidator` (`zokorp-validator`) for PDF/XLSX input and text output
- Free assessment tools:
  - `Architecture Diagram Reviewer` (`architecture-diagram-reviewer`)
  - `Landing Zone Readiness Checker` (`landing-zone-readiness-checker`)

## Quick start
1. Install dependencies:
   - `npm install`
2. Configure env:
   - `cp .env.example .env.local`
   - set real values (do not commit secrets)
3. Prisma setup:
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
   - production deploys: `npm run prisma:migrate:deploy`
   - `npm run prisma:seed`
4. Start dev server:
   - `npm run dev`

## Quality commands
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Key environment variables
- Auth:
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `AUTH_PASSWORD_ENABLED`
- Email delivery:
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `EMAIL_SERVER_HOST`
  - `EMAIL_SERVER_PORT`
  - `EMAIL_SERVER_USER`
  - `EMAIL_SERVER_PASSWORD`
  - `EMAIL_FROM`
  - `ARCH_REVIEW_EML_SECRET`
- Database:
  - `DATABASE_URL`
- Stripe:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID_FTR_SINGLE`
  - `STRIPE_PRICE_ID_SDP_SRP_SINGLE`
  - `STRIPE_PRICE_ID_COMPETENCY_REVIEW`
  - `STRIPE_PRICE_ID_PLATFORM_MONTHLY`
  - `STRIPE_PRICE_ID_PLATFORM_ANNUAL`
- Admin/ops:
  - `ZOKORP_ADMIN_EMAILS`
  - `UPLOAD_MAX_MB`
  - `ZOHO_SYNC_SECRET`
  - `ZOHO_CRM_ACCESS_TOKEN`
  - `ZOHO_CRM_REFRESH_TOKEN`
  - `ZOHO_CLIENT_ID`
  - `ZOHO_CLIENT_SECRET`
  - `ZOHO_CRM_API_DOMAIN`
  - `ZOHO_ACCOUNTS_DOMAIN`
  - `ZOHO_WORKDRIVE_FOLDER_ID`
  - `ZOHO_WORKDRIVE_ACCESS_TOKEN`
  - `ZOHO_WORKDRIVE_REFRESH_TOKEN`
  - `ZOHO_WORKDRIVE_CLIENT_ID`
  - `ZOHO_WORKDRIVE_CLIENT_SECRET`
  - `ZOHO_WORKDRIVE_BASE_API_URI`
  - `ZOHO_WORKDRIVE_ACCOUNTS_DOMAIN`

## Deployment notes
- MVP deployment target is Vercel preview first.
- Domain strategy: keep Squarespace live and connect app on `app.zokorp.com`.
- Configure Stripe in test mode before any live switch.

## Operations
See [`docs/08-how-to-operate.md`](docs/08-how-to-operate.md).
For multi-thread branch/worktree operations, see [`docs/09-codex-parallel-workflow.md`](docs/09-codex-parallel-workflow.md).

## Landing Zone Readiness Checker
- Route: `/software/landing-zone-readiness-checker`
- Purpose: collect business-email leads, score landing-zone readiness deterministically, email the full report, and generate a deterministic consultation quote
- Storage: `LandingZoneReadinessSubmission` records the submitted answers, score snapshot, findings, quote, and CRM/email delivery status
- Email delivery: reuses the existing Resend-first / SMTP-fallback delivery path
- CRM: reuses the existing Zoho CRM credentials and attempts an upsert by email when configured
- Pricing: quote defaults are code-configured in [`lib/landing-zone-readiness/config.ts`](lib/landing-zone-readiness/config.ts) so the owner can approve and tune ranges without changing the scoring engine
