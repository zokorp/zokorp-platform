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
