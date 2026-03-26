# Launch Readiness Findings Queue

Date: March 25, 2026 (updated March 26, 2026)

## P0

None.

## P1

### P1-1: `zokorp.com` and `www.zokorp.com` still serve the stale public surface

- Affected journey:
  - any prospect who starts from the root domain
- Verified proof:
  - `https://zokorp.com` -> `301` -> `https://www.zokorp.com/`
  - `https://www.zokorp.com` serves Squarespace
  - live HTML still contains `/our-services`, `/contact-us`, and legacy `AWS AI/ML Engineer and Consultant` copy
  - Vercel still reports:
    - `A zokorp.com 76.76.21.21`
    - `A www.zokorp.com 76.76.21.21`
    as the required DNS records
- Business impact:
  - broad public traffic still lands on the wrong site
  - messaging, trust, and CTA consistency stay split
  - public launch remains blocked even though the app is live and healthy
- Recommended action:
  - cut apex and `www` to Vercel, then permanently redirect both to `https://app.zokorp.com`

### P1-2: Live auth lifecycle proof is still incomplete

- Affected journey:
  - register
  - verify email
  - login / logout
  - password reset
  - founder admin login
- Verified proof:
  - code paths and tests are healthy
  - this pass did not complete a fresh mailbox/browser proof using:
    - `consulting@zokorp.com`
    - `zkhawaja@zokorp.com`
- Business impact:
  - high confidence in code, but not the same thing as fresh live proof
  - weakens the claim that auth is fully launch-proven today
- Recommended action:
  - run one Atlas/browser pass that completes the full auth lifecycle and founder admin verification

### P1-3: Paid-validator purchase is browser-proven, but live non-admin consumption is still not artifact-proven

- Affected journey:
  - paid validator purchase path
  - paid validator first real use on a non-admin account
- Verified proof:
  - browser-completed hosted Stripe Checkout succeeded in test mode on March 26, 2026
  - billing portal session opened successfully
  - the account wallet reflected one FTR run after purchase
  - the remaining weak point is that the founder admin account can bypass normal decrement enforcement, so the live non-admin consume path is still missing
- Business impact:
  - the purchase path itself looks real
  - the remaining launch risk is on real non-admin first-use enforcement rather than checkout creation
- Recommended action:
  - use a non-admin account to buy one run and consume it once end to end

### P1-4: Real booked-call ingestion from the fixed `/services` CTA is still unproven

- Affected journey:
  - `/services` CTA -> Calendly -> internal sync -> `LeadInteraction` / `ServiceRequest`
- Verified proof:
  - CTA tagging is fixed and deployed live
  - copy is fixed and deployed live
  - no new founder-controlled booking artifact was created during this pass
- Business impact:
  - booked-call automation is credible but not yet fully proven from the main public CTA
- Recommended action:
  - create one real founder-controlled booking from `/services` and verify the internal artifact

## P2

### P2-1: WorkDrive archival is operationally honest now, but the provider path still needs account work

- Affected journey:
  - optional architecture-review archival / follow-up workflow
- Verified proof:
  - founder/operator visibility problem is fixed
  - account/provider capability remains unresolved
- Business impact:
  - optional archive workflow should not be treated as fully trusted until the Zoho / WorkDrive account is corrected
- Recommended action:
  - verify the exact WorkDrive plan / activation blocker and either fix it or intentionally narrow the promise

### P2-2: CSP remains broader than ideal

- Affected journey:
  - all browser-rendered pages
- Verified proof:
  - CSP still includes `script-src 'unsafe-inline'`
  - `connect-src` still allows broad `https:`
- Business impact:
  - acceptable for current launch work, but not the tightest browser security posture
- Recommended action:
  - continue CSP tightening after launch blockers are closed

### P2-3: Live authenticated non-admin `403` semantics are code-fixed but not browser-proven

- Affected journey:
  - authenticated non-admin visits to admin URLs
- Verified proof:
  - helper tests pass
  - forbidden page is deployed
  - no fresh live non-admin browser session was used to confirm the exact HTTP/browser outcome
- Business impact:
  - low risk because the code path is explicit and covered
  - still slightly weaker than direct live proof
- Recommended action:
  - include this in the auth/admin Atlas verification pass

## P3

None.

## Closed In This Pass

These started as real blockers or caveats and are now fixed in code, validated locally, and deployed:

- `/services` raw Calendly CTA bypassing tracking
- `/services` copy overstating immediate consultation tracking behavior
- `/services` signed-in flicker / false first-paint wall
- `/services` post-submit ambiguity and account-navigation reliability, verified live on deployment `dpl_Eb6KoHxjki6AafqCBC7A53vyWJLU` with artifact `SR-260326-CK7DE`
- validator success turning into `500` after post-run bookkeeping failure
- Stripe checkout/portal session success turning into `500` after audit-log failure
- missing `no-store` coverage on architecture-review status error branches
- admin page soft `200` restricted placeholders instead of a real forbidden boundary
- missing Calendly webhook timestamp freshness check
- lack of XLSX ZIP preflight and worksheet / row / cell caps
- missing WorkDrive archive failure surfacing in the admin lead workspace
- missing `CRON_SECRET` coverage and unclear GitHub Actions scheduler honesty in runtime readiness
