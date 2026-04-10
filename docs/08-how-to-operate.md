# How To Operate (MVP)

## 1) Add or update products
- Open `/admin/products` as an admin user.
- Create products with a slug and access model (`FREE`, `ONE_TIME_CREDIT`, `SUBSCRIPTION`, `METERED`).
- Product slug is used for entitlement checks and software page routes.

## 2) Check runtime readiness before changing live config
- Open `/admin/readiness` as an allowlisted admin user.
- Review:
  - missing auth, billing, and scheduled-job secrets
  - risky secret reuse, especially follow-up secret vs Zoho sync secret
  - partial Zoho / WorkDrive / email-provider config
- Important:
  - this page is secret-safe and does not expose values
  - it cannot verify masked dashboard values, GitHub workflow URL targets, Stripe webhook bindings, or live response headers

## 2a) Run the full production provider audit from CLI
- Command:
  - `npm run ops:audit:production`
- What it verifies:
  - production Vercel env pull succeeds
  - canonical smoke checks pass across `https://zokorp.com`, `https://www.zokorp.com`, and `https://app.zokorp.com`
  - core security headers are present on both the marketing and app hosts
  - `/api/health` returns `status: ok` with a healthy database check on both hosts
  - Stripe webhook endpoint is enabled and pointed at `/api/stripe/webhook`
  - Zoho Invoice refresh-token flow works and can read the configured organization
  - the latest GitHub scheduled runs for queue drain, follow-ups, Calendly sync, Zoho lead sync, service-request CRM sync, estimate sync, and uptime checks all succeeded
- Software host-split expectations included in this audit:
  - `https://www.zokorp.com/software` stays public and canonical to `www`
  - `https://app.zokorp.com/software` stays crawl-safe and canonical to the marketing host
  - `https://app.zokorp.com/software/architecture-diagram-reviewer`
  - `https://app.zokorp.com/software/zokorp-validator`
  - `https://app.zokorp.com/software/mlops-foundation-platform`
  - `https://app.zokorp.com/software/architecture-diagram-reviewer/sample-report`
  - app-host marketing routes such as `/services` and `/about` redirect back to `www`
  - app-host `robots.txt` and `sitemap.xml` stay off the crawl surface
- Prerequisites on the operator machine:
  - Vercel CLI is authenticated and linked to `leggoboyos-projects/zokorp-web`
  - GitHub CLI is authenticated with access to `leggoboyo/zokorp-platform`
  - the machine can reach Stripe, Zoho, GitHub, and `app.zokorp.com`
- Output:
  - human-readable pass/fail lines
  - JSON summary for copy/paste into incident notes or handoff messages

## 2a.1) Run the split-host smoke against a preview deployment
- Command:
  - `JOURNEY_MARKETING_BASE_URL=https://preview-www.example.com JOURNEY_APP_BASE_URL=https://preview-app.example.com npm run smoke:preview`
- Use this when:
  - validating a preview pair before production
  - confirming `/software` and the tool detail routes still honor canonical and robots expectations on split hosts
- If preview aliases are protected by Vercel Authentication:
  - export `VERCEL_AUTOMATION_BYPASS_SECRET` before running the smoke or browser audit
  - example:
    - `VERCEL_AUTOMATION_BYPASS_SECRET=... JOURNEY_MARKETING_BASE_URL=https://preview-www.example.com JOURNEY_APP_BASE_URL=https://preview-app.example.com npm run smoke:preview`
  - the audit scripts now send `x-vercel-protection-bypass` automatically when that env var is present
- Recommended overrides when preview should still point canonical URLs at production:
  - `JOURNEY_EXPECTED_MARKETING_CANONICAL_BASE_URL=https://www.zokorp.com`
  - `JOURNEY_EXPECTED_APP_CANONICAL_BASE_URL=https://app.zokorp.com`
- Local note:
  - when both base URLs are the same localhost origin, host-split checks are expected to skip instead of fail

## 2a.2) Public health endpoint
- Route:
  - `GET /api/health`
- Expected behavior:
  - returns `200` with `status: "ok"` when the app is serving requests and the runtime database check succeeds
  - returns `503` with `status: "degraded"` when the app is up but the database check fails
  - responds with `Cache-Control: no-store`
- Safe external uptime targets:
  - `https://www.zokorp.com/api/health`
  - `https://app.zokorp.com/api/health`
- Important:
  - this route is intentionally low-detail and safe for uptime monitoring
  - deeper readiness and operator triage still live in `/admin/readiness`, `/admin/operations`, and `/admin/billing`

## 2a.3) Free external uptime monitor
- Command:
  - `npm run uptime:check`
- What it verifies:
  - apex redirects to the canonical marketing host
  - both public `/api/health` routes return `status: "ok"`
  - the marketing homepage still renders its primary CTA markers
  - the app login route still responds
- Scheduled automation:
  - `.github/workflows/uptime-checks.yml`
  - runs every 15 minutes on an offset schedule and can also be triggered manually from GitHub Actions
- Important:
  - this monitor is intentionally cheap and public-endpoint only
  - it does not require provider APIs, paid browser infrastructure, or dashboard logins
  - it should be treated as the first passive signal, not a replacement for the deeper provider or browser audits
  - scheduled workflows only run from the default branch
  - GitHub may auto-disable scheduled workflows after 60 days of repository inactivity, so treat the workflow list as part of launch/runbook review

## 2a.4) Sentry activation checklist
- Code support is now present for:
  - server-side error capture
  - edge/runtime request error capture
- To activate it for real, add these env vars:
  - `SENTRY_DSN`
- Optional but recommended for readable production stack traces:
  - `SENTRY_AUTH_TOKEN`
  - `SENTRY_ORG`
  - `SENTRY_PROJECT`
- Optional sample-rate controls:
  - `SENTRY_TRACES_SAMPLE_RATE`
- Important:
  - the app is intentionally conservative by default: no replay, no user-feedback widget, no default PII, and zero trace sampling until you opt in
  - if `SENTRY_DSN` is blank, the server-side Sentry SDK stays effectively dormant
  - browser-side Sentry capture can be added later after server-side monitoring is confirmed useful

## 2b) Run the live browser customer-journey audit from CLI
- One-time setup for a reusable sign-in account:
  - `npm run journey:setup:production`
  - This provisions or rotates a dedicated non-admin verified audit account in the production database and writes local credentials to `.env.audit.local`.
  - The default audit login is `browser-audit@zokorp-platform.test`, which is intentionally synthetic and only meant for sign-in/browser checks.
  - Extra local overrides already stored in `.env.audit.local` are preserved when the command rotates the audit account.
- Command:
  - `npm run journey:audit:production`
- Preview variant:
  - `JOURNEY_MARKETING_BASE_URL=https://preview-www.example.com JOURNEY_APP_BASE_URL=https://preview-app.example.com npm run journey:audit:preview`
- Preview audit-account setup:
  - `node scripts/provision_browser_audit_user.mjs --environment=preview --email=browser-audit-preview@zokorp-platform.test --write-env-file=.env.audit.preview.local`
  - then run:
    - `VERCEL_AUTOMATION_BYPASS_SECRET=... JOURNEY_ENV_FILE=.env.audit.preview.local JOURNEY_MARKETING_BASE_URL=https://preview-www.example.com JOURNEY_APP_BASE_URL=https://preview-app.example.com npm run journey:audit:preview`
- What it verifies:
  - the configured marketing host serves the current public pages
  - the configured app host serves product and auth routes without breaking the split
  - app-host duplicate and protected routes emit the expected noindex header
  - app-only metadata routes keep their canonical and robots meta tags intact
  - public product pages render their expected unsigned state
  - authenticated product pages render their expected signed-in state when creds are provided
  - the software hub, reviewer sample report, and app-host software detail pages stay aligned with the split-host `/software` contract
- Optional authenticated checks:
  - if `.env.audit.local` exists, the audit loads `JOURNEY_EMAIL` and `JOURNEY_PASSWORD` automatically
  - you can still override with shell env vars if you want to use a different account
  - with those env vars present, the audit also signs in, checks `/account`, and validates authenticated product states
- Optional runtime controls:
  - `JOURNEY_MARKETING_BASE_URL` to target a preview or local marketing host
  - `JOURNEY_APP_BASE_URL` to target a preview or local app host
  - `JOURNEY_EXPECTED_MARKETING_CANONICAL_BASE_URL` to keep asserting the real public marketing canonical host during preview/local runs
  - `JOURNEY_EXPECTED_APP_CANONICAL_BASE_URL` to keep asserting the real public app canonical host during preview/local runs
  - `JOURNEY_BASE_URL` remains a compatibility fallback when both hosts are the same
  - `JOURNEY_HEADED=true` to watch the browser run
  - `JOURNEY_BROWSER_CHANNEL=chrome` to prefer local Chrome, with bundled Chromium fallback
  - `JOURNEY_TIMEOUT_MS=30000` to tune browser waits
- Output:
  - `summary.json`, `console.log`, `network.json`, and screenshots under `output/playwright/customer-journey-audit/`
  - non-zero exit code if any checked browser step fails
- Important:
  - the synthetic audit account is enough for sign-in and protected-page checks
  - if the marketing host still redirects to `app`, the marketing-browser steps are marked `blocked` instead of `failed`
  - if you later want to verify email delivery end to end, use a real monitored inbox alias instead of the synthetic `.test` account

## 2c) Run the guided full GUI walkthrough from CLI
- Command:
  - `npm run journey:walkthrough`
  - `npm run journey:walkthrough:low-risk`
- What it verifies:
  - the same host preflight as the standard browser audit
  - desktop and mobile marketing browsing
  - stable visual screenshots of the homepage hero and services request panel
  - landmark and heading baselines on the main public pages
  - public app browsing on `app.zokorp.com`
  - manual or credential-driven app login
  - low-risk synthetic service-request submission when `JOURNEY_MUTATION_MODE=low-risk`
  - Zoho CRM lead verification through the GUI after manual Zoho login
  - browser artifacts including trace, console log, network failures, JSON summary, Markdown summary, and screenshots
- Required runtime controls:
  - `JOURNEY_MUTATION_MODE=readonly|low-risk|full`
  - default is `readonly`
  - use `low-risk` for a synthetic service request without paid checkout
- Optional runtime controls:
  - `JOURNEY_SERVICE_REQUEST_EMAIL`, `JOURNEY_SERVICE_REQUEST_NAME`, and `JOURNEY_SERVICE_REQUEST_COMPANY` for unsigned request coverage
  - `JOURNEY_SIGNUP_EMAIL`, `JOURNEY_SIGNUP_PASSWORD`, and `JOURNEY_SIGNUP_NAME` for disposable signup coverage in non-readonly runs
  - `JOURNEY_ZOHO_LOGIN_URL` if you need a non-default Zoho CRM login entry
- Output:
  - `output/playwright/full-gui-walkthrough/summary.json`
  - `output/playwright/full-gui-walkthrough/summary.md`
  - `output/playwright/full-gui-walkthrough/trace.zip`
  - `output/playwright/full-gui-walkthrough/console.log`
  - `output/playwright/full-gui-walkthrough/network.json`
  - screenshots in the same folder and auth state under `output/playwright/.auth/`
- Important:
  - this walkthrough stays free by default: no provider APIs, no browser cloud, no paid checkout completion, no live Calendly booking creation
  - manual login prompts pause cleanly for app or Zoho when credentials are not provided

## 2d) Run the soft-launch operational proof from CLI
- Command:
  - `npm run ops:proof:production`
- What it verifies:
  - the non-admin audit account can sign in
  - a real `FTR` credit exists and is consumed by one production validator run
  - the validator run writes account-linked history and delivery-state metadata
  - a synthetic booked-call event creates a linked `ServiceRequest`
  - the script attempts the internal Calendly ingest route first and records if local verification falls back to direct linkage proof
- Output:
  - `output/playwright/production-operational-proof/summary.json`
  - proof screenshots in the same folder
- Important:
  - this command mutates the dedicated audit account on purpose
  - it consumes one real validator credit and creates one synthetic booked-call service request for the audit user
  - it is intended as a repeatable operator proof, not a marketing demo
  - add `CALENDLY_SYNC_SECRET` to `.env.audit.local` if you want the proof runner to verify the live internal ingest route directly instead of falling back when provider-secret export is unavailable
  - if a production DB URL is available locally through `.env.audit.local`, `PRODUCTION_DIRECT_DATABASE_URL`, or `PRODUCTION_DATABASE_URL`, the proof adds direct database validation for credit and linkage writes
  - if no production DB URL is available locally, the proof still runs in browser-only mode and verifies the same validator/service-request flow through the live account UI plus the internal booked-call route

## 2e) Run the full soft-launch audit bundle
- Command:
  - `npm run soft-launch:audit:production`
- What it does:
  - runs provider audit
  - runs the live signed-in browser journey audit
  - runs the non-admin validator + booked-call operational proof
  - waits briefly before the operational proof and retries that proof automatically if production database pool pressure causes a transient failure

## 2f) Current scheduled-job and secret dependency map
- Architecture review queue drain:
  - workflow: `.github/workflows/architecture-review-worker.yml`
  - requires:
    - `ARCH_REVIEW_WORKER_URL`
    - `ARCH_REVIEW_WORKER_SECRET`
- Architecture review follow-ups:
  - workflow: `.github/workflows/architecture-followups.yml`
  - requires:
    - `ARCH_REVIEW_FOLLOWUP_URL`
    - `ARCH_REVIEW_FOLLOWUP_SECRET`
- Calendly booking sync:
  - workflow: `.github/workflows/calendly-booking-sync.yml`
  - requires:
    - `CALENDLY_PERSONAL_ACCESS_TOKEN`
    - `CALENDLY_SYNC_INGEST_URL`
    - `CALENDLY_SYNC_SECRET`
- Zoho lead sync:
  - workflow: `.github/workflows/zoho-sync-leads.yml`
  - requires:
    - `ZOHO_SYNC_URL`
    - `ZOHO_SYNC_SECRET`
- Zoho estimate sync:
  - workflow: `.github/workflows/zoho-sync-estimate-companions.yml`
  - requires:
    - `ZOHO_ESTIMATE_COMPANION_SYNC_URL`
    - `CRON_SECRET`
- Zoho service-request CRM sync:
  - workflow: `.github/workflows/zoho-sync-service-requests.yml`
  - requires:
    - `CRON_SECRET`
  - uses:
    - `https://app.zokorp.com/api/internal/cron/zoho-sync-service-requests`
- Uptime checks:
  - workflow: `.github/workflows/uptime-checks.yml`
  - requires:
    - no secrets by default
  - uses:
    - `https://zokorp.com`
    - `https://www.zokorp.com`
    - `https://app.zokorp.com`
    - public `/api/health` routes
- Operator note:
  - `/admin/operations` is now the first stop for retrying Zoho lead sync, retrying service-request CRM sync, retrying estimate sync, checking booked-call linkage, reviewing quote-follow-up attention, and retrying failed architecture-review email delivery from the outbox.
  - `/admin/operations` now also includes automation-health signals for the architecture queue worker, architecture follow-up sender, retention sweep, Zoho lead sync, service-request CRM sync, and estimate-companion sync so stale or failed scheduled jobs are visible without querying raw logs.
  - `/admin/service-requests` now shows whether each request is pending CRM sync, successfully synced, or failed, and updating a request status/note re-queues that request for CRM sync.
  - `/admin/operations` now also surfaces recent internal failures and CSP/security signals so caught runtime issues no longer stay in platform logs only.
  - `/admin/billing` is now the first stop for Stripe checkout fulfillment issues, recent webhook processing history, refunds/disputes, and entitlement or credit-balance reconciliation signals.

## 2g) Architecture reviewer privacy-mode guardrails and operator checks
- What privacy mode now supports locally:
  - `SVG`
  - `PNG` / `JPG` with browser OCR
  - text-based `PDF`
  - scanned or image-only `PDF` with browser OCR fallback
- Current browser-side limits:
  - privacy-mode PDF OCR is capped at `8` pages
  - privacy-mode PDF OCR rejects files larger than `6 MB`
  - raw diagrams are not uploaded in privacy mode
  - only minimal telemetry is sent unless the user explicitly requests email delivery
- Delivery behavior:
  - local-only run writes a minimal `ToolRun` plus lead event/interaction telemetry
  - privacy email delivery is idempotent by user plus fingerprint, so repeat clicks should reuse the prior result instead of re-sending
  - when email send fails, the server returns a fallback payload without retaining raw diagram content
- Where to inspect it:
  - `/admin/leads`
    - filter `Source = Architecture Review`
    - filter `Execution = Privacy mode` to isolate browser-first runs
    - filter `Ops = No follow-up yet` to find scored runs that never turned into a booked call or service request
  - `/admin/operations`
    - recent tool-run signals now include reviewer delivery state and execution mode
  - `/account`
    - follow-up timeline now shows delivery requested, sent, fallback, CTA, booked-call, and service-request creation signals
- Audit trail entries to expect:
  - `tool.architecture_review_privacy_run`
  - `tool.architecture_review_privacy_delivery`
- Important:
  - if real-host smoke says app-host marketing routes, `robots.txt`, or `sitemap.xml` are still wrong, treat that as deployment drift until a fresh deployment proves otherwise
  - local single-origin smoke runs are expected to skip split-host assertions instead of failing them

## 3) Add or update Stripe prices
- Open `/admin/prices` as an admin user.
- Attach Stripe `price_...` IDs to products.
- Set `kind` and `amount` in cents.
- For one-time credit packs, set `creditsGranted`.

## 4) Stripe receipts and invoice behavior
- In Stripe Dashboard (test first, then live), enable customer email receipts and invoice settings.
- App behavior:
  - Stores user email and Stripe customer id.
  - Sends users to Stripe Customer Portal from `/account/billing`.
  - Relies on Stripe for invoices/receipts and subscription self-service.
- Safety note:
  - Billing routes now fail closed if the stored `stripeCustomerId` cannot be verified against the signed-in user.
  - If a user reports "Billing profile could not be verified," inspect the user record's `stripeCustomerId` and the Stripe customer's `metadata.userId` before changing anything manually.

## 5) Stripe webhooks
- Configure Stripe webhook endpoint:
  - `/api/stripe/webhook`
- Subscribe at minimum to:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Set `STRIPE_WEBHOOK_SECRET` from Stripe endpoint signing secret.
- Operator visibility:
  - Signed webhook skips and failures now emit internal audit-log events, including:
    - `billing.webhook_checkout_skipped`
    - `billing.subscription_sync_applied`
    - `billing.webhook_failed`
  - Persisted Stripe event history is now recorded in the `StripeWebhookEvent` table and surfaced in `/admin/billing`, including:
    - latest webhook receipt time
    - recent event processing state
    - linked checkout/session/customer/subscription/invoice/dispute identifiers
    - failure details when processing fails
  - `/admin/billing` also surfaces billing integrity signals such as:
    - active entitlements missing Stripe customer bindings
    - active subscription entitlements missing Stripe subscription identifiers
    - credit entitlements whose remaining uses do not match active wallet totals
  - If Stripe billing state looks wrong, inspect `/admin/billing` first, then the related audit actions, before retrying webhooks or changing entitlements manually.

## 6) Entitlement operations
- One-time credit products:
  - Credits granted on checkout completion.
  - Tool execution decrements credits atomically.
- Subscription products:
  - Entitlement state follows Stripe subscription lifecycle events.

## 7) Key rotation
- Rotate these keys in provider dashboards, then update env vars in Vercel/local:
  - `NEXTAUTH_SECRET`
  - SMTP credentials
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- For scheduled jobs, also rotate:
  - `ARCH_REVIEW_WORKER_SECRET`
  - `ARCH_REVIEW_FOLLOWUP_SECRET`
  - `ZOHO_SYNC_SECRET`
- After rotation, verify:
  - auth login flow
  - checkout flow
  - webhook delivery status

## 8) Subdomain readiness (`app.zokorp.com`)
- Keep Squarespace site live on apex/www until app is validated.
- In Vercel project settings, add `app.zokorp.com` (already done for `zokorp-web`).
- Add only required DNS record in Squarespace DNS:
  - `A` host `app` -> `76.76.21.21`
- Verify SSL and routing before announcing availability.
- Keep `@` and `www` untouched in this phase.

## 9) Validator knowledge library (non-LLM rule source)
- Source workbook:
  - `/Users/zohaibkhawaja/Downloads/AWS Specialization Owners, Regional Leads, Resources copy.xlsx`
- Generator script:
  - `scripts/build_validator_library.py`
- Output folder:
  - `data/validator/library`
- Regenerate command:
  - `. .venv/bin/activate && python scripts/build_validator_library.py --clear-output`
- Generated tracks:
  - `data/validator/library/ftr`
  - `data/validator/library/sdp`
  - `data/validator/library/srp`
  - `data/validator/library/competency`
- Each specialization folder includes:
  - `metadata.json`
  - `resources/checklist-link.txt`
  - `resources/calibration-guide-link.txt` (or `NOT_AVAILABLE`)
- Context extraction:
  - `data/validator/library/context/raw_sheets/*.json` contains full row-level metadata for owners, aliases, regional context, and related operational data.
- Important:
  - This is deterministic workbook extraction (no LLM scoring dependency).
  - Most links require AWS Partner Central access.

## 10) Checklist-targeted rulepacks (current behavior)
- The validator now builds a deterministic rulepack per run using:
  - selected profile (`FTR`, `SDP`, `SRP`, `COMPETENCY`)
  - selected checklist target (from the generated library)
    - FTR uses fixed options: `Service Offering FTR` or `Software Offering FTR`
  - track-specific controls (`ftr`, `sdp`, `srp`, `competency`)
  - cross-cutting evidence/traceability checks
- Reports now include:
  - `rulepack.id`
  - `rulepack.version`
  - check severity/weight
  - matched keyword + pattern signals
- This gives profile + checklist-targeted scoring without LLM cost.

## 11) Sensitive-data protection in validator output
- Before scoring/output, extracted text is sanitized to redact:
  - email addresses
  - phone numbers
  - SSN-like values
  - long account/card-like numeric strings
- Redaction events are noted in the report processing notes and API metadata.
- Recommendation:
  - do not upload bank statements or unrelated sensitive documents.

## 12) Control-by-control calibration + edit guide download
- For `.xlsx` checklist uploads, validator now performs row-level control calibration:
  - detects control/requirement/response rows
  - evaluates each row (`PASS`, `PARTIAL`, `MISSING`)
  - provides row-level recommendation + suggested edit
  - attempts to fetch selected checklist/calibration material (when URL is reachable) and uses extracted terms for alignment checks
- Download output:
  - `Download Edit Guide (CSV)` returns:
    - sheet name
    - row number
    - exact `Partner Response` cell reference (example `D5`)
    - current response
    - suggested response (no new facts)
    - recommendation + missing signals
- Why CSV instead of rewriting the workbook:
  - preserving exact original checklist formatting/styles is safer by keeping the original workbook untouched.
- Download note:
  - very large edit guides may skip inline download in API response size-constrained environments.
- Safety rule:
  - Suggested edits are deterministic and do not invent claims; they only normalize existing text and add placeholders for missing factual evidence.
  - This does not guarantee “pass”; it highlights missing evidence quality signals so a human can complete factual details.

## 13) Local checklist reference mirror
- To verify what checklist/calibration links are reachable, run:
  - `python3 scripts/download_validator_references.py --workers 10 --timeout 12`
- Output:
  - `data/validator/references/manifest.json` with per-URL status.
  - `data/validator/references/files/` with downloaded pages/files (git-ignored).
- Current state:
  - Most reachable links resolve to HTML checklist pages.
  - Some links remain unreachable due network restrictions or gated Partner Central access.

## 14) Tiered credit wallets (validator)
- Credit purchases are tracked in wallet tiers:
  - `FTR`
  - `SDP/SRP`
  - `Competency`
  - `General` (legacy transitional wallet)
- Runtime behavior:
  - Profile `FTR` consumes from FTR wallet first.
  - Profiles `SDP` and `SRP` consume from SDP/SRP wallet first.
  - Profile `Competency` consumes from Competency wallet first.
  - If no tier wallet exists but legacy credits remain, `General` wallet is used as fallback.
- Stripe webhook now increments the correct wallet tier by price mapping.
- `/account` now shows wallet-by-wallet balances in a `Credit Wallets` section.

## 15) Database migration status
- Migration `0003_tiered_credit_wallets` adds:
  - `CreditTier` enum
  - `Price.creditTier`
  - `CreditBalance` table
- Transitional backfill:
  - existing validator entitlement credits are copied into `GENERAL` wallet so prior test credits are preserved.

## 16) Service request tracking (hub workflow)
- New service request lifecycle:
  - submit from `/services#service-request`
  - track by code/status in `/account`
  - admin updates in `/admin/service-requests`
- Statuses:
  - `SUBMITTED`, `TRIAGED`, `PROPOSAL_SENT`, `SCHEDULED`, `IN_PROGRESS`, `BLOCKED`, `DELIVERED`, `CLOSED`
- Migration:
  - `0004_service_requests_and_hub` creates `ServiceRequest` table and enums.

## 17) Production Prisma migration workflow
- GitHub Actions workflow:
  - `.github/workflows/production-prisma-migrate.yml`
- Trigger:
  - run manually with `workflow_dispatch` from the `main` branch only
- GitHub environment:
  - `production`
- Preferred secret in that environment:
  - `PRODUCTION_DIRECT_DATABASE_URL`
- Fallback secret:
  - `PRODUCTION_DATABASE_URL`
- Secret format requirement:
  - must be a full Postgres connection string beginning with `postgres://` or `postgresql://`
  - for Supabase, prefer the direct connection string for migrations when both direct and pooled URLs are available
- What the workflow does:
  - resolves `PRODUCTION_DIRECT_DATABASE_URL` first, then falls back to `PRODUCTION_DATABASE_URL`
  - validates the URL format before Prisma runs
  - checks out `main`
  - runs `npm ci`
  - runs `npm run prisma:migrate:deploy`
  - performs a read-only schema inspection against `information_schema.columns`
- Current architecture-review verification:
  - confirms `ArchitectureReviewJob.diagramBytes` is gone
  - confirms `workdriveDiagramFileId`, `workdriveReportFileId`, and `workdriveUploadStatus` exist
- When to use it:
  - after Prisma migrations merge to `main`
  - when Vercel does not provide a safe interactive production shell
- Safety note:
  - keep this workflow manual; do not auto-run production DB migrations on every push until deployment posture is more mature

## 18) Scheduled-job topology (current production posture)
- Vercel cron:
  - `vercel.json` only schedules `/api/internal/cron/retention-sweep`
  - Reason: the current Vercel Hobby plan only supports daily cron execution
- GitHub Actions workflows:
  - `.github/workflows/architecture-review-worker.yml`
    - drains the architecture queue every 5 minutes via `ARCH_REVIEW_WORKER_URL` + `ARCH_REVIEW_WORKER_SECRET`
  - `.github/workflows/architecture-followups.yml`
    - sends architecture follow-ups daily via `ARCH_REVIEW_FOLLOWUP_URL` + `ARCH_REVIEW_FOLLOWUP_SECRET`
  - `.github/workflows/calendly-booking-sync.yml`
    - polls Calendly every 15 minutes with `CALENDLY_PERSONAL_ACCESS_TOKEN`, then posts matched booked-call events to `CALENDLY_SYNC_INGEST_URL` using `CALENDLY_SYNC_SECRET`
    - on the free-plan path, the PAT should have read access for scheduled events and invitees; `users:read` is not required by the current poller implementation
  - `.github/workflows/zoho-sync-leads.yml`
    - triggers Zoho sync via `ZOHO_SYNC_URL` + `ZOHO_SYNC_SECRET`
- Operator note:
  - if Vercel production deployments fail with a cron-related error on the Hobby plan, inspect `vercel.json` first for any schedule more frequent than once per day
  - the current free Calendly posture uses polling rather than webhook subscriptions because webhook subscriptions require a paid Calendly plan
