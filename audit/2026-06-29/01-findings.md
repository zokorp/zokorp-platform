# 01 — Master Findings Catalog

**Repo:** `zokorp-platform` · **Audit commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345` (main, 2026-05-22)
**Audit date:** 2026-06-29 · **Mode:** read-only forensic · **Scope:** full line-by-line (reviewer + validator + whole repo)

This is the consolidated register. Full evidence, excerpts, and proposed (unapplied) fixes live in the
per-area reports (linked in the "Report" column). Six cross-agent duplicates were merged (noted inline).

## Severity tally (consolidated unique)

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 6 |
| Medium | 20 |
| Low | 32 |
| Info | 19 |
| **Total unique** | **77** |

Derived from **83 raw findings** across 9 workstreams; 6 duplicate clusters merged
(SEC-02≡ARCH-08, SEC-03≡VAL-01, COST-01≡VAL-11, REL-02≡ARCH-07, webllm: ARCH-Q05≡SEC-10≡DEP-08, ARCH-04≡REL structural note).

---

## CRITICAL (0)
None. No exploitable security hole, data loss, secret exposure, or wrong-output-at-scale that is *currently live* was found. (ARCH-Q01 is the closest — a correctness defect that *can* ship a wrong figure — rated High pending the magnitude check in `09`.)

---

## HIGH (6)

| ID | Title | Location | Cat | Report |
|---|---|---|---|---|
| ARCH-Q01 | Customer-facing quote (`estimateSnapshot.totalUsd`) has **no upper bound**; contradicts documented $650–$2,800 band | `lib/architecture-review/estimate-snapshot.ts:156,194-200` (rendered `email.ts:487,602`) | Correctness | [02d](02d-scoring-and-quote-correctness.md) |
| ARCH-01 | "Generate diagram" emits an SVG the app's **own** `validateSvgMarkup` rejects (`data:` icon hrefs) | `lib/architecture-review/diagram-generator.ts:1178-1195,1416-1418`; `svg-safety.ts:22-41` | Correctness | [02](02-architecture-review-deep-dive.md) |
| ARCH-02 | Domain (1/24h) + per-user rate limits consumed **before** payload validation → typo burns the domain's daily slot | `app/api/submit-architecture-review/route.ts:302-322,343-347,373` | Reliability | [02](02-architecture-review-deep-dive.md) |
| REL-01 | Worker not idempotent against **double-email** on partial failure after send (no provider key, no sent-marker, no `@@unique` on outbox `jobId`) | `lib/architecture-review/jobs.ts:1003-1308,922-932`; `prisma/schema.prisma:591-593` | Reliability | [05](05-reliability-cost-abuse.md) |
| DEP-02 | `overrides` pins **nodemailer to vulnerable 8.x** and blocks the only fixed line (9.0.1); 4 open advisories | `package.json:79-81`; reachable `lib/auth-email.ts:62`, `sender.ts:183` | Supply chain | [06](06-dependencies-supply-chain.md) |
| TYPE-04 | Env validation is **dead code**: zod `getEnv` has zero callers (~22/99 vars), all reads raw `process.env`, no boot fail-fast | `lib/env.ts:1-46` | Types/Validation | [07](07-testing-types-env.md) |

---

## MEDIUM (20)

| ID | Title | Location | Cat | Report |
|---|---|---|---|---|
| ARCH-Q02 | Two divergent quote engines; the stored `quote.ts` figure is **not** the customer headline | `quote.ts:647-761` vs `estimate-snapshot.ts:133-256` | Correctness | [02d](02d-scoring-and-quote-correctness.md) |
| ARCH-Q03 | Rendered quote applies **no confidence guardrail**; low-confidence reviews still emit a payable figure | `estimate-snapshot.ts:95-200` (esp. 210-211) | Correctness | [02d](02d-scoring-and-quote-correctness.md) |
| ARCH-03 | Raw internal error message returned to client on job failure | `lib/architecture-review/jobs.ts:1306-1307,1412` | Security | [02](02-architecture-review-deep-dive.md) |
| ARCH-04 | Full delivery pipeline runs **synchronously inline** in the submit HTTP request (2nd path into non-idempotent fn) | `app/api/submit-architecture-review/route.ts:401` | Reliability | [02](02-architecture-review-deep-dive.md) |
| ARCH-05 | `ToolRun` retains full report (incl. user paragraph) and is **excluded from retention sweep** | `jobs.ts:1133`; `lib/retention-sweep.ts:24-66` | Privacy | [02](02-architecture-review-deep-dive.md) |
| REL-02 | Submit idempotency/replay cache is **in-memory only** (non-durable on serverless) *(merges ARCH-07)* | `lib/idempotency-cache.ts:11,42-71`; submit route `:329-341` | Reliability | [05](05-reliability-cost-abuse.md) |
| COST-01 | Hourly rate-limit key trusts client `X-Forwarded-For` (spoofable) *(merges VAL-11)* | `lib/rate-limit.ts:57-68`; submit route `:344`; validator route `:40-44` | Cost/Abuse | [05](05-reliability-cost-abuse.md) |
| COST-02 | SPF/DKIM alignment undocumented; DMARC `p=none` for sending domain | `docs/05-dns-baseline-and-cutover-plan.md`; `sender.ts:239-263` | Cost/Abuse | [05](05-reliability-cost-abuse.md) |
| SEC-03 | Reference-material fetcher **follows redirects, no post-DNS private-range block** *(≡ VAL-01)* | `lib/validator-reference-material.ts:90-163` | Security (SSRF) | [04](04-security.md) / [02b](02b-validator-deep-dive.md) |
| VAL-03 | Edit-guide CSV export vulnerable to **formula (CSV) injection** | `lib/validator-control-review.ts:536-583` | Security | [02b](02b-validator-deep-dive.md) |
| CITE-09 | **No scheduled link/quote verification job** guards the citations shipped in the paid report email | `.github/workflows/` (absent) | Citation integrity | [03](03-citation-integrity.md) |
| SWP-01 | Zoho lead-sync legacy fallback can **bypass the CRM-consent filter** | `lib/zoho-sync-leads.ts:176-209` | Privacy | [02e](02e-whole-repo-sweep.md) |
| SEC-01 | `NEXTAUTH_SECRET` not hard-required at boot (`getAuthSecret` can return undefined) | `lib/auth-secret.ts:1-13` | Security | [04](04-security.md) |
| SEC-02 | `ARCH_REVIEW_FOLLOWUP_SECRET` still **falls back to `ZOHO_SYNC_SECRET`** *(merges ARCH-08)* | `app/api/architecture-review/followups/route.ts:43-46` | Security | [04](04-security.md) |
| SEC-04 | PDF 8-page cap is **client-side only**; no server page cap | `lib/architecture-review/client.ts:28-30` vs submit route `:206-208` | Security | [04](04-security.md) |
| SEC-06 | CSP allows `script-src 'unsafe-inline'` (and `'unsafe-eval'` non-prod) | `lib/csp.ts:22-25,36` | Security | [04](04-security.md) |
| PRIV-02 | Archive encryption key **silently falls back** to `NEXTAUTH_SECRET` then a hardcoded literal; no prod guard | `lib/privacy-leads.ts:54-64` | Privacy | [07](07-testing-types-env.md) |
| DEP-01 | Vitest pre-4.1 critical UI file-read/exec (dev-only) | `vitest@4.0.18`, `@vitest/coverage-v8@4.0.18` | Supply chain | [06](06-dependencies-supply-chain.md) |
| DEP-07 | PDF parsers handle untrusted uploads on stale pins | `pdf-parse@1.1.1`, `pdfjs-dist@5.6.205` | Supply chain | [06](06-dependencies-supply-chain.md) |
| GATE-01 | Business-email denylist is inherently incomplete (consumer + disposable bypass) | `lib/security.ts:7-101` | Security/Product | [10](10-corporate-domain-gating-spec.md) |

---

## LOW (32)

| ID | Title | Location | Report |
|---|---|---|---|
| ARCH-Q04 | Admin OVERRIDE band not validated for min≤max; max-only returns the max | `estimate-snapshot.ts:67-93`; `rule-catalog.ts:1183-1208` | [02d](02d-scoring-and-quote-correctness.md) |
| ARCH-Q05 | Zombie `webllm` mode in types + confidence math *(merges SEC-10, DEP-08)* | `quote.ts:61,148-150`; `types.ts:211` | [02d](02d-scoring-and-quote-correctness.md) |
| ARCH-06 | Server trusts client-supplied PNG/SVG evidence text without re-derivation | submit route `:155,241`; `jobs.ts:646-650` | [02](02-architecture-review-deep-dive.md) |
| REL-03 | No wall-clock timeout around job processing; 75s lease only | `jobs.ts:152,599-1308` | [05](05-reliability-cost-abuse.md) |
| REL-04 | Fixed 60s backoff; claim increments attempt even on interrupted runs | `jobs.ts:463,390-394` | [05](05-reliability-cost-abuse.md) |
| VAL-02 | Reference fetch bypasses shared `fetchWithTimeout` wrapper | `validator-reference-material.ts:90-137` vs `lib/http.ts:13-58` | [02b](02b-validator-deep-dive.md) |
| VAL-04 | PII sanitizer ordering/coverage gaps (undashed SSN leaks last-4) | `lib/validator-sanitizer.ts:75-100` | [02b](02b-validator-deep-dive.md) |
| VAL-05 | Non-FTR rule reaches PASS on 2 keyword hits, zero pattern corroboration | `zokorp-validator-engine.ts:782-801,2141-2165` | [02b](02b-validator-deep-dive.md) |
| VAL-06 | Control-review failure misreported as "unreadable spreadsheet"; workbook parsed twice | `lib/validator.ts:120-131`; route `:390-395` | [02b](02b-validator-deep-dive.md) |
| VAL-08 | Fallback estimate prices unknown rule ids off severity/guidance only | `lib/validator-estimate-catalog.ts:388-404` | [02b](02b-validator-deep-dive.md) |
| VAL-10 | Code-owned rules/rewrites JSON `as`-cast, no runtime (zod) validation | `lib/validator-ftr-launch-v1-catalog.ts:63-70` | [02b](02b-validator-deep-dive.md) |
| CITE-01 | GCP citations split across two hosts; `cloud.google.com` 301→`docs.cloud.google.com` | `gcp-launch-v1-catalog.ts:39-63` | [03](03-citation-integrity.md) |
| CITE-02 | Azure URLs omit `/en-us/` locale; all redirect (benign) | `azure-launch-v1-catalog.ts` | [03](03-citation-integrity.md) |
| CITE-03 | Azure managed-identity URL relocated `active-directory`→`entra` (fragile redirect) | `azure-launch-v1-catalog.ts` | [03](03-citation-integrity.md) |
| CITE-04 | `rel_fault_isolation_select_location.html`: 200 but body unverified (manual check) | `aws-launch-v1-catalog.ts:46,60` | [03](03-citation-integrity.md) |
| CITE-05 | Private-only rule cites Gateway-endpoints page that is explicitly NOT PrivateLink | `aws-launch-v1-catalog.ts:47` | [03](03-citation-integrity.md) |
| CITE-06 | Many GCP/Azure rules cite generic Well-Architected landing pages, not control-specific | `gcp-launch-v1-catalog.ts:39-63`; `azure-launch-v1-catalog.ts` | [03](03-citation-integrity.md) |
| CITE-07 | Two Snowflake URLs omit `/en/`, rely on redirect | `snowflake-launch-v1-catalog.ts:40,43` | [03](03-citation-integrity.md) |
| CITE-08 | Customer-facing link labels derived from URL substrings — edits can silently mislabel | `labelFor*Url()` in all 4 catalogs | [03](03-citation-integrity.md) |
| DEP-03 | Sentry/OpenTelemetry-core baggage DoS fanout | `@sentry/nextjs@10.53.1` (`@opentelemetry/core <2.8.0`) | [06](06-dependencies-supply-chain.md) |
| DEP-04 | Next bundled postcss XSS + version drift | `next@16.2.6` (`postcss <8.5.10`) | [06](06-dependencies-supply-chain.md) |
| DEP-05 | Transitive build/runtime libs, fixes available | `tmp/undici/vite/js-yaml/tar/@babel/core/esbuild` | [06](06-dependencies-supply-chain.md) |
| DEP-06 | `uuid <11.1.1` buffer-bounds (no fix without breaking downgrade) | via `exceljs@4.4.0` / `next-auth@4.24.14` | [06](06-dependencies-supply-chain.md) |
| SWP-03 | Same-origin check derives trusted set partly from `Host`/`X-Forwarded-Host` | `lib/request-origin.ts:70-103,129-160` | [02e](02e-whole-repo-sweep.md) |
| SEC-05 | Server `pdf-parse` runs on attacker bytes when `clientPdfText` absent | submit route `:203-213` | [04](04-security.md) |
| SEC-07 | CSP/HSTS emitted only when `NODE_ENV=production` | `next.config.ts:17-22` | [04](04-security.md) |
| TYPE-01 | GET query-param routes validate by presence-check, not zod | status/checkout/worker routes | [07](07-testing-types-env.md) |
| PRIV-01 | Authenticated user email logged to server logs on account-page error | `app/account/page.tsx:672` | [07](07-testing-types-env.md) |
| SEC-CI-01 | Six sync/scheduled workflows omit least-privilege `permissions:` | `.github/workflows/{architecture-followups,architecture-review-worker,calendly-booking-sync,zoho-sync-leads,zoho-sync-estimate-companions,zoho-sync-service-requests}.yml` | [07](07-testing-types-env.md) |
| TEST-01 | No test/boot-gate asserts env completeness | `lib/env.ts` | [07](07-testing-types-env.md) |
| GATE-02 | No MX/deliverability validation at submission (backstopped by verification) | `lib/security.ts:127-143` | [10](10-corporate-domain-gating-spec.md) |
| GATE-03 | Domain match is exact-host, not registrable-domain (eTLD+1) aware | `lib/security.ts:127-143` | [10](10-corporate-domain-gating-spec.md) |

---

## INFO (19)

| ID | Title | Report |
|---|---|---|
| ARCH-09 | **Positive controls confirmed**: recipient never user-controlled, no raw bytes, email injection-safe | [02](02-architecture-review-deep-dive.md) |
| ARCH-Q06 | Confidence band label (≥0.82) vs quote floor (<0.85) edges off by 0.03 | [02d](02d-scoring-and-quote-correctness.md) |
| ARCH-Q07 | Bare/unknown rule-id resolvers return null/echo silently — not exploitable in scoring/quote path | [02d](02d-scoring-and-quote-correctness.md) |
| REL-05 | Provider error bodies persisted to outbox/fallbackReason/audit (internal-only) | [05](05-reliability-cost-abuse.md) |
| VAL-07 | Sanitizer is not the XSS defense (XSS handled by React escaping + `escapeHtml`) | [02b](02b-validator-deep-dive.md) |
| VAL-09 | Engine-rule-id ↔ estimate-catalog-key coupling (currently aligned) | [02b](02b-validator-deep-dive.md) |
| VAL-12 | `additionalContext` echoed into report/email (self-XSS only; escaped) | [02b](02b-validator-deep-dive.md) |
| DEP-09 | License posture acceptable; copyleft is dual/weak only | [06](06-dependencies-supply-chain.md) |
| DEP-10 | Lockfile committed, registry-only, in sync | [06](06-dependencies-supply-chain.md) |
| SWP-02 | `app/account/billing/page.tsx` lacks explicit dynamic directive | [02e](02e-whole-repo-sweep.md) |
| SWP-04 | Schema model-count drift in CLAUDE.md (≈29 vs documented 31) | [02e](02e-whole-repo-sweep.md) |
| SEC-08 | `.eml`/CTA signing secrets fall back to `NEXTAUTH_SECRET` | [04](04-security.md) |
| SEC-09 | Admin allowlist no unicode/IDN normalization (mitigated by emailVerified) | [04](04-security.md) |
| TYPE-02 | Standalone typecheck excludes Next.js generated route/page types | [07](07-testing-types-env.md) |
| TYPE-03 | CSP-report + Calendly webhook bodies use custom parsers not zod | [07](07-testing-types-env.md) |
| TEST-02 | E2E suite non-hermetic (live DB + browser), readonly-safe by default | [07](07-testing-types-env.md) |
| A11Y-01 | axe coverage limited to curated routes, desktop-only | [07](07-testing-types-env.md) |
| GATE-04 | `zoho.com` denylisted while Zoho is the transactional email provider (intent check) | [10](10-corporate-domain-gating-spec.md) |
| (webllm) | Zombie `webllm`/llm-refine surface — tracked under ARCH-Q05; dep confirmed gone | [04](04-security.md)/[06](06-dependencies-supply-chain.md) |

---

## Positive controls verified (not defects — worth recording)
- Results emailed **only** to the verified account address; no user-supplied recipient (`free-tool-access.ts:56-62`, ARCH-09).
- Customer email **escapes every dynamic value** and does not embed the SVG; OCR text is data, not instructions (no LLM sink).
- Migration **0011 raw-byte removal is real and complete**; only stored blob is `ArchivedToolSubmission.payloadCiphertext` (AES-256-GCM, random IV, auth tag).
- **RLS enabled on every public table** (zero gaps across all migrations).
- **`requireAdmin` on every admin page + server action + leads export**; rule-catalog admin UI cannot edit code-owned hours/versions/citations.
- **Admin price overrides are correctly isolated** from code-owned remediation hours/weights/citations/versions.
- **Stripe webhook** is raw-body verified + idempotent (unique `stripeEventId` + unique `stripeCheckoutSessionId`, P2002 short-circuit).
- Password auth: **scrypt N=2¹⁵, timing-safe compare, enumeration-resistant dummy-hash**.
- Comprehensive `requireSameOrigin` CSRF coverage; magic-byte upload validation; strong SVG sanitizer.
- **No committed live secrets** (only the canonical AWS `EXAMPLE` key in a test fixture).
- `tsc` and `eslint` both clean; `any`/`@ts-ignore` count effectively zero.
- Validator route is **more** hardened than the free reviewer (CSRF + verified session + paid entitlement + atomic credit decrement + FTR profile restriction).
