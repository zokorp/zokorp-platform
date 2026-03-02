# ZoKorp Platform

Production-oriented Next.js platform for `zokorp.com` SaaS migration.

## Stack
- Next.js App Router + TypeScript + Tailwind
- NextAuth email magic-link authentication
- Prisma + Postgres
- Stripe Checkout + Webhooks + Customer Portal

## Product scope (current)
- Marketing pages: `/`, `/services`, `/case-studies`, `/media`
- Software catalog: `/software`, `/software/[slug]`
- Account pages: `/account`, `/account/billing`
- Admin pages: `/admin/products`, `/admin/prices`
- First tool: `ZoKorpValidator` (`zokorp-validator`) for PDF/XLSX input and text output

## Quick start
1. Install dependencies:
   - `npm install`
2. Configure env:
   - `cp .env.example .env.local`
   - set real values (do not commit secrets)
3. Prisma setup:
   - `npm run prisma:generate`
   - `npm run prisma:migrate`
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
  - `EMAIL_SERVER_HOST`
  - `EMAIL_SERVER_PORT`
  - `EMAIL_SERVER_USER`
  - `EMAIL_SERVER_PASSWORD`
  - `EMAIL_FROM`
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

## Deployment notes
- MVP deployment target is Vercel preview first.
- Domain strategy: keep Squarespace live and connect app on `app.zokorp.com`.
- Configure Stripe in test mode before any live switch.

## Operations
See [`docs/08-how-to-operate.md`](docs/08-how-to-operate.md).
