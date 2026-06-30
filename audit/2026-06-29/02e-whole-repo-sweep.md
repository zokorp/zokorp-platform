# Whole-Repo Sweep Audit (02e)

- **Repo:** zokorp-platform
- **Commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- **Date:** 2026-06-29
- **Mode:** READ-ONLY forensic. No edits, no network, no side-effecting calls.
- **Scope:** Admin surface + admin APIs, multi-host routing (`proxy.ts`), other free tools (mlops-forecast), cron + webhook routes, Zoho integration libs, Prisma schema + all migrations (RLS/PII), marketing/account/admin caching directives. (Arch-review data flow, scoring/quote, citations, security cross-cuts, reliability, validator subsystem, deps, types/testing are owned by sibling agents and excluded here.)

---

## Area: Admin surface / authz

**Verdict: requireAdmin is enforced on every admin page and every admin/mutating action.**

Admin gate chain (`lib/auth.ts:245-253`): `requireAdmin()` → `requireUser()` (session email → DB user) → `hasVerifiedAdminAccess(user)` which requires BOTH `emailVerified` AND the email being in the `ZOKORP_ADMIN_EMAILS` allowlist (`lib/admin-access.ts:16-18`). Throws `FORBIDDEN` otherwise. This is a strong, server-side, allowlist-based gate.

Admin pages (all `force-dynamic`, all call `requireAdminPageAccess` which wraps `requireAdmin`, `lib/admin-page-access.ts:5-19`):

| Page | Gate line | dynamic |
|---|---|---|
| `app/admin/products/page.tsx` | :51 `requireAdminPageAccess` | force-dynamic |
| `app/admin/prices/page.tsx` | :23 | force-dynamic |
| `app/admin/service-requests/page.tsx` | :69 | force-dynamic |
| `app/admin/leads/page.tsx` | :184 | force-dynamic |
| `app/admin/architecture-catalog/page.tsx` | :79 | force-dynamic |
| `app/admin/architecture-catalog/[ruleId]/page.tsx` | :82 | force-dynamic |
| `app/admin/billing/page.tsx` | :18 | force-dynamic |
| `app/admin/operations/page.tsx` | :24 | force-dynamic |
| `app/admin/readiness/page.tsx` | :51 | force-dynamic |

- **Leads CSV export** (`app/admin/leads/export/route.ts:8`): gated by `requireAdmin()` with explicit 401/403 handling. Returns PII (lead emails/companies) but only to verified admins; `Cache-Control: no-store`. OK.
- **Admin server actions** (`app/admin/actions.ts`): every one of the 14 exported actions calls `await requireAdmin()` as its first statement (create/toggle product/price, update service-request status, sync/save/publish rule catalog, retry email outbox, trigger Zoho syncs). Verified at lines 65, 92, 135, 160, 185, 232, 238, 251, 264, 282, 288, 294. OK.
- **`app/api/internal/audit-results/public-contract/route.ts`**: name is misleading ("public-contract") but it is NOT public — POST requires `CRON_SECRET` via `safeSecretEqual` (`:79`), zod-validates the payload (`:23-55`), and only writes an internal audit log; returns `{ok:true}` with no PII. GET returns 405. OK.

**Rule-catalog admin UI cannot edit code-owned fields — confirmed.** `parseArchitectureRuleCatalogFormInput` (`lib/architecture-review/rule-catalog.ts:1175-1208`) reads ONLY: `ruleId` (lookup key), `serviceLineLabel`, `publicFixSummary`, `internalResearchNotes`, `pricingMode`, `overrideMinPriceUsd`, `overrideMaxPriceUsd`, `nextReviewAt`, `changeSummary`. `saveArchitectureRuleCatalogDraft` / `publishArchitectureRuleCatalog` (`:1052-1173`) persist only those normalized fields. No path writes `officialSourceLinks`, `remediationHoursLow/High`, `confidenceGuidance`, `estimatePolicyBand`, versions, or citations — these remain code-owned (`codeSnapshotJson` is hydrated from code, not form input). Matches CLAUDE.md contract.

## Area: Proxy / multi-host routing (`proxy.ts`)

- Host split is driven by env-derived constants `APEX_HOST`, `MARKETING_HOST`, `APP_HOST` (`:6-8`). App-only path prefixes (`/login`, `/register`, `/account`, `/admin`, `/email-preferences`, `/access-denied`, `/forbidden`, `:11-19`) are force-redirected from the marketing host to the app host (`:140-142`), and app-host marketing pages redirect back to marketing (`:152-154`). The proxy is purely a host/canonicalization layer — it does NOT perform authz; that is done in each page/route. Reaching `/admin` on the "wrong" host just yields a redirect, then the server-side `requireAdmin` still applies. No authz bypass.
- **No open redirect.** `redirectToHost` (`:39-51`) only ever targets `MARKETING_HOST`, `APP_HOST`, or the request's own `host` (`:157`) — never an attacker-supplied destination. Protocol is forced to `https:` except for localhost targets.
- **Host-header trust:** the proxy reads `request.headers.get("host")` (`:107`) but only branches on equality with the configured hosts; an unknown host falls through to `NextResponse.next()`. Acceptable for a behind-Vercel deployment. See SWP-03 for the same-origin helper's softer host trust.
- Auth redirect safety is handled by `sanitizeAuthRedirectTarget` (`lib/callback-url.ts:44-61`): enforces same-origin, rejects `//`, `\`, CRLF, and decode failures. Robust against open redirect.

## Area: Other free tools (mlops-forecast)

`app/api/tools/mlops-forecast/route.ts` is well-gated: `requireSameOrigin` (`:39`), `requireUser()` (`:45`), per-user rate limit 20/hr (`:46-62`), `requireEntitlement` for `mlops-foundation-platform` (`:74-78`), file-type allowlist + size cap (`:91-108`). Numeric output in `lib/mlops-forecast.ts` is internally consistent (linear regression, cadence inference, confidence band, rounding) — no correctness defect found. Admin bypass surfaced honestly in the response (`access.adminBypass`).

## Area: Cron + webhook routes

All six internal cron routes follow an identical, correct pattern: 503 when `CRON_SECRET` is unconfigured, then `safeSecretEqual` (constant-time via `node:crypto.timingSafeEqual`, `lib/internal-route.ts:39-48`) against `x-cron-secret`/Bearer, 401 on mismatch. Verified:
- `operational-digest/route.ts:20-33`
- `retention-sweep/route.ts:20-33`
- `zoho-sync-estimate-companions/route.ts:20-30`
- `zoho-sync-leads/route.ts:20-31`
- `zoho-sync-service-requests/route.ts` (same pattern)
- `architecture-review-worker/route.ts:22-35`

Other secret-gated routes: `app/api/architecture-review/worker/route.ts` (`ARCH_REVIEW_WORKER_SECRET`, `:30-43`), `app/api/zoho/sync-leads/route.ts` (`ZOHO_SYNC_SECRET`, `:21-31`), `app/api/architecture-review/followups/route.ts` (`ARCH_REVIEW_FOLLOWUP_SECRET` ?? `ZOHO_SYNC_SECRET`, `:43-56`).

**Calendly webhook** (`app/api/webhooks/calendly/route.ts`): 503 when `CALENDLY_WEBHOOK_SIGNING_KEY` missing, then HMAC-SHA256 signature verification with a 300s timestamp tolerance and constant-time compare (`lib/calendly.ts:35-72`). Replay window is bounded. Idempotency: downstream `ingestArchitectureBookedCall` → `ensureLeadInteraction` dedupes on the unique `LeadInteraction.externalEventId` (`lib/privacy-leads.ts:215-265`, schema `:435`), with a P2002 fallback. OK.

**Calendly internal booked-call** (`app/api/internal/calendly/booked-call/route.ts`): `CALENDLY_SYNC_SECRET` via `safeSecretEqual` + zod body schema (`:13-43`). OK.

## Area: Zoho integration libs

- `lib/zoho-crm.ts` — tokens from env, refresh-token flow with single retry on `INVALID_TOKEN`/`INVALID_OAUTHTOKEN`, request body built via `JSON.stringify` with field truncation (no injection). Errors return codes/status, never the token. OK.
- `lib/zoho-invoice.ts` — env-resolved config with invoice→crm credential fallback; contact lookup uses `URLSearchParams` (`email_contains`) then re-filters with `exactContactEmailMatch` (`:270-300`) to avoid wrong-contact matches; all IDs in URLs are `encodeURIComponent`'d (`:323, :444, :557`). OK. Note: error fields embed truncated upstream response snippets (operator-facing only).
- `lib/zoho-workdrive.ts` — env tokens, sanitized filenames (`:190-192`), truncated body snippets in error strings (operator-facing). OK.
- `lib/zoho-service-request-sync.ts` — builds CRM description from service-request fields; values are passed through `JSON.stringify` in `upsertZohoLead` (no injection). OK.
- `lib/zoho-sync-leads.ts` — see SWP-01 (legacy schema-drift fallback drops the `allowCrmFollowUp` consent filter).

## Area: Prisma schema + migrations (RLS / PII / data loss)

- **Model count:** schema declares **29 models** (CLAUDE.md says "31"; minor doc drift, see SWP-04). All 29 verified.
- **RLS — enabled on every public table.** Cross-referencing every `CREATE TABLE` across `prisma/migrations/` against every `ENABLE ROW LEVEL SECURITY` statement yields zero tables created-but-not-RLS'd. Coverage: baseline 0012 (User, Product, Price, Entitlement, UsageEvent, AuditLog, Account, Session, VerificationToken, CheckoutFulfillment, CreditBalance, ServiceRequest, LeadLog, UserAuth, ArchitectureReviewJob/EmailOutbox, RateLimitBucket, `_prisma_migrations`, + retired tool tables); 0013 (Lead, LeadEvent, ArchivedToolSubmission, SubmissionFingerprint); 0015 (ArchitectureRuleCatalog + Revision); 0016 (LeadInteraction); 0019 (EstimateCompanion); 0021 (UserEmailPreference); 0022 (ToolRun, CreditLedgerEntry); 0024 (StripeWebhookEvent). Migrations leave tables closed-by-default and avoid `FORCE ROW LEVEL SECURITY` so the `BYPASSRLS` owner role keeps working (per 0012 header comment) — matches the CLAUDE.md RLS note.
- **Migration 0011 actually removed raw diagram bytes — confirmed.** `prisma/migrations/0011_architecture_review_remove_raw_bytes/migration.sql:11-12` executes `ALTER TABLE "ArchitectureReviewJob" DROP COLUMN "diagramBytes"`. The current schema's `ArchitectureReviewJob` (schema `:526-570`) stores only `diagramFileName`, `diagramMimeType`, and WorkDrive file IDs — no byte column. A full schema scan finds NO model storing raw diagram/file bytes (only `ArchivedToolSubmission.payloadCiphertext` which is AES-256-GCM encrypted, schema `:496`).
- **`StripeWebhookEvent.stripeEventId` is `@unique` — confirmed.** Schema `:203`; migration 0023 creates `CREATE UNIQUE INDEX "StripeWebhookEvent_stripeEventId_key"`. Idempotency primitive intact.

## Area: Caching (force-dynamic vs revalidate)

- All account/admin pages are dynamic. Exception: `app/account/billing/page.tsx` has no explicit `force-dynamic`/`revalidate` (SWP-02) but calls `await auth()` which reads cookies and thereby auto-opts the route into dynamic rendering; it also renders no PII (just a Stripe portal button) and redirects unauthenticated users. Low risk.
- Marketing/catalog pages correctly use `revalidate` (e.g. `app/software/page.tsx:11` `revalidate=300`, `app/case-studies/page.tsx:19` `revalidate=3600`) or `force-dynamic` where they read session/DB.

## Secrets scan

No committed live secrets. `git grep` for `sk_live_`/`whsec_`/`AKIA…`/private-key headers/Zoho `1000.<hex>` tokens over tracked non-doc files returns only the well-known AWS documentation placeholder `AKIAIOSFODNN7EXAMPLE` inside `tests/validator-control-review.test.ts:20` (a fixture, not a real key). No real `.env` files are tracked (`.env.example`/template only).

---

## Findings

### [SWP-01] Zoho lead-sync legacy fallback bypasses CRM-consent filter
- **Severity:** Medium
- **Category:** Privacy
- **Location:** `lib/zoho-sync-leads.ts:139-210` (legacy branch `:176-209`)
- **Evidence:** The primary query filters on consent — `where: { allowCrmFollowUp: true, OR: [{ syncedToZohoAt: null }, { zohoSyncNeedsUpdate: true }] }` (`:142-145`). The schema-drift catch branch re-queries WITHOUT that filter:
  ```ts
  } catch (error) {
    if (!isSchemaDriftError(error)) { throw error; }
    const legacyLeads = await db.leadLog.findMany({
      where: { syncedToZohoAt: null },   // <-- no allowCrmFollowUp gate
      ...
  ```
  All such leads are then upserted to Zoho CRM (`:222-243`).
- **Impact:** If the `LeadLog.allowCrmFollowUp` column is ever unavailable (schema drift / mid-migration), the sync would push leads to the external CRM that may not have consented to CRM follow-up. This is a privacy/consent regression rather than an active leak (it requires the drift condition).
- **Recommendation (NOT APPLIED):** In the legacy branch, either skip the sync entirely (return `schema_unavailable`) or keep a conservative default that excludes leads when consent cannot be determined, rather than syncing everything.
- **References:** schema `LeadLog.allowCrmFollowUp` (prisma/schema.prisma:368); `lib/db-errors.ts` `isSchemaDriftError`.
- **Verification:** Read both query branches; confirmed only the primary branch filters on `allowCrmFollowUp`. Static read only (DB not connected).

### [SWP-02] `app/account/billing/page.tsx` lacks explicit dynamic directive
- **Severity:** Info
- **Category:** Reliability
- **Location:** `app/account/billing/page.tsx:14-20`
- **Evidence:** No `export const dynamic`/`revalidate`. The page does `const session = await auth();` (`:15`) and `redirect()`s when no session.
- **Impact:** Negligible. `auth()` consumes request cookies, which forces Next.js to render the route dynamically, so it will not be statically cached. The page also renders no PII (only a portal button). Flagged for consistency with every other `/account` and `/admin` page, which set `force-dynamic` explicitly.
- **Recommendation (NOT APPLIED):** Add `export const dynamic = "force-dynamic";` to make the intent explicit and guard against future refactors that drop the `auth()` call.
- **Verification:** Read file; confirmed `auth()` usage and absence of cache directive; compared against sibling account/admin pages.

### [SWP-03] Same-origin check derives part of its trusted set from the Host/X-Forwarded-Host header
- **Severity:** Low
- **Category:** Security (hardening)
- **Location:** `lib/request-origin.ts:70-103, 129-160`
- **Evidence:** `requireSameOrigin` compares the request's `Origin`/`Referer` against `trustedRequestOrigins`, which adds `hostHeaderOrigin(request)` built from `x-forwarded-host` (then `host`) plus `x-forwarded-proto` (`:70-87, :98-99`).
- **Impact:** The trusted set is partly attacker-influenceable via forged Host/Forwarded headers. In practice this is NOT exploitable as CSRF from a browser: a cross-site request carries the attacker's own `Origin`, which still won't match the (also-forged) host unless the attacker controls both — and browsers don't let a page forge the `Origin` to the victim's domain. It is defense-in-depth softness, not a live bypass, and partly mitigated because Vercel normalizes the Host at the edge.
- **Exploitability:** Low. Requires a non-browser client that can set arbitrary `Origin` AND `Host`/`X-Forwarded-Host` to the same value — at which point it is effectively a server-to-server caller, which the CSRF check is not designed to stop. No evidence of a browser-driven bypass.
- **Recommendation (NOT APPLIED):** Prefer comparing `Origin` against a fixed allowlist derived solely from `NEXT_PUBLIC_SITE_URL` / configured marketing+app hosts, and treat forwarded host headers as untrusted in production.
- **References:** `lib/site-origin.ts` `getSiteOriginFromRequest`.
- **Verification:** Read full `request-origin.ts`; traced `trustedRequestOrigins` → `hostHeaderOrigin`.

### [SWP-04] Schema model count drift in CLAUDE.md (29 vs documented 31)
- **Severity:** Info
- **Category:** Correctness (docs)
- **Location:** `prisma/schema.prisma` (29 `model` declarations) vs `CLAUDE.md` ("31 models")
- **Evidence:** `grep -c '^model ' prisma/schema.prisma` = 29. Migrations 0007/0008/0010/0017 created and then retired several tool-submission tables (LandingZoneReadinessSubmission, CloudCostLeakFinderSubmission, AiDeciderSubmission) which no longer exist as models, explaining the drift.
- **Impact:** Documentation-only; no runtime effect.
- **Recommendation (NOT APPLIED):** Update CLAUDE.md to "29 models" (and the "26 migrations" count — there are 25 numbered migration dirs).
- **Verification:** Counted models in schema and migration directories directly.

---

## Summary

**Severity counts:** Critical 0 · High 0 · Medium 1 · Low 1 · Info 2

The remaining (non-sibling-owned) surfaces are in solid shape. Admin authz, cron/webhook secret verification, RLS coverage, the diagram-bytes removal, Stripe idempotency key, and the rule-catalog field allowlist all hold up. The one substantive finding (SWP-01) is a consent-filter gap that only triggers under schema drift.
