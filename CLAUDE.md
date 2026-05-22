# CLAUDE.md

Guidance for Claude Code when working in `zokorp-platform` (the codebase behind www.zokorp.com).

## What this is

Production Next.js 16 App Router SaaS for ZoKorp: marketing site, free diagnostics, paid software access, billing, and operator workflows. Founder-led cloud consulting platform.

Stack: Next.js 16 + React 19 + TypeScript 5 strict, Prisma 6 + Postgres, NextAuth 4 credentials (business-email verified), Stripe 20, Zoho CRM/Invoice/WorkDrive, Sentry, Tailwind 4.

## Branching & merge workflow

- **Commit directly to `main`.** No PRs, no `claude/*` branches, no merge buttons.
- **Local gates must pass first** — every push is preceded by `npm run lint && npm run typecheck && npm test && npm run build` all green.
- **Visual gate for UI changes** — use Playwright MCP to navigate affected pages at 1440×900 and 390×844, capture screenshots into `.claude-screenshots/`, and review them before committing.
- **Push → Vercel auto-deploys** to www.zokorp.com. After each push, watch the commit's GitHub status / Vercel dashboard until the deployment is green before declaring done.
- **Never skip hooks** (`--no-verify`), **never force-push `main`**. Fix hook failures by creating a new commit, not by amending.
- If another agent or session has left the working tree dirty, stash before starting — never silently discard or commit someone else's work.

## Product surfaces

| Surface | Path | Auth |
|---|---|---|
| Marketing | `/`, `/about`, `/services`, `/case-studies`, `/media`, `/contact` | public |
| Software hub | `/software`, `/software/[slug]` | public (tool output gated by verified business email) |
| Account | `/account`, `/account/billing` | session + verified email |
| Admin | `/admin/products`, `/admin/prices`, `/admin/service-requests`, `/admin/leads` | `requireAdmin()` — `ZOKORP_ADMIN_EMAILS` env |
| APIs | `/app/api/*` | per-route |

Multi-host routing lives in `proxy.ts` — apex (`zokorp.com`), marketing host, app host. Marketing-only and app-only path lists are defined there.

## Directory map

- `app/` — App Router pages, layouts, and `api/` route handlers
- `components/` — React components; long tool forms live here
- `lib/` — business logic (auth, db, stripe, zoho, architecture-review, validator)
- `prisma/schema.prisma` — 31 models; `prisma/migrations/` has 26 sequenced migrations
- `tests/` — Vitest unit tests; `tests/e2e/` — Playwright
- `scripts/` — Node `.mjs` scripts for smoke / journey / ops / uptime
- `docs/` — 28 markdown files (threat model, launch readiness, env contract, Stripe map, operator notes)
- `.github/workflows/` — 12 CI/ops workflows

## Dev commands

```bash
npm install                 # first time; postinstall runs `prisma generate`
cp .env.example .env.local  # then fill in values
npm run prisma:migrate      # dev DB migrations
npm run prisma:seed         # baseline products/prices
npm run dev                 # Next.js dev server on :3000
```

Validation (run these before claiming a change is done):

```bash
npm run lint                # eslint .
npm run typecheck           # tsc --noEmit -p tsconfig.typecheck.json
npm test                    # vitest run
npm run build               # full next build
npm run test:e2e:local      # Playwright against localhost, readonly mutation mode
```

Production-adjacent commands (do **not** run without explicit instruction):

- `npm run prisma:migrate:deploy` — applies migrations to whatever `DATABASE_URL` points to
- `npm run smoke:production`, `ops:audit:production`, `ops:proof:production`, `journey:*:production`
- Anything that writes to Stripe live keys, Zoho prod tenants, or WorkDrive

## Coding conventions (already followed in this repo — don't regress them)

- **TypeScript strict.** No `any` unless unavoidable and commented.
- **Zod at every external boundary.** Request bodies, env vars, form data, third-party responses.
- **Auth server-side.** Use `requireUser()` / `requireAdmin()` from `lib/auth.ts`. Never trust the client.
- **Prisma transactions** for credit decrements, entitlement mutations, and Stripe fulfillment.
- **`force-dynamic`** on dashboards/account/admin; **`revalidate: N`** on marketing/catalog pages.
- **Audit-log sensitive actions.** Auth, billing, architecture jobs all write to `AuditLog`.
- **Webhook idempotency.** `StripeWebhookEvent` has a unique `stripeEventId` — keep it.
- **No secrets in source.** `.env.example` is the contract; real values only in `.env.local` / Vercel.
- **RLS is on** for public-schema tables. Production `DATABASE_URL` must stay `BYPASSRLS`-capable until explicit policies are added.

## Files to treat with extra care

These are >1000 LOC and easy to break. Read carefully before editing, and prefer extracting new logic into a sibling module rather than growing them further:

- `components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm.tsx` (~1985 LOC)
- `lib/architecture-review/jobs.ts` (~1422 LOC) — async job worker
- `lib/architecture-review/rule-catalog.ts` (~1208 LOC)
- `lib/architecture-review/diagram-generator.ts` (~1511 LOC)
- `lib/zokorp-validator-engine.ts` (~2315 LOC)
- `app/api/stripe/webhook/route.ts` (~592 LOC) — billing event handling

## Architecture review specifics

- Rule IDs are namespaced: `aws:*`, `azure:*`, `gcp:*`, `snowflake:*`, `shared:*`.
- Every full-deduction rule needs direct evidence — otherwise downgrade to `Clarify` or `Optional`.
- `officialSourceLinks`, `remediationHoursLow/High`, `estimatePolicyBand`, and confidence data are code-owned. The admin rule-catalog UI can only edit customer-facing copy and price-override bands.

## Important env vars (not exhaustive — see `.env.example` and `docs/03-environment-variables-template.md`)

Secrets: `DATABASE_URL`, `NEXTAUTH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ARCH_REVIEW_*_SECRET`, `CRON_SECRET`, `ZOHO_*` tokens, `RESEND_API_KEY`, `ARCHIVE_ENCRYPTION_SECRET`.

Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `PUBLIC_SUBSCRIPTION_PRICING_APPROVED`.

## Reference docs

- `AGENTS.md` — short agent-friendly project overview
- `README.md` — architecture, product surfaces, validation commands
- `DEV_NOTES.md` — UI patterns and duplication notes
- `docs/03-environment-variables-template.md` — env contract
- `docs/04-stripe-product-map.md` — Stripe products/prices
- `docs/08-how-to-operate.md` — operator workflow
- `docs/platform-improvement-backlog.md` — tracked TODOs
- `docs/security-threat-model.md` — threat model
