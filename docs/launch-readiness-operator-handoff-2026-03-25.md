# Launch Readiness Operator Handoff

Date: March 25, 2026

## Current Live State

- Production app alias: [https://app.zokorp.com](https://app.zokorp.com)
- Current production deployment: `dpl_DhvHvU1EAc84o5UHpyKEVgKVeK5d`
- Deployment inspector: [zokorp-web / DhvHvU1EAc84o5UHpyKEVgKVeK5d](https://vercel.com/leggoboyos-projects/zokorp-web/DhvHvU1EAc84o5UHpyKEVgKVeK5d)
- Base workspace commit: `4602753`
- Note: production includes current local audit changes that are not yet committed

## What Changed In This Release

- `/services` booking CTA now uses the tagged Calendly URL strategy.
- `/services` copy now matches the real request-vs-booking behavior.
- `/services` request panel no longer relies on client-only first-paint auth state.
- validator / checkout / portal flows now treat audit logging as best-effort, not success-blocking.
- admin pages now use a real forbidden boundary.
- architecture-review status responses are now fully `no-store`.
- Calendly webhook timestamp freshness is enforced.
- XLSX uploads now fail closed on malformed / oversized workbook structures.
- admin leads now surface WorkDrive archive failures as ops-attention items.
- runtime readiness now calls out `CRON_SECRET` and external GitHub Actions scheduler dependencies explicitly.

## Validation Commands Run

- `npm run lint`
- `npm run typecheck -- --incremental false`
- `npm test`
- `npm run build`
- `SMOKE_BASE_URL=https://app.zokorp.com npm run smoke:production`

All of the above passed in this pass.

## Manual Work Still Required

### 1. Root domain cutover

Required end state:

- `zokorp.com` -> Vercel
- `www.zokorp.com` -> Vercel
- both redirect permanently to `https://app.zokorp.com`

Current Vercel-required DNS:

- `A zokorp.com 76.76.21.21`
- `A www.zokorp.com 76.76.21.21`

Use:

- [launch-readiness-atlas-prompts-2026-03-25.md](/Users/zohaibkhawaja/Documents/Codex/zokorp-platform/docs/launch-readiness-atlas-prompts-2026-03-25.md)

### 2. Live auth + admin browser proof

Accounts to use:

- non-admin: `consulting@zokorp.com`
- admin: `zkhawaja@zokorp.com`

Needed proofs:

- register / verify / login / logout / password reset
- `/account`
- `/account/billing`
- `/admin/readiness`
- `/admin/leads`
- `/admin/service-requests`

### 3. Stripe browser checkout proof

Needed proof:

- one full Stripe test-mode checkout completion after this deploy
- webhook fulfillment visible
- credits / entitlement visible

### 4. Calendly booking ingestion proof

Needed proof:

- create one real booking from live `/services`
- confirm the tagged Calendly URL was used
- confirm resulting internal ingestion artifact

### 5. WorkDrive provider diagnosis

Needed proof:

- identify exact Zoho / WorkDrive plan or account blocker
- decide whether to fix it now or narrow the promise intentionally

## Evidence To Return From Manual / Atlas Steps

When the remaining manual work is completed, return these exact artifacts:

- Root domain:
  - final DNS records
  - final browser behavior for apex and `www`
- Auth/admin:
  - pass/fail result for each lifecycle step
- Stripe:
  - checkout session success
  - hosted checkout completion
  - webhook delivery result
  - entitlement / credit result
- Calendly:
  - booking confirmation
  - internal `LeadInteraction` or equivalent proof
  - internal `ServiceRequest` proof if same-email match applies
- WorkDrive:
  - exact blocker
  - exact next action

## Launch Decision Rule

Treat broad public marketing as blocked until all four are true:

1. apex and `www` no longer serve Squarespace
2. auth lifecycle is browser-proven
3. Stripe test checkout is browser-proven
4. `/services` booked-call ingestion is artifact-proven
