# Launch Readiness Audit Summary

Date: March 25, 2026  
Primary production app: [https://app.zokorp.com](https://app.zokorp.com)  
Current production deployment: `dpl_DhvHvU1EAc84o5UHpyKEVgKVeK5d`  
Deployment inspector: [zokorp-web / DhvHvU1EAc84o5UHpyKEVgKVeK5d](https://vercel.com/leggoboyos-projects/zokorp-web/DhvHvU1EAc84o5UHpyKEVgKVeK5d)  
Base git commit in workspace: `4602753`  
Important traceability note: production was updated from the current audited working tree, so the live deployment includes local changes that are not yet committed.

## Verdict

ZoKorp is **not ready** for broad public marketing yet.

`app.zokorp.com` is now strong enough for founder-led demos, direct prospect links, and controlled soft-launch traffic. The main reasons broad public launch is still blocked are external and proof-related rather than code-quality related:

- `zokorp.com` and `www.zokorp.com` still serve the stale Squarespace surface instead of the audited platform.
- One real browser-completed Stripe test checkout is still unproven in this pass.
- One real `/services` to Calendly to internal-ingestion booking artifact is still unproven in this pass.
- One live mailbox-driven auth lifecycle proof is still missing.

## What Was Fixed And Deployed

This pass was execution, not review-only. The following launch-relevant fixes were implemented, validated locally, and deployed to production:

- `/services` now uses a first-party server-built Calendly URL with:
  - `utm_source=zokorp`
  - `utm_medium=services-page`
  - `utm_campaign=architecture-follow-up`
- `/services` copy now honestly says:
  - the form creates a tracked service request immediately
  - booked calls are synced later after Calendly confirmation and same-email account matching
- `ServiceRequestPanel` now gets server-rendered auth state so signed-in users no longer hit a false first-paint signed-out wall.
- `decrementUsesAtomically` now returns post-transaction remaining-use state.
- The validator route now treats parse + validate + decrement as the essential success path and keeps audit/lookup work best-effort only.
- Checkout-session and portal-session creation now stay successful even if later audit-log writes fail.
- Validator route responses are consistently `Cache-Control: no-store`.
- Authenticated non-admin admin-page access now resolves through a real forbidden boundary instead of a soft-rendered `200` placeholder.
- `app/api/architecture-review-status` now returns `no-store` on every branch, including error branches.
- Calendly webhook verification now rejects stale signed payloads with a 5-minute timestamp tolerance.
- `.xlsx` ingestion is now preflighted before `ExcelJS` with ZIP structure checks and worksheet/row/cell limits.
- Lead/operator visibility now surfaces WorkDrive archive failure states as needs-attention items.
- Runtime readiness now includes `CRON_SECRET` coverage and an explicit external-scheduler section so GitHub Actions dependencies are not mistaken for app-runtime health.

## What Was Re-Verified Live After Deploy

- Production deployment `dpl_DhvHvU1EAc84o5UHpyKEVgKVeK5d` is live on `app.zokorp.com`.
- `npm run lint` passed.
- `npm run typecheck -- --incremental false` passed.
- `npm test` passed with `277 / 277` tests.
- `npm run build` passed.
- `SMOKE_BASE_URL=https://app.zokorp.com npm run smoke:production` passed after deploy.
- `/services` now serves the tagged Calendly CTA live:
  - `https://calendly.com/zkhawaja-zokorp/zokorp-architecture-review-follow-up?utm_source=zokorp&utm_medium=services-page&utm_campaign=architecture-follow-up`
- `/services` now serves the corrected tracked-request / same-email sync copy live.
- `GET /api/architecture-review-status?jobId=...` now returns `401` with `Cache-Control: no-store` when unauthenticated.
- `zokorp.com` still redirects to `www.zokorp.com`, and `www.zokorp.com` still serves the stale Squarespace site.

## Biggest Remaining Blockers

### 1. Public domain split-brain is still a real launch blocker

The live app is ready at `app.zokorp.com`, but public root-domain traffic still lands on the old Squarespace site.

Current verified state:

- `https://zokorp.com` -> `301` -> `https://www.zokorp.com/`
- `https://www.zokorp.com` -> `200` from Squarespace
- Squarespace HTML still contains `/our-services`, `/contact-us`, and `AWS AI/ML Engineer and Consultant`
- Vercel still reports both apex and `www` as not configured properly

This blocks broad marketing because public traffic still reaches the wrong site.

### 2. Live mailbox-driven auth proof is still incomplete

The code, tests, and route structure support credentials auth with business-email verification and password reset, but this pass did not complete a fresh live browser + mailbox proof for:

- register
- verify email
- login
- logout
- password reset
- session reuse
- founder admin login

This needs inbox/browser access that was not safely available from CLI alone.

### 3. Browser-completed Stripe test checkout is still unproven in this pass

The billing and validator server-side correctness issues are fixed and covered by regression tests, but the literal hosted Stripe Checkout browser path still needs one fresh test-mode completion after this deploy.

### 4. Real booked-call ingestion from the fixed `/services` CTA is still unproven in this pass

The CTA is now tagged correctly and deployed live. What is still missing is one real founder-controlled booking artifact proving:

- `/services` CTA click
- Calendly booking creation
- booking sync ingestion
- resulting `LeadInteraction`
- resulting `ServiceRequest` when same-email matching applies

### 5. WorkDrive archival is now visible and honest, but the provider path is still unresolved

The founder/operator visibility problem is fixed, but the provider capability problem itself still needs a Zoho/WorkDrive account decision or fix. This is now a transparent caveat instead of a silent-confidence problem.

## Recommended Launch Stance

### Safe now

- Founder demos on `https://app.zokorp.com`
- Direct outbound links sent to `https://app.zokorp.com`
- Controlled invite-only soft launch to the app subdomain
- Public sharing of free tools and services pages when the link goes directly to `app.zokorp.com`

### Do not do yet

- Broad marketing to `zokorp.com`
- Broad marketing to `www.zokorp.com`
- Public paid-validator promotion before one real Stripe test checkout is completed
- Claiming fully proven booked-call ingestion before one real Calendly booking is observed

## Shortest Path To Safe Public Marketing

1. Cut `zokorp.com` and `www.zokorp.com` to Vercel and redirect both to `https://app.zokorp.com`, preserving path and query.
2. Run one live auth/browser proof with mailbox access using:
   - `consulting@zokorp.com`
   - `zkhawaja@zokorp.com`
3. Run one Stripe test-mode browser checkout and verify fulfillment.
4. Run one real `/services` Calendly booking and verify the internal ingestion artifact.

## Audit Artifacts Created In This Pass

- Production deployment:
  - `dpl_DhvHvU1EAc84o5UHpyKEVgKVeK5d`
- No new customer-facing production data records were intentionally created during the code-hardening + redeploy pass itself.

Earlier same-day audit artifacts may still exist in production from pre-hardening verification work. Those are documented separately in the evidence matrix and operator handoff notes.
