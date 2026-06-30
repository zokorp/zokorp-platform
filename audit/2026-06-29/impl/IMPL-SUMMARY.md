# IMPL-SUMMARY — audit 2026-06-29 fixes implemented

**Branch:** `fix/audit-2026-06-29` (off `main` at the audited SHA `235bfca`, zero drift)
**Commits:** 14 (one logical commit per fix cluster, each referencing finding IDs)
**Gate:** `lint` ✓ · `typecheck` ✓ · `vitest` 493/493 ✓ · `build` ✓ · `npm audit` 23 → **0**
**Cutover dial:** Preview — pushed + PR opened; **not merged** (you do the prod merge after review).
**Migration:** authored offline, committed, rides the pipeline (`migrate deploy` on merge).

## What was fixed (by tier)

### Tier 0 — money/email correctness
- **DEP-01/02/03/04/05/06** — dependency tree to clean `npm audit` (nodemailer 9.0.3, next 16.2.9,
  vitest 4.1.9, sentry 10.62.0, postcss/uuid overrides). 23 vulns (2 critical, 4 high) → 0.
- **ARCH-02** — validate payload before consuming rate limits (a typo no longer burns the domain slot).
- **ARCH-Q01/Q02/Q03** — single source of truth for the quote (stored == emitted), hard-clamp to the
  documented **$650–$2,800** band, and force consultation-first on low confidence.
- **ARCH-01** — diagram generator inlines icons so its output passes the project's own
  `validateSvgMarkup` (generate→validate round-trip test; the data-URI test flipped).
- **REL-01 / ARCH-04** — idempotent report-email delivery: `@@unique([jobId])` outbox (+ dedup
  migration), `pending→sending` atomic claim, status-gated `failJob`, Resend `Idempotency-Key`; the
  inline + cron paths can no longer double-send.

### Tier 1 — security & abuse hardening
- **TYPE-04 / SEC-01/02/08 / PRIV-02** — real `lib/env.ts` schema + boot fail-fast (prod throws, dev
  warns), all secret cross-fallbacks removed.
- **SEC-04/05 / DEP-07** — server-side PDF page cap + gated text extraction, migrated pdf-parse → unpdf.
- **SEC-03 (VAL-01)** — SSRF-safe reference fetcher (host allowlist + IP deny ranges + connect-time IP
  pinning + manual redirect revalidation + caps).
- **COST-01 / VAL-03** — drop the spoofable XFF rate-limit key; neutralize CSV/formula injection.
- **SEC-06/07** — nonce + `strict-dynamic` CSP via the `proxy.ts` middleware, emitted in all envs.
- **SWP-01 / SEC-CI-01** — Zoho consent-bypass closed; least-privilege `permissions:` on 6 workflows.

### Tier 2 / Tier 3
- **CITE-09 / CITE-01/03/07/04** — scheduled citation link-checker + normalized all 13 redirecting URLs
  (47/47 now clean 200).
- **GATE-01/03** — vendored 120k-domain disposable dataset + overrides + eTLD+1 matching + weekly
  refresh-PR workflow + softened copy (`zoho.com` kept blocked per decision).
- **PRIV-01 / ARCH-Q04 / ARCH-Q05** — stop logging the user email; reject inverted override bands;
  remove the zombie `webllm` mode.

## Proving test per fix (all fail-before / pass-after)
| Fix | Test |
|---|---|
| ARCH-Q01/Q02/Q03 | `tests/architecture-review-quote-clamp.test.ts` (magnitude harness, clamp, floor, low-conf gate, stored==clamped); flipped `architecture-review-email.test.ts` low-conf case |
| ARCH-01 | `tests/architecture-review-diagram-generator.test.ts` (generate→validate round-trip; flipped data-URI assertion) |
| ARCH-02 | `tests/architecture-review-route.test.ts` (malformed submit doesn't consume rate limit) |
| REL-01 | `tests/architecture-review-email-outbox.test.ts` (post-send crash doesn't re-send; concurrent claim; P2002 race) |
| SEC-04/05 | `tests/architecture-review-route.test.ts` (12-page PDF → 413; gated extract) |
| SEC-03 | `tests/ssrf-safe-fetch.test.ts` (IP deny ranges; off-allowlist / metadata-IP / non-http rejected) |
| COST-01/VAL-03 | `tests/rate-limit.test.ts` + `tests/validator-csv-injection.test.ts` |
| SEC-06/07 | `tests/csp-header.test.ts` + `tests/middleware.test.ts` (nonce CSP on renders, not redirects/prefetches) |
| TYPE-04 | `tests/env-validation.test.ts` (fails fast naming each missing required var) |
| GATE-01/03 | `tests/security.test.ts` (vendored dataset + eTLD+1) |
| ARCH-Q04 | `tests/architecture-rule-catalog.test.ts` (inverted band rejected) |

## Dependency audit delta
`audit/2026-06-29/impl/npm-audit-before.json` → `npm-audit-after.json`:
**before** 23 (2 critical, 4 high, 15 moderate, 2 low) → **after 0**.
New deps: `unpdf`, `undici` (explicit), `tldts`, `disposable-email-domains`. Removed: `pdf-parse`,
`@types/pdf-parse`.

## Migration
`prisma/migrations/0026_architecture_review_email_outbox_unique_jobid/` — `@@unique([jobId])` on
`ArchitectureReviewEmailOutbox`, preceded by a `ROW_NUMBER()` dedup CTE so it applies safely against a
table that may already hold duplicate rows. Authored offline via `prisma migrate diff --script` (no
local Postgres); `prisma validate`/`generate` clean; REL-01 idempotency proven with the DB layer mocked.

## Visual gate
`next dev` at 1440×900 and 390×844 — home (desktop+mobile) and register render correctly with the CSP
middleware active, **0 console errors**. Screenshots in `.claude-screenshots/`
(`home-desktop-1440.png`, `home-mobile-390.png`, `register-desktop-1440.png`). The dev boot log also
showed the new env validation warning live (warns in dev, would throw in prod). CSP console-error check
on the production preview is still recommended (see IMPL-OPEN-DECISIONS §2).

## What you still need to do
See **ENV-VARS-TO-SET.md** (set before merge) and **IMPL-OPEN-DECISIONS.md** (prod env values, first
real send, preview CSP check, DNS records for COST-02, `zoho.com`/archive-key decisions, deferred Low/Info items).
