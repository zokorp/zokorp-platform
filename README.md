# ZoKorp Platform

Production-oriented Next.js App Router application for ZoKorp marketing, free diagnostics, paid software access, billing, and operator workflows.

## Current architecture
- Next.js 16 App Router + TypeScript + Tailwind CSS
- Prisma + Postgres
- NextAuth credentials auth with business-email verification
- Stripe Checkout + Webhooks + Customer Portal
- Zoho CRM lead sync + Zoho WorkDrive archival hooks

## Product surfaces
- Marketing pages: `/`, `/about`, `/services`, `/case-studies`, `/media`, `/contact`
- Software hub: `/software`, `/software/[slug]`
- Account area: `/account`, `/account/billing`
- Admin area: `/admin/products`, `/admin/prices`, `/admin/service-requests`
- Free diagnostic tools:
  - `Architecture Diagram Reviewer`
  - `AI Decider`
  - `Landing Zone Readiness Checker`
  - `Cloud Cost Leak Finder`
- Paid software:
  - `ZoKorpValidator`

## Current platform rules
- Free diagnostic tools require a signed-in, verified business-email account before full consulting-style output is delivered.
- Public subscription pricing stays hidden unless `PUBLIC_SUBSCRIPTION_PRICING_APPROVED=true`.
- Public software and pricing pages fall back to a static core catalog when the DB-backed catalog is unavailable.
- Billing, admin, and entitlement-protected routes enforce access server-side.
- Public-schema database tables are RLS-enabled and default-closed; server-side Prisma remains the supported application data path, and production `DATABASE_URL` must keep using the backend owner or another `BYPASSRLS`-capable role until explicit application policies are introduced.

## Local setup
1. Install dependencies with `npm install`.
2. Copy the template with `cp .env.example .env.local`.
3. Fill in `.env.local` values. Start with the minimum local contract in [`docs/03-environment-variables-template.md`](docs/03-environment-variables-template.md).
4. Generate Prisma client with `npm run prisma:generate`.
5. Run migrations after Postgres is reachable with `npm run prisma:migrate`.
6. Seed baseline catalog data with `npm run prisma:seed`.
7. Start the app with `npm run dev`.

Without email, Stripe, or Zoho credentials, the UI can still run locally, but verification, password reset, billing, worker, and CRM-backed flows will stay unavailable or degrade to fallback behavior.

## Validation commands
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `node scripts/production_smoke_check.mjs`
- `SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/production_smoke_check.mjs`

## Important docs
- [`docs/03-environment-variables-template.md`](docs/03-environment-variables-template.md): env contract, split by local vs production and secret vs non-secret
- [`docs/04-stripe-product-map.md`](docs/04-stripe-product-map.md): current Stripe product and price mapping posture
- [`docs/free-tool-access-policy.md`](docs/free-tool-access-policy.md): verified business-email policy for free diagnostics
- [`docs/billing-readiness-checklist.md`](docs/billing-readiness-checklist.md): billing launch readiness checklist
- [`docs/admin-enterprise-readiness-execution-log.md`](docs/admin-enterprise-readiness-execution-log.md): execution evidence for the current enterprise-readiness work
- [`docs/08-how-to-operate.md`](docs/08-how-to-operate.md): operator workflow notes
- [`docs/09-codex-parallel-workflow.md`](docs/09-codex-parallel-workflow.md): worktree and automation branch workflow

## Known human-owned blockers
- Final live Stripe pricing, refund posture, and tax/legal configuration
- Final privacy policy and terms approval
- Final support posture and SLA wording
- Final founder bio, proof assets, and booking/contact decisions
