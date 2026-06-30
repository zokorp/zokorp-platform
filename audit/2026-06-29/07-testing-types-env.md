# 07 — Testing, Types, Env, CI Security, Privacy & A11y Audit

- **Repo:** `zokorp-platform`
- **Audit commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- **Audit date:** 2026-06-29
- **Mode:** READ-ONLY forensic audit. No edits, no git writes, no side-effecting commands. No tests were executed (static analysis only; hermeticity confirmed but suite not run per scope).
- **Scope:** Types/Validation, Env validation, Testing, CI security, Privacy, A11y (light).

---

## Static gate results (precomputed)

| Gate | Result |
|---|---|
| `tsc --noEmit -p tsconfig.typecheck.json` | **CLEAN** (`tsc-exit=0`, 0 errors) — `scratchpad/tsc.txt` |
| `eslint .` | **CLEAN** (`eslint-exit=0`, 0 problems) — `scratchpad/eslint.txt` |

Both gates are green.

---

## 1. Types / Validation

**Overall: strong.** The codebase is unusually clean on type-safety escape hatches.

- **`any` leakage: effectively zero.** Across `lib/`, `app/`, `components/`, `scripts/`:
  - `as any`: **0** real casts. (The only grep hit, `lib/case-studies.ts:298`, is the English phrase "…as any other workload" inside a string literal — not a cast.)
  - `: any` type annotations: **0**.
  - `@ts-ignore` / `@ts-expect-error`: **0**.
  - `eslint-disable`: **1**, and it is benign — `components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm.tsx:1674` suppresses `@next/next/no-img-element` (a styling lint, not a type/quality escape).
- **No `any` at external boundaries.** Boundary parsing uses zod with inferred types (`z.infer<...>`), not `any`.

### tsconfig vs tsconfig.typecheck.json delta

`tsconfig.typecheck.json` `extends` `tsconfig.json`, so `strict: true` and all compiler options are **inherited unchanged** (no weakening of `strict`, `noImplicitAny`, etc.). The only deltas are in `include`/`exclude`:

| | `tsconfig.json` | `tsconfig.typecheck.json` |
|---|---|---|
| `include` | adds `.next/types/**/*.ts`, `.next/dev/types/**/*.ts`, `next-env.d.ts`, `**/*.ts(x)`, `**/*.mts` | `next-env.d.ts`, `**/*.ts(x)`, `**/*.mts` — **drops the `.next/**` generated type globs** |
| `exclude` | `node_modules` | `node_modules`, **`.next`** |

**Interpretation:** the typecheck config does NOT exclude any *first-party source* — all `lib/app/components/tests/scripts` `.ts(x)`/`.mts` files are still checked under full `strict`. The only thing dropped is Next.js's **generated** route/page-prop type validation under `.next/types/**`. That is intentional and reasonable (those types only exist after a build; CI runs `build` separately), but it means the standalone `npm run typecheck` gate does **not** catch Next.js page/route prop-shape regressions — those are only caught by `next build`. This is a minor coverage seam, not a hidden-error mechanism. See **TYPE-02**.

### Zod at boundaries

Boundary coverage was audited across all 34 `app/api/**/route.ts` handlers (sub-agent sweep + spot verification). **22 of 24 input-bearing routes validate with zod.** POST/JSON and FormData bodies are consistently zod-validated (`.parse`/`.safeParse`). The exceptions are three **GET query-param** routes that do presence checks instead of zod, plus the env layer (Section 2). See **TYPE-01**, **TYPE-03**.

---

## 2. Env validation

**Env validation is INCOMPLETE — and the partial validator that exists is DEAD CODE.**

- `lib/env.ts` defines a zod `envSchema` + `getEnv()` covering ~22 vars (DATABASE_URL, NEXTAUTH_SECRET, EMAIL_SERVER_*, STRIPE_*, a few price IDs).
- **`getEnv()` has ZERO callers.** Repo-wide grep (excluding `node_modules`, `.next`, `.claude/worktrees`) finds exactly one reference: its own definition at `lib/env.ts:33`. No file imports `@/lib/env`. So the schema never runs — env is never validated at startup.
- Every actual env read in `lib/`/`app/` is raw `process.env.X` (no parsing, no coercion, no fail-fast). ~70 distinct vars are read this way.
- `.env.example` declares **99** keys; `lib/env.ts` validates ~22. The unvalidated set includes security-critical and integration-critical vars:
  - **Secrets / signing:** `CRON_SECRET`, `ARCH_REVIEW_*_SECRET` (EML/WORKER/FOLLOWUP/CTA), `ZOHO_*` tokens/secrets, `ZEPTOMAIL_TOKEN`, `RESEND_API_KEY`, `ARCHIVE_ENCRYPTION_SECRET`, `CALENDLY_WEBHOOK_SIGNING_KEY`, `CALENDLY_SYNC_SECRET`, `EMAIL_PREFERENCES_SECRET`, `AUTH_SECRET`.
  - **Config:** `ZOHO_*` domains/IDs, `ARCH_REVIEW_DAILY_LIMIT`, `ARCHITECTURE_REVIEW_UPLOAD_MAX_MB`, `SENTRY_*`, `PUBLIC_SUBSCRIPTION_PRICING_APPROVED`, `AUTH_PASSWORD_ENABLED`, all `JOURNEY_*`/`SMOKE_*`/`UPTIME_*` operational vars.

There IS a partial runtime safety net: `lib/runtime-readiness.ts` checks a subset (`CRON_SECRET`, `ARCHIVE_ENCRYPTION_SECRET`, `ARCH_REVIEW_EML_SECRET`, etc.) and surfaces missing ones on the `/admin/readiness` dashboard. But this is an *advisory* dashboard, not a fail-fast boot gate.

See **TYPE-04** (incomplete/dead env validation), **PRIV-02** (archive-secret fallback).

**Answer: env validation is NOT complete.** A single zod schema, imported and invoked at process boot (and re-exported for all `process.env` reads), covering all ~99 declared vars with correct optionality per surface, is recommended.

---

## 3. Testing

**Coverage: broad. Hermeticity: confirmed for unit tests; E2E is intentionally non-hermetic.**

- **118 unit/component test files** under `tests/` (`*.test.ts`/`*.test.tsx`), run by Vitest (`vitest.config.ts`, `environment: "node"`).
- **High-risk logic IS covered:**
  - Scoring/engine: `architecture-review-engine.test.ts`, `validator-engine.test.ts`, `architecture-rule-catalog.test.ts`, `architecture-review-observation.test.ts`.
  - Quote/estimate: `architecture-review-quote.test.ts`, `quote-line-items.test.ts`, `validator-estimate-catalog.test.ts`, `estimate-companions.test.ts`.
  - Citation/reference: `validator-reference-material.test.ts`, `architecture-review-case-study-links.test.ts`.
  - Email: `architecture-review-email.test.ts`, `architecture-review-sender.test.ts`, `architecture-review-followup-email.test.ts`.
  - Worker/jobs: `architecture-review-worker-route.test.ts`, `internal-architecture-review-worker-cron-route.test.ts`.
  - Privacy/retention: `privacy-leads.test.ts`, `retention-sweep.test.ts`, `retention-sweep-route.test.ts`.
  - Diagram safety: `architecture-review-diagram-generator.test.ts`, `architecture-review-svg-safety.test.ts`, `validator-sanitizer.test.ts`.
- **Unit tests are HERMETIC.** `vitest.config.ts` declares **no `setupFiles`**, so there is no global infra harness — yet every test that touches infra mocks it:
  - 59 of 118 files use `vi.mock`.
  - **No test imports `@/lib/db` without `vi.mock("@/lib/db", …)`** (verified by scripted check — zero "real DB" hits).
  - `architecture-review-sender.test.ts` mocks both `nodemailer` (`createTransport`) and `lib/http` (`fetchWithTimeout`) — no real SMTP/HTTP to ZeptoMail/Resend.
  - `privacy-leads.test.ts` mocks `@/lib/db`; crypto helpers run pure (no network).
- **E2E (`tests/e2e/`) is NOT hermetic — and should not be run in this audit.** `tests/e2e/global.setup.ts` hits a **real DB** (`db.user.upsert`, `db.$queryRaw\`SELECT 1\``) and launches a **real Chromium** to sign in against a running app (gated by `localAuthBootstrapEnabled`). This is by design for E2E; flagged so the audit does not invoke it.
- **E2E mutation mode is SAFE BY DEFAULT.** `tests/e2e/helpers.ts:6` — `mutationMode = (process.env.E2E_MUTATION_MODE ?? "readonly").toLowerCase()`. Mutating specs `test.skip` unless mutation mode is explicitly enabled (e.g. `tests/e2e/marketing.spec.ts:214`). The `.mjs` journey scripts mirror this with `JOURNEY_MUTATION_MODE` defaulting to `"readonly"`.

**Gaps / observations:** `lib/env.ts` has no test (consistent with it being dead code). See **TEST-01** (no boot-time env validation test, tied to TYPE-04), **TEST-02** (E2E non-hermeticity is documented, not a defect).

**Answer: unit tests are hermetic (db/email/http all mocked); E2E intentionally requires live DB+app and is readonly-safe by default.**

---

## 4. CI security

12 workflows under `.github/workflows/`. **No injection or secret-exfil vulnerability found.**

- **No `pull_request_target`.** No workflow checks out untrusted PR head and runs it with secrets. `ci.yml` runs on `pull_request` (default `GITHUB_TOKEN`, `permissions: contents: read`) but only runs lint/typecheck/test/build with placeholder env values — no real secrets exposed to PR code.
- **No untrusted-input → shell injection.** No `${{ github.event.* }}` / PR title / branch name is interpolated into `run:` blocks. `automerge-labeled-prs.yml` runs on `schedule`/`workflow_dispatch` (not on PR events) and feeds only `gh pr list --jq '… | .number'` (integers) into the loop — safe.
- **Secrets handled correctly.** All secrets passed via `env:` and referenced as shell vars (`"$SECRET"`), never `echo`'d. `production-prisma-migrate.yml` writes a resolved DB URL to `$GITHUB_ENV` but does not print it; it validates the URL scheme and guards `main`-only.
- **`set -euo pipefail`** used in the multi-line scripts; `curl --fail` on the trigger workflows.

**Least-privilege gap (not injection):** 6 workflows omit a top-level `permissions:` block, so they inherit the repo/org default `GITHUB_TOKEN` scope (which may be read-write `contents`): `architecture-followups.yml`, `architecture-review-worker.yml`, `calendly-booking-sync.yml`, `zoho-sync-leads.yml`, `zoho-sync-estimate-companions.yml`, `zoho-sync-service-requests.yml`. They only `curl` an external endpoint or run a sync script and need **no** token write — they should pin `permissions: {}` or `contents: read`. See **SEC-CI-01**.

**Answer: NO CI workflow is vulnerable to command/script injection or runs untrusted PR code with secrets.** The only CI issue is missing least-privilege `permissions:` on 6 trigger/sync workflows.

---

## 5. Privacy

**Strong posture overall.** Raw bytes not persisted; archival is real AEAD and opt-in; retention sweep exists. Two issues: an encryption-key fallback chain and one PII-in-logs site.

- **Raw diagram bytes are NOT persisted — CONFIRMED.** Migration `0011_architecture_review_remove_raw_bytes/migration.sql` does `ALTER TABLE "ArchitectureReviewJob" DROP COLUMN "diagramBytes";` (after marking legacy rows). A CI guard in `production-prisma-migrate.yml` (lines 95–107) asserts `diagramBytes` is *forbidden* and the WorkDrive file-id columns are *required* in the production schema. Diagrams flow to Zoho WorkDrive by reference, not into Postgres.
- **Archive encryption is REAL AEAD — CONFIRMED AES-256-GCM.** `lib/privacy-leads.ts:289-297` (`encryptArchivePayload`): `createCipheriv("aes-256-gcm", key, iv)` with a fresh random 12-byte IV per call (`randomBytes(12)`), authenticated tag captured via `cipher.getAuthTag()`, and serialized as `iv || tag || ciphertext` base64. This is genuine authenticated encryption, **not** plaintext or a deprecated `createCipher`. Stored in `ArchivedToolSubmission.payloadCiphertext`. (Minor: key is derived by plain `sha256(secret)` — acceptable for a high-entropy secret, though HKDF-with-salt would be stronger.)
- **Archival is OPT-IN — CONFIRMED.** `lib/architecture-review/jobs.ts:495` `wantsFollowUpArchive(metadata)` returns `metadata.saveForFollowUp ?? metadata.archiveForFollowup ?? false` — **defaults false**. Consent flags default `false` in zod (`lib/tool-consent.ts:27-28`). Job sets `workdriveUploadStatus = saveForFollowUp ? "pending" : "not_requested"` (`jobs.ts:749`).
- **Retention sweep exists.** `lib/retention-sweep.ts` `runRetentionSweep()` deletes expired `archivedToolSubmission` + `submissionFingerprint`, scrubs lead logs, and redacts architecture email outbox bodies (`REDACTED_EMAIL_TEXT`). Driven by `app/api/internal/cron/retention-sweep` (secret-gated). Tested (`retention-sweep.test.ts`).
- **PII-in-logs scan:** 56 `console.*` calls in `lib/app`. No IP/`x-forwarded-for`/password/token logging. The privacy-email route logs only `requestId` (good). **One site logs an email:** `app/account/page.tsx:672` — `console.error("Failed to load account page data.", { email, error })` logs the authenticated user's email to server logs/Sentry on a DB error. Low severity (email is low-sensitivity PII, server-side only), but it is plaintext PII in logs. See **PRIV-01**.

See **PRIV-02** (archive-secret fallback chain).

**Answer: ARCHIVE_ENCRYPTION_SECRET drives real AES-256-GCM AEAD encryption (random IV + auth tag) — yes, it is genuine authenticated encryption.** Caveat: silent fallback to `NEXTAUTH_SECRET` then a hardcoded literal (PRIV-02).

---

## 6. A11y (light)

- **`@axe-core/playwright` is present and wired** (`package.json:60` → `^4.11.0`). `tests/e2e/accessibility.spec.ts` builds `AxeBuilder({ page }).withTags([wcag2a/aa, wcag21a/aa, wcag22a/aa]).analyze()` and **fails on any `serious`/`critical` violation** across all required marketing routes plus `/software` (signed-out) and `/login`.
- Runs on `desktop-chromium` only; uses `reducedMotion: "reduce"`.
- **Observation (not a defect):** axe runs only on a curated route list and only at desktop viewport; authenticated/admin surfaces and mobile (390×844) are not axe-scanned. Coverage is reasonable for "light." See **A11Y-01**.

---

# Findings

### [TYPE-04] Env validation is incomplete and the zod env validator is dead code
- **Severity:** High
- **Category:** Types/Validation
- **Location:** `lib/env.ts:1-46` (esp. `getEnv` at `:33`); raw reads across `lib/` & `app/`
- **Evidence:** `lib/env.ts` validates ~22 vars but `getEnv()` is referenced exactly once — its own definition. No file imports `@/lib/env` (verified repo-wide, excluding `node_modules`/`.next`/`.claude/worktrees`). All ~70 distinct env reads use raw `process.env.X` with no parse. `.env.example` declares 99 keys; unvalidated set includes `CRON_SECRET`, `ARCH_REVIEW_*_SECRET`, `ZOHO_*` tokens, `ZEPTOMAIL_TOKEN`, `RESEND_API_KEY`, `ARCHIVE_ENCRYPTION_SECRET`, `CALENDLY_WEBHOOK_SIGNING_KEY`.
- **Impact:** No fail-fast at boot. A missing/typo'd secret (e.g. a webhook signing key or `CRON_SECRET`) surfaces as a runtime 500 or a silently-skipped check deep in a request path instead of at startup. Type information for env is lost at every raw read.
- **Recommendation (NOT APPLIED):** Build one complete zod schema covering all 99 declared vars (correct optionality per surface/runtime), invoke it at process boot (e.g. import for side-effect in `instrumentation.ts`), and route every `process.env` read through the parsed object. Mark `getEnv()` either wired-in or remove it.
- **References:** `lib/env.ts`; `.env.example`; `docs/03-environment-variables-template.md`; `lib/runtime-readiness.ts` (existing advisory check).
- **Verification:** `grep -rn "getEnv\|@/lib/env" lib app components scripts` → only `lib/env.ts:33`. `grep -rhoE "process\.env\.[A-Z0-9_]+" lib app` → 70 distinct vars read raw.

### [TYPE-01] GET query-parameter routes validate by presence-check instead of zod
- **Severity:** Low
- **Category:** Types/Validation
- **Location:** `app/api/architecture-review-status/route.ts:12-16`; `app/api/architecture-review/checkout/route.ts:18-23`; `app/api/architecture-review/worker/route.ts` (`parseLimit`, ~:19-26)
- **Evidence:** `architecture-review-status`: `const jobId = requestUrl.searchParams.get("jobId")?.trim(); if (!jobId) …` — no zod. `checkout`: same for `jobId` + `estimateReferenceCode`. `worker`: `parseLimit` does manual `Number.parseInt` then clamps `Math.max(1, Math.min(10, parsed))`.
- **Impact:** Low. All three are well-defended by other means: `architecture-review-status` is `requireUser()`-gated with an ownership check (`job.userId !== user.id` → 404); `checkout` requires both params to resolve to a real job; `worker` clamps `limit` to `[1,10]` and is secret-gated upstream. No injection sink (params feed Prisma `where` by value). Issue is consistency with the "zod at every boundary" convention, not exploitability.
- **Recommendation (NOT APPLIED):** Parse query params with a small zod schema (`z.object({ jobId: z.string().min(1) })` / `z.coerce.number().int().min(1).max(10)`) for uniformity and clearer 400s.
- **References:** CLAUDE.md "Zod at every external boundary."
- **Verification:** `sed -n` on each route confirmed the get/trim + presence-check pattern with no `.parse`/`.safeParse`.

### [TYPE-02] Standalone typecheck excludes Next.js generated route/page types
- **Severity:** Info
- **Category:** Types/Validation
- **Location:** `tsconfig.typecheck.json` (include/exclude) vs `tsconfig.json:25-33`
- **Evidence:** `tsconfig.json` includes `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`; `tsconfig.typecheck.json` drops those globs and adds `.next` to `exclude`. `strict` and all other options are inherited unchanged.
- **Impact:** Informational. `npm run typecheck` does not validate Next.js generated page/route prop shapes — those regressions are only caught by `next build` (run separately in CI `build` job). No first-party source is excluded; this is not an error-hiding mechanism.
- **Recommendation:** None required; ensure the CI `build` job remains a required gate so generated-type checks aren't lost.
- **Verification:** Diffed both files; `strict: true` present via `extends`.

### [TYPE-03] CSP-report and Calendly webhook bodies use custom parsers, not zod
- **Severity:** Info
- **Category:** Types/Validation
- **Location:** `app/api/security/csp-report/route.ts` (`parseCspReportBody`, ~:43); `app/api/webhooks/calendly/route.ts` (`parseCalendlyWebhookPayload`, ~:39)
- **Evidence:** Both parse with bespoke functions rather than a zod schema. Calendly verifies an HMAC-SHA256 signature *before* parsing; Stripe webhook relies on the Stripe SDK's `constructEvent` for structural validation.
- **Impact:** Informational. Signature verification gates the webhook; CSP reports are write-only telemetry. Not a security gap, but diverges from the zod convention and the custom CSP parser's strictness should be confirmed.
- **Recommendation (NOT APPLIED):** Consider a zod schema for the CSP report body to bound accepted structure; keep signature-verify-then-parse order for webhooks.
- **Verification:** Sub-agent route sweep; signature checks present in both webhook handlers.

### [PRIV-02] Archive encryption key silently falls back to NEXTAUTH_SECRET then a hardcoded literal
- **Severity:** Medium
- **Category:** Privacy
- **Location:** `lib/privacy-leads.ts:54-64`
- **Evidence:**
  ```
  function archiveSecret() {
    return (
      process.env.ARCHIVE_ENCRYPTION_SECRET ??
      process.env.NEXTAUTH_SECRET ??
      "local-dev-archive-secret-not-for-production"
    );
  }
  function deriveArchiveKey() { return createHash("sha256").update(archiveSecret()).digest(); }
  ```
  No `NODE_ENV`/production guard — the fallback chain applies in every environment.
- **Impact:** If `ARCHIVE_ENCRYPTION_SECRET` is unset in production, archives are encrypted under (a) the auth secret — collapsing two security boundaries (auth + archive confidentiality) — or, if `NEXTAUTH_SECRET` is also unset, (b) a **publicly-known hardcoded constant**, rendering opt-in archived submissions trivially decryptable. The crypto itself (AES-256-GCM) is correct; the key-management fallback is the weakness. `lib/runtime-readiness.ts:319-340` flags this on the readiness dashboard (advisory only), confirming it's a known risk path.
- **Recommendation (NOT APPLIED):** In production, fail closed — throw if `ARCHIVE_ENCRYPTION_SECRET` is unset rather than falling back; never derive an archive key from a compiled-in literal outside local dev. Prefer HKDF (salt + info) over bare `sha256` for key derivation.
- **References:** `lib/privacy-leads.ts:54-64,289-297`; `lib/runtime-readiness.ts:319-340`.
- **Verification:** Read the function; confirmed no env/NODE_ENV guard and the literal default.

### [PRIV-01] Authenticated user email written to server logs on account-page load error
- **Severity:** Low
- **Category:** Privacy
- **Location:** `app/account/page.tsx:672`
- **Evidence:** `console.error("Failed to load account page data.", { email, error });` — `email` is the signed-in user's address.
- **Impact:** Email (low-sensitivity PII) lands in Vercel/Sentry server logs on DB error. Not user-controlled exfil, but plaintext PII in logs; conflicts with the redaction discipline applied elsewhere (e.g. privacy-email route logs only `requestId`).
- **Recommendation (NOT APPLIED):** Log a non-PII correlation id (user id or hashed email) instead of the raw address.
- **References:** Contrast `app/api/architecture-review/privacy-email/route.ts:178` (logs `requestId` only).
- **Verification:** PII-in-logs grep across `lib/app`; this was the only `console.*` site emitting an email. No IP/token/password logging found.

### [SEC-CI-01] Six scheduled/sync workflows omit least-privilege `permissions:`
- **Severity:** Low
- **Category:** Security (CI)
- **Location:** `.github/workflows/architecture-followups.yml`, `architecture-review-worker.yml`, `calendly-booking-sync.yml`, `zoho-sync-leads.yml`, `zoho-sync-estimate-companions.yml`, `zoho-sync-service-requests.yml`
- **Evidence:** None of these declare a top-level `permissions:` block (verified by reading all 12 workflows). They only `curl` an endpoint or run a `.mjs` sync script — no token write needed. By contrast `ci.yml`, `uptime-checks.yml`, `production-*.yml`, `browser-customer-journey-upkeep.yml` correctly pin `permissions: contents: read`.
- **Impact:** Low. The inherited default `GITHUB_TOKEN` may carry broader (read-write `contents`) scope than required; if any step were ever compromised, the blast radius is larger than necessary. No current injection vector.
- **Recommendation (NOT APPLIED):** Add `permissions: {}` (or `contents: read`) to each of the six workflows.
- **References:** `automerge-labeled-prs.yml` shows the correct scoped pattern (`contents: write` + `pull-requests: write`, justified by `gh pr merge`).
- **Verification:** Read all 12 workflow files; confirmed presence/absence of `permissions:` per file.

### [TEST-02] E2E suite is non-hermetic (live DB + browser) — must be run only against provisioned infra
- **Severity:** Info
- **Category:** Testing
- **Location:** `tests/e2e/global.setup.ts:29-59,91` (real `db.user.upsert`, `db.$queryRaw`, Chromium sign-in)
- **Evidence:** Global setup upserts users into a real DB and launches Chromium to authenticate against a running app; gated by `localAuthBootstrapEnabled`.
- **Impact:** Informational/by-design. E2E cannot run in a hermetic CI-unit context and was NOT executed in this audit. Mutation is readonly-safe by default (`E2E_MUTATION_MODE ?? "readonly"`, `tests/e2e/helpers.ts:6`), so accidental data mutation is prevented.
- **Recommendation:** None; keep mutation default `readonly` and document the live-DB prerequisite (already implied by `JOURNEY_*`/local bootstrap env).
- **Verification:** Read `global.setup.ts` and `helpers.ts`; confirmed default readonly.

### [TEST-01] No automated test/boot-gate asserts env completeness (tied to TYPE-04)
- **Severity:** Low
- **Category:** Testing
- **Location:** absence of a test for `lib/env.ts`; no boot-time validation invocation
- **Evidence:** `lib/env.ts` (the env schema) has no test and no caller, so neither tests nor runtime exercise the schema. `runtime-readiness.test.ts` covers the advisory dashboard subset only.
- **Impact:** Low. Missing required secrets are not caught by the test suite or at boot — only by the advisory `/admin/readiness` page or a downstream runtime failure.
- **Recommendation (NOT APPLIED):** Once a complete env schema exists (TYPE-04), add a unit test asserting it parses a representative full env and rejects a missing required secret; invoke it at boot.
- **Verification:** No `env.test.ts` present; `getEnv` has no callers.

### [A11Y-01] axe coverage limited to curated routes at desktop viewport only
- **Severity:** Info
- **Category:** Testing (a11y)
- **Location:** `tests/e2e/accessibility.spec.ts:13-66`
- **Evidence:** Axe runs on required marketing routes + `/software` + `/login`, `desktop-chromium` only (`test.skip` otherwise, :29). Authenticated account/admin surfaces and the 390×844 mobile viewport are not axe-scanned. Threshold is serious/critical only.
- **Impact:** Informational. Good "light" coverage; gated/admin and mobile a11y regressions could slip through.
- **Recommendation:** Optionally extend axe to an authenticated page and a mobile project if a deeper a11y pass is desired.
- **Verification:** Read the spec; `@axe-core/playwright ^4.11.0` confirmed in `package.json:60`.

---

## Severity counts

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 1 | TYPE-04 |
| Medium | 1 | PRIV-02 |
| Low | 4 | TYPE-01, PRIV-01, SEC-CI-01, TEST-01 |
| Info | 4 | TYPE-02, TYPE-03, TEST-02, A11Y-01 |
| **Total** | **10** | |

---

## Explicit answers

1. **Is env validation complete?** **No.** A zod env schema exists (`lib/env.ts`) but is **dead code** (zero callers) and covers only ~22 of 99 declared vars. All env access is raw `process.env`; no boot-time fail-fast. (TYPE-04)
2. **Are tests hermetic?** **Unit tests: yes** — db, nodemailer, and `fetchWithTimeout` are mocked everywhere; no test makes a real DB/SMTP/HTTP call (vitest has no `setupFiles`, but each test self-mocks). **E2E: no, by design** — requires a live DB + running app; readonly-safe by default (`E2E_MUTATION_MODE` defaults `readonly`). (TEST-02)
3. **Is `ARCHIVE_ENCRYPTION_SECRET` real AEAD encryption?** **Yes** — AES-256-GCM with a fresh random 12-byte IV per payload and an authentication tag (`lib/privacy-leads.ts:289-297`); not plaintext, not legacy `createCipher`. **Caveat:** the key silently falls back to `NEXTAUTH_SECRET` and then a hardcoded literal if unset, with no production guard (PRIV-02).
4. **Any CI workflow vulnerable to injection?** **No.** No `pull_request_target`, no untrusted-input interpolation into `run:` blocks, no secret echoing, no untrusted PR code run with secrets. Only finding is missing least-privilege `permissions:` on 6 sync workflows (SEC-CI-01).

---

## Unverifiable read-only / manual follow-ups

- **Actual `GITHUB_TOKEN` default scope** for the 6 unscoped workflows depends on repo/org Actions settings (read-only vs read-write default), which is not in-repo. *Check:* GitHub repo → Settings → Actions → "Workflow permissions."
- **Whether `ARCHIVE_ENCRYPTION_SECRET` / `NEXTAUTH_SECRET` are actually set in production** (determines if the PRIV-02 literal-key path is live). *Check:* Vercel project env vars (not readable from source).
- **`parseCspReportBody` / `parseCalendlyWebhookPayload` strictness** was noted as custom (not zod) but their full bodies were not line-audited here. *Check:* read those two parser implementations for over-permissive `any`-shaped acceptance.
- **Test-suite green/coverage %** was not measured (suite not run per scope). *Check (hermetic, safe):* `npx vitest run` locally — unit tests are hermetic and require no live infra; do NOT run `tests/e2e/` without a provisioned DB + app.
