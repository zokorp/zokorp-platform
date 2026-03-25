# Launch Readiness Evidence Matrix

Date: March 25, 2026

## Environment Truth

| Track | Command / Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Git baseline | `git rev-parse HEAD && git rev-parse origin/main` | Both resolved to `58064a397c09c9ef4aba837bcda10039df51c726` | Pass |
| Production deployment identity | `npx vercel inspect app.zokorp.com` | Deployment `dpl_HMf5o97Ghubnr8uFkQXUf28rHx5C`, project `zokorp-web`, target `production`, alias `https://app.zokorp.com` | Pass |
| Local lint | `npm run lint` | Passed | Pass |
| Local typecheck | `npm run typecheck -- --incremental false` | Passed | Pass |
| Local tests | `npm test` | `258 passed / 258 tests` | Pass |
| Local build | `npm run build` | Passed | Pass |
| Production smoke | `npm run smoke:production` | Passed against `https://zokorp-web.vercel.app` | Pass |

## Domains and Routing

| Track | Command / Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Apex redirect | `curl -sSI https://zokorp.com` | `301` to `https://www.zokorp.com/`, served by Squarespace | Caveat |
| Public `www` site | `curl -sSI https://www.zokorp.com` | `200`, served by Squarespace | Caveat |
| App root | `curl -sSI https://app.zokorp.com` | `200`, served by Vercel with security headers | Pass |
| Stale marketing proof | `curl -s https://www.zokorp.com | rg -n "our-services|contact-us|AWS AI/ML Engineer"` | Found old Squarespace routes and legacy copy | Fail for broad public marketing |
| Services page proof | `curl -s https://app.zokorp.com/services` | Live page includes `Build with confidence, not guesswork`, `Book architecture follow-up`, and correct booking-first FAQ | Pass |

## Auth and Account Lifecycle

| Track | Command / Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Credentials auth session | `GET /api/auth/csrf` then `POST /api/auth/callback/credentials` with cookie jar | Valid session established | Pass |
| Session proof | `GET /api/auth/session` | Returned authenticated session for audit user | Pass |
| Account access | `GET /account` with session | `200` with account page content | Pass |
| Billing page reachability | `GET /account/billing` with session | `200` | Pass |
| Unauthorized admin access | `GET /admin/readiness`, `/admin/leads`, `/admin/service-requests` as non-admin | Restricted content rendered, no data leak | Pass with caveat |
| Same-origin enforcement | Wrong `Origin` against service requests and checkout endpoints | `403` | Pass |

## Free Diagnostics

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| AI Decider live submission | Real production submission | Result emailed and minimal lead event recorded | Pass |
| Landing Zone live submission | Real production submission | Result emailed | Pass |
| Cloud Cost live submission | Real production submission with follow-up/CRM opt-in path | Result emailed, archive path used, CRM opt-in honored | Pass |
| Architecture review live submission | Real production submission for job `cmn6hsc500003lb04kehewmt3` | Returned `status:"sent"`, `phase:"completed"`, `progressPct:100`, `deliveryMode:"sent"` in about 5.4s | Pass |

## Privacy and Retention

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Minimal lead/event model | Live DB inspection of audit account | Lead + events present; no legacy free-tool submission rows used for default path | Pass |
| Archive count | Live DB inspection | `archiveCount: 5` for opt-in paths only | Pass |
| CRM consent gating | Live DB/event inspection | Cloud Cost opted-in path synced; default paths skipped | Pass |
| Retention sweep protection | `curl -sSI https://app.zokorp.com/api/internal/cron/retention-sweep` | `401`, `Cache-Control: no-store` | Pass |
| Privacy copy | `curl -s https://app.zokorp.com/privacy` with content inspection | Includes zero-retention default, 30-day archive, 15-minute fingerprint, CRM off by default, cleanup statements | Pass |

## Architecture Funnel and Services

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Architecture estimate email | Founder screenshot review | Clean itemized estimate, one booking CTA, assumptions/exclusions, estimate reference, confidence displayed | Pass |
| Services page | Founder screenshot review plus curl | Matches booking-first model and routes to external Calendly URL | Pass |
| Service request creation | Authenticated POST to `/api/services/requests` | Created `SR-260325-6SEC9` and `SR-260325-WQP7Y`; visible in account timeline | Pass |
| CTA click / booked-call tracking | No live matching booking during audit window | Framework is present, no final live booking artifact yet | Caveat |

## Billing and Paid Validation

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Checkout session creation | Authenticated production POST to `/api/stripe/create-checkout-session` | Returned real Stripe Checkout URL | Pass |
| Billing portal session creation | Authenticated production POST to `/api/stripe/create-portal-session` | Returned real Stripe Portal URL | Pass |
| Webhook fulfillment | Signed synthetic `checkout.session.completed` sent to live `/api/stripe/webhook` | `200 ok`, fulfillment row created | Pass |
| Entitlement creation | Live DB inspection | Validator entitlement created with one use | Pass |
| Credit balance creation | Live DB inspection | `FTR` credit balance created with one use | Pass |
| Paid validator run | Authenticated spreadsheet upload to `/api/tools/zokorp-validator` | Succeeded, score returned, `remainingUses: 0` | Pass |
| Purchase enforcement | Second validator run | `402 Purchase required before running this tool.` | Pass |
| Browser-completed hosted Stripe checkout | Not executed during this audit | Unproven browser step | Caveat |

## Scheduled Jobs and Operator Readiness

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Vercel cron route protection | `curl -sSI` against internal cron routes | `401` plus `no-store` headers | Pass |
| Architecture worker schedule | GitHub Actions run list | Scheduled and manual runs succeeding on `main` | Pass |
| Calendly sync schedule | GitHub Actions run list | Scheduled and manual runs succeeding on `main` | Pass |
| Zoho sync schedule | Workflow file inspection | Present with schedule and dispatch path | Pass |
| Production migrate workflow | GitHub Actions run `23559606576` | Success | Pass |
| Manual replay path | `workflow_dispatch` present on critical jobs | Proven usable | Pass |

## Representative Workflow Runs

| Workflow | Run | Result |
| --- | --- | --- |
| Sync Calendly Booked Calls | [23563222396](https://github.com/leggoboyo/zokorp-platform/actions/runs/23563222396) | Success |
| Drain Architecture Review Queue | [23563220868](https://github.com/leggoboyo/zokorp-platform/actions/runs/23563220868) | Success |
| Production Prisma Migrate | [23559606576](https://github.com/leggoboyo/zokorp-platform/actions/runs/23559606576) | Success |
| CI | [23555860486](https://github.com/leggoboyo/zokorp-platform/actions/runs/23555860486) | Success |

## Security and Runtime Hardening

| Track | Proof | Observed Result | Status |
| --- | --- | --- | --- |
| Unauthorized admin export caching | `curl -sSI https://app.zokorp.com/admin/leads/export` | `401`, `Cache-Control: no-store` | Pass |
| CSP / headers | `curl -sSI https://app.zokorp.com` | HSTS, XFO, referrer policy, CSP present | Pass with hardening caveat |
| CSV formula injection mitigation | Code patch plus tests | Dangerous leading spreadsheet characters are prefixed before export | Pass |
| Secret fallback surfacing | Runtime readiness code and tests | Better visibility, but fallback boundaries still deserve future tightening | Caveat |

## Visual Proof Used

- Founder-provided screenshot of the architecture-review estimate email
- Founder-provided screenshot of the Cloud Cost Leak Finder estimate memo
- Founder-provided screenshot of the live `/services` page

These were used because local browser automation was partially limited by Playwright/browser sandbox issues on the audit machine. HTTP-level proof and direct production calls covered the functional side.
