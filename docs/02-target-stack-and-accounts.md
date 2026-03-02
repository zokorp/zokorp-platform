# Target stack and accounts

## Services and defaults
- Domain: `zokorp.com`
- Canonical domain target: `www.zokorp.com` (apex redirects to `www`)
- Registrar: Squarespace Domains LLC (WHOIS verified)
- Code host: GitHub (`zokorp-platform`)
- Deployment: Vercel (`zokorp-web`)
- Backend: Supabase (Postgres + Auth + Storage)
- Payments: Stripe first (test mode until launch)
- PayPal/Braintree: deferred to phase 2

## Access check status (Phase 0 re-run, 2026-03-01 CST)
- GitHub (`https://github.com/dashboard`): redirected to sign-in page; not authenticated in this session
- Vercel (`https://vercel.com/dashboard`): redirected to login page; not authenticated in this session
- Squarespace (`https://account.squarespace.com`): redirected to login page; not authenticated in this session
- Supabase (`https://supabase.com/dashboard/project/jhjgrxbzjmhxqjaaerjb`): redirected to sign-in page; not authenticated in this session
- Stripe (`https://dashboard.stripe.com/test/dashboard`): redirected to login page; not authenticated in this session
- Required operator handoff phrase used: `Pause here for human login/MFA`

## Accounts and identifiers (non-secrets)
- GitHub remote (local repo evidence): `https://github.com/leggoboyo/zokorp-platform.git`
- GitHub local branch state: `main` tracking `origin/main`
- Squarespace:
  - Registrar: `Squarespace Domains LLC`
  - Nameservers: `ns-cloud-a1..a4.googledomains.com`
- Vercel (from existing project notes, requires dashboard login to reconfirm):
  - Team/account: `leggoboyos-projects`
  - Project: `zokorp-web`
  - Preview URL: `https://zokorp-web.vercel.app` (currently returns `404 NOT_FOUND`)
- Supabase (from existing project notes, requires dashboard login to reconfirm):
  - Org: `ZoKorp`
  - Project ref: `jhjgrxbzjmhxqjaaerjb`
  - Project URL: `https://jhjgrxbzjmhxqjaaerjb.supabase.co`
  - Region note in docs: AWS `us-west-2` (not re-verified in dashboard this session)
- Stripe (from existing project notes, requires dashboard login to reconfirm):
  - Account: `ZoKorp`
  - Mode: test
  - Test customer portal config ID: `bpc_1T6On55wcnm215lA95megntn`

## Running worklog
- 2026-03-01 23:34 CST — Phase 0 access check rerun complete.
  - Changed: validated current session auth state for all five dashboards.
  - Blockers: all dashboards require login/MFA from human.
  - Rollback impact: none (read-only checks).
- 2026-03-01 23:35 CST — Phase 1 public-site refresh complete.
  - Changed: refreshed page inventory and extracted current live content structure.
  - Blockers: Squarespace dashboard-only DNS UI checks and screenshots still pending login.
  - Rollback impact: none (read-only checks).
- 2026-03-01 23:36 CST — DNS baseline drift detected and documented.
  - Changed: captured current TXT verification values and registrar/NS evidence.
  - Blockers: dashboard confirmation of forwarding/settings still pending login.
  - Rollback impact: none (no DNS edits performed).
- 2026-03-01 23:36 CST — Foundation verification pass reconciled.
  - Changed: docs normalized across stack/account, env template, Stripe map, DNS plan, handoff, open questions.
  - Blockers: GitHub issues/project board and dashboard-specific project settings cannot be re-verified without login.
  - Rollback impact: documentation-only updates.

## Blockers requiring human takeover
- Authenticate to all dashboards (GitHub, Vercel, Squarespace, Supabase, Stripe) to complete account-context verification and platform screenshots.
- Confirm existing GitHub issues and project board columns in UI (or via `gh`) once authenticated.
- Confirm current Supabase auth/storage configuration in dashboard once authenticated.
- Confirm Stripe product/price/portal IDs in dashboard once authenticated.

## Verification gates before any DNS cutover
- A real deployable app exists (not current `404` preview).
- Vercel project linked and auto-deploy working on current branch.
- Supabase auth + storage configuration validated in dashboard.
- Stripe test checkout + webhook + billing portal flow validated end-to-end.
- Old/new DNS values and rollback values documented in `/docs/05-dns-baseline-and-cutover-plan.md`.
