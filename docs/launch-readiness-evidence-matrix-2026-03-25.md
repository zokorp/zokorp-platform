# Launch Readiness Evidence Matrix

Date: March 25, 2026

## Environment Truth

| Track | Command / Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Git baseline | `git rev-parse --short HEAD` | `4602753` | Pass |
| Working tree state | `git status --short` | Audit changes present locally and deployed to production from working tree | Pass with traceability caveat |
| Production deployment identity | `npx vercel inspect app.zokorp.com` | Deployment `dpl_DhvHvU1EAc84o5UHpyKEVgKVeK5d`, target `production`, alias `https://app.zokorp.com` | Pass |
| Local lint | `npm run lint` | Passed | Pass |
| Local typecheck | `npm run typecheck -- --incremental false` | Passed | Pass |
| Local tests | `npm test` | `277 passed / 277 tests` | Pass |
| Local build | `npm run build` | Passed | Pass |
| Production smoke | `SMOKE_BASE_URL=https://app.zokorp.com npm run smoke:production` | Passed at `2026-03-25T21:35:34.500Z` | Pass |

## Domains And Routing

| Track | Command / Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Apex redirect | `curl -sSI https://zokorp.com` | `301` to `https://www.zokorp.com/`, served by Squarespace | Fail for public launch |
| Public `www` site | `curl -sSI https://www.zokorp.com` | `200`, served by Squarespace | Fail for public launch |
| Stale marketing proof | `curl -s https://www.zokorp.com \| rg -n "our-services\|contact-us\|AWS AI/ML Engineer"` | Old Squarespace routes and legacy copy still live | Fail |
| App root | `curl -sSI https://app.zokorp.com` | `200`, served by Vercel | Pass |
| Vercel apex instructions | `npx vercel domains inspect zokorp.com` | Recommended record: `A zokorp.com 76.76.21.21` | Caveat |
| Vercel `www` instructions | `npx vercel domains inspect www.zokorp.com` | Recommended record: `A www.zokorp.com 76.76.21.21` | Caveat |
| Services CTA after deploy | `curl -s https://app.zokorp.com/services \| rg -o 'https://calendly[^" ]+' -m 1` | Tagged CTA includes `utm_medium=services-page` and `utm_campaign=architecture-follow-up` | Pass |
| Services copy honesty after deploy | `curl -s https://app.zokorp.com/services \| rg -o 'Submit this form to create a tracked service request immediately\.[^<]+' -m 1` | Live copy now matches real runtime behavior | Pass |

## Auth, Admin, And Protected Routes

| Track | Command / Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Architecture review status cache behavior | `curl -si 'https://app.zokorp.com/api/architecture-review-status?jobId=cmn6hsc500003lb04kehewmt3'` | `401` with `Cache-Control: no-store` | Pass |
| Admin forbidden behavior in code | `tests/admin-page-access.test.ts` | `UNAUTHORIZED` redirects to login; `FORBIDDEN` raises forbidden boundary | Pass |
| Admin forbidden UI deployment | Production deploy `dpl_DhvHvU1EAc84o5UHpyKEVgKVeK5d` | `app/forbidden.tsx` shipped live | Pass |
| Live browser auth lifecycle | Not completed in this pass | Register / verify / reset / admin login still need mailbox/browser proof | Caveat |

## `/services` Funnel And Calendly Tracking

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Tagged booking URL helper | `tests/calendly.test.ts` | Helper supports per-surface UTM overrides without breaking email CTA defaults | Pass |
| `/services` server render state | `tests/services-page.test.tsx` | Page passes signed-in state to `ServiceRequestPanel` from the server | Pass |
| Live `/services` CTA | Production HTML | Raw untagged Calendly URL removed; live CTA is now tagged | Pass |
| Live `/services` copy | Production HTML | Copy now says tracked request immediately, booked-call sync later after same-email match | Pass |
| Real booked-call ingestion artifact | Not completed in this pass | No new founder-controlled live booking artifact yet | Caveat |

## Billing And Paid Validation

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Validator resilience | `tests/zokorp-validator-route.test.ts` | Successful validation survives post-run lookup/audit failure and stays `no-store` | Pass |
| Checkout-session resilience | `tests/stripe-create-checkout-session-route.test.ts` | Session URL returns successfully even if audit write fails | Pass |
| Portal-session resilience | `tests/stripe-create-portal-session-route.test.ts` | Portal URL returns successfully even if audit write fails | Pass |
| Entitlement post-decrement state | `tests/entitlements-admin-bypass.test.ts` | Remaining-use state returned from the decrement transaction | Pass |
| Browser-completed Stripe checkout | Not completed in this pass | Still needs one real test-mode browser proof after deploy | Caveat |

## Security And Resilience

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Calendly stale signature rejection | `tests/calendly-webhook-route.test.ts` | Stale webhook signatures are rejected before ingest | Pass |
| XLSX ZIP preflight | `tests/workbook.test.ts` | Malformed ZIPs and oversized workbook structures are rejected before `ExcelJS` load | Pass |
| Architecture review status no-store | Live `curl` + route test | All branches now non-cacheable | Pass |
| CSP / header posture | `curl -si https://app.zokorp.com` | HSTS, XFO, referrer policy, CSP present; CSP still broader than ideal | Caveat |

## Operator Visibility And Readiness

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| WorkDrive archive ops attention | `tests/admin-leads.test.ts` | WorkDrive failure states now count as needs-attention and drive next-action text | Pass |
| Runtime readiness `CRON_SECRET` coverage | `tests/runtime-readiness.test.ts` | `CRON_SECRET` now explicitly checked | Pass |
| External scheduler honesty | `tests/runtime-readiness.test.ts` | GitHub Actions scheduler dependencies now stay manual/operator-verified in readiness output | Pass |
| Recent Calendly sync workflow | [23565023825](https://github.com/leggoboyo/zokorp-platform/actions/runs/23565023825) | Success | Pass |
| Recent architecture worker workflow | [23564887224](https://github.com/leggoboyo/zokorp-platform/actions/runs/23564887224) | Success | Pass |
| Recent CI workflow | [23563701631](https://github.com/leggoboyo/zokorp-platform/actions/runs/23563701631) | Success | Pass |

## Manual / Human-Only Proof Still Outstanding

| Track | Why It Is Still Open | Status |
| --- | --- | --- |
| Domain cutover | Requires registrar / DNS / possibly Squarespace UI access | Open |
| Full auth lifecycle proof | Requires mailbox/browser access for `consulting@zokorp.com` and `zkhawaja@zokorp.com` | Open |
| Stripe hosted checkout proof | Requires browser test-mode purchase completion | Open |
| Calendly booking ingestion proof | Requires one real founder-controlled booking and follow-up verification | Open |
| WorkDrive capability diagnosis | Requires Zoho / WorkDrive account UI access | Open |
