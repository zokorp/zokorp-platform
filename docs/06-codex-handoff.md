# Codex handoff (ZoKorp platform)

## Product goal
- Build a new ZoKorp platform with:
  - a public marketing/portfolio site
  - authenticated software product access
  - Stripe-powered one-time purchases and subscriptions
  - future usage-based billing support

## Fixed architecture decisions
- Frontend host/deploy: Vercel
- Source control: GitHub repo `zokorp-platform`
- Backend: Supabase (Postgres + Auth + Storage)
- Payments v1: Stripe only
- Payments v2: evaluate PayPal/Braintree later (do not implement now)
- Canonical domain: `www.zokorp.com` (apex should redirect to `www`)
- Domain registration: remain at Squarespace Domains (no transfer required)

## Public pages to build
- Home
  - preserve current messaging hierarchy
  - include consultation CTA to contact flow
  - include services preview section
  - include AI-in-Education media section
- About
  - founder credentials and ZoKorp mission
- Services
  - clear offerings and links
- Blog
  - listing + post detail pages (migrated content)
- Contact
  - contact form + contact details + LinkedIn link
- Additional platform pages (new):
  - `/products` (software catalog)
  - `/pricing`
  - `/login`, `/signup`, `/reset-password`
  - `/account` (profile + access status)
  - `/billing` (entry point to Stripe hosted customer portal)

## User journeys (implementation targets)
1. Visitor -> Marketing -> Contact
   - User lands on public page, navigates services/blog/about, submits contact form.
2. Visitor -> Product Catalog -> Purchase (one-time)
   - User selects one-time product, completes Stripe Checkout, returns with granted entitlement.
3. Visitor -> Product Catalog -> Subscription
   - User starts monthly/annual subscription via Stripe Checkout, returns with platform entitlement.
4. Returning customer -> Account -> Billing
   - User accesses account page and launches Stripe hosted portal to update payment method, review invoices, or manage subscription.
5. Authenticated user -> Gated tool
   - Access is granted only if active entitlement exists.

## Auth and account flows
- Current implementation uses NextAuth email magic-link auth (SMTP).
- Future migration to Supabase Auth can be evaluated separately if required.
- Required flows:
  - sign-up
  - login
  - password reset
  - session persistence and logout
- Redirect URLs must include:
  - Vercel preview URL(s)
  - production `https://www.zokorp.com`
- Do not add external OAuth providers unless explicitly requested.

## Billing and access model
- Stripe catalog (test mode IDs already mapped in `/docs/04-stripe-product-map.md`):
  - One-time:
    - FTR Validator — Single Run
    - Competency Validation Review — Single Purchase
  - Subscription:
    - ZoKorp Platform — Monthly
    - ZoKorp Platform — Annual
- Entitlement logic:
  - one-time purchase -> product-specific entitlement
  - active subscription -> platform entitlement
- Usage-based foundation:
  - reserve meter concept `platform_usage_units`
  - no production usage pricing until business approval
- Billing portal:
  - use Stripe hosted customer portal (do not build custom billing UI for v1)

## Suggested backend data model (minimum)
- `profiles` (user metadata)
- `products` (catalog metadata)
- `prices` (Stripe price mappings)
- `orders` (one-time payments)
- `subscriptions` (current and historical subscription states)
- `entitlements` (normalized access grants)
- `uploads` (file metadata for gated tools)
- `audit_events` (admin/system actions)

## MLOps MVP module (new)
- Routes:
  - `/mlops`
  - `/mlops/projects`
  - `/mlops/projects/:id`
  - `/mlops/runs`
  - `/mlops/models`
  - `/mlops/deployments`
  - `/mlops/monitoring`
  - `/mlops/settings/billing`
  - `/mlops/settings/organization`
- Multi-tenant entities:
  - `Organization`, `OrganizationMember`
  - `MlopsProject`, `MlopsJob`, `MlopsRun`
  - `MlopsModel`, `MlopsModelVersion`, `MlopsDeployment`
  - `MlopsMonitoringEvent`, `MlopsDriftSnapshot`
  - `MlopsRunnerKey`, `MlopsUsageLedger`, `MlopsArtifact`
- Execution model:
  - BYO compute runner package: `packages/zokorp-runner`
  - Runner polls API for jobs and reports status/logs
  - Artifacts uploaded via signed URLs to storage

## File upload requirements
- Planned Supabase Storage buckets:
  - `public-media` for public assets
  - `private-uploads` for authenticated/gated uploads
- Enforce row-level and storage policies so private uploads are only accessible by authorized users/admins.

## Validator knowledge + scoring status
- Knowledge library is generated from workbook data in:
  - `data/validator/library/ftr`
  - `data/validator/library/sdp`
  - `data/validator/library/srp`
  - `data/validator/library/competency`
- Validator UI/API now support selecting a specific checklist target (designation/competency) per run.
- Current scoring is deterministic and non-LLM:
  - profile baseline checks
  - weighted rulepack scoring with severity levels
  - track-specific controls (`ftr`, `sdp`, `srp`, `competency`)
  - target-alignment check from selected designation keywords
  - extracted text from uploaded PDF/XLSX content
  - regex-based evidence signals (dates, references, IDs, links, etc.)
- Spreadsheet-specific control workflow:
  - row-level control calibration (`PASS` / `PARTIAL` / `MISSING`)
  - row-level recommendations
  - reviewed Excel download with annotation columns + summary tab
  - reference-material fetch attempt for selected checklist/calibration URLs (reachable/public URLs only)
- No hallucination policy for suggested edits:
  - edits normalize existing user text and add placeholder prompts for missing evidence
  - no fabricated facts are inserted
- Sensitive-data guardrail:
  - extracted text is sanitized before scoring/output (emails/phones/SSN/long numeric identifiers redacted)
- Remaining gap for future phase:
  - ingesting and codifying per-checklist calibration-guide rules at deeper field-level precision.

## Admin/back-office requirements
- Admin dashboard capabilities:
  - view users and entitlement status
  - view order/subscription references
  - grant/revoke access overrides (with audit log)
  - inspect upload metadata and processing status

## Environment variable contract
- Use `/docs/03-environment-variables-template.md` as source of truth.
- Keep all secrets in deployment platform secret stores.
- Never commit secrets to repository.

## External service state (as currently documented)
- GitHub repo exists locally with docs scaffolding.
- Vercel project documented as `zokorp-web` (preview currently `404`, so no cutover).
- Supabase project documented with ref `jhjgrxbzjmhxqjaaerjb`.
- Stripe test catalog/product IDs documented.
- DNS baseline and rollback plan documented in `/docs/05-dns-baseline-and-cutover-plan.md`.

## Implementation sequence for Codex
1. Scaffold web app and route structure.
2. Rebuild public marketing pages with preserved content architecture.
3. Wire Supabase auth flows.
4. Implement product catalog and Stripe Checkout session creation endpoints.
5. Implement webhook handling and entitlement persistence.
6. Implement gated content/tool access checks.
7. Add account/billing pages with Stripe portal integration.
8. Add upload flow tied to auth + entitlement.
9. Add admin/back-office baseline screens.
10. Validate in preview before any domain cutover.

## Acceptance criteria
- Public pages parity with key current-site content and CTAs.
- Auth flows functional on preview.
- Stripe test purchases/subscriptions map correctly to entitlements.
- Billing portal launch works from account area.
- Upload flow respects authentication and entitlements.
- No secret leakage in source control.
- Domain cutover not attempted until preview is production-ready.

## Manual business/legal inputs still required
- Stripe live-mode legal entity + payout/banking onboarding
- Tax policy and tax region setup
- Terms of Service
- Privacy Policy
- Refund/dispute policy
- Final production pricing decisions
