# 11 — Handoff: Changes Manifest, Verification Checklist & Cowork Prompt

**Purpose:** package for the upstream chat to (a) verify everything this audit produced and claims,
(b) research upgrades, and (c) run a Cowork session that implements + validates the fixes.

**Audit commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345` (main) · **Audit date:** 2026-06-29

---

## 0. Read this first — what actually changed

**No product or application code was changed. This was a strictly read-only audit.**
- `git diff` / `git diff --cached` = **empty**. `HEAD` is still `235bfca`. Zero edits to any tracked file.
- The proposed fixes in the reports are **unapplied diffs / prose only** — nothing was applied.
- The *only* filesystem additions are the audit documents below (untracked) + one plan file.

So "verify all changes" = **verify the new documents exist** (trivial) **and independently verify the
77 findings they assert** (the real work — §2). "Validate all changes" = validate the *fixes once
implemented* (the Cowork prompt in §4 does both: verify findings, then implement + validate fixes).

---

## 1. Files created this session (the complete manifest)

15 report files under `audit/2026-06-29/` (all untracked, additive):

| File | Bytes | What it is |
|---|---|---|
| `INDEX.md` | 4,604 | Index + severity tally + verdict |
| `00-executive-summary.md` | 5,993 | Verdict, the 6 Highs, risk posture |
| `01-findings.md` | 15,787 | Consolidated master catalog (all 77) |
| `02-architecture-review-deep-dive.md` | 26,501 | Reviewer data-flow + flagged-file analysis |
| `02b-validator-deep-dive.md` | 29,536 | Validator engine + SSRF fetch |
| `02d-scoring-and-quote-correctness.md` | 28,015 | Exact quote math + guardrails |
| `02e-whole-repo-sweep.md` | 16,185 | Admin/proxy/cron/Zoho/Prisma RLS |
| `03-citation-integrity.md` | 33,481 | 48-URL live-verification inventory |
| `04-security.md` | 33,802 | SSRF/auth/secrets/upload/Stripe |
| `05-reliability-cost-abuse.md` | 26,796 | Worker idempotency/rate-limit/email |
| `06-dependencies-supply-chain.md` | 31,050 | npm audit interpreted/outdated/licenses |
| `07-testing-types-env.md` | 27,176 | tsc/eslint/env/CI/privacy/a11y |
| `08-remediation-backlog.md` | 5,987 | Prioritized fix backlog (S/M/L) |
| `09-manual-verification-needed.md` | 5,020 | What couldn't be checked read-only |
| `10-corporate-domain-gating-spec.md` | 9,656 | Gating gap + hardening spec |
| `11-handoff-and-cowork-prompt.md` | (this) | This handoff |

Also created (outside the repo, not a code change):
`~/.claude/plans/claude-code-plan-mode-prompt-breezy-hollerith.md` (the approved audit plan).

**Tally asserted:** 0 Critical · 6 High · 20 Medium · 32 Low · 19 Info (77 unique, from 83 raw).

---

## 2. Verification checklist — the 6 Highs + top Mediums (verify each at file:line)

Re-open each location at commit `235bfca` and confirm/refute. (✓ = orchestrator already re-confirmed in code.)

### Highs
- [ ] **ARCH-Q01** uncapped quote ✓ — `lib/architecture-review/estimate-snapshot.ts:156,194-200` (`totalUsd` is an unclamped sum; only `score<60` zeroes it). Rendered at `email.ts:487,602`.
- [ ] **ARCH-Q02/Q03** dual quote engines + no confidence gate — `quote.ts:647-761` vs `estimate-snapshot.ts:133-256`; low-confidence only swaps an assumption string at `estimate-snapshot.ts:210-211`.
- [ ] **ARCH-01** diagram emits SVG its own validator rejects — `diagram-generator.ts:1178-1195,1416-1418` + `svg-safety.ts:22-41` (two existing tests already assert this — find them).
- [ ] **ARCH-02** rate limits before validation ✓ — `app/api/submit-architecture-review/route.ts:302-322,343-347,362` all precede `parsePayloadFromRequest` at `:373`.
- [ ] **REL-01** worker double-email on partial failure — `jobs.ts:1003-1308,922-932`; no `@@unique` on outbox `jobId` (`prisma/schema.prisma:591-593`); `failJob` re-queues `:390-394,463`.
- [ ] **DEP-02** nodemailer pinned to vulnerable 8.x — `package.json:79-81` (`overrides`); reachable `lib/auth-email.ts:62`, `sender.ts:183`. Fixed line is 9.0.1.
- [ ] **TYPE-04** env validator is dead code — `lib/env.ts:1-46` (`getEnv` has zero callers; grep `process.env.` to see raw reads).

### Top Mediums
- [ ] **SEC-02** `ARCH_REVIEW_FOLLOWUP_SECRET`→`ZOHO_SYNC_SECRET` fallback — `app/api/architecture-review/followups/route.ts:43-46`.
- [ ] **SEC-01 / PRIV-02 / SEC-08** secret fallbacks — `lib/auth-secret.ts:1-13`; `lib/privacy-leads.ts:54-64`; `jobs.ts:183`, `cta-links.ts:6`.
- [ ] **SEC-03 (≡VAL-01)** reference fetch follows redirects, no post-DNS block — `lib/validator-reference-material.ts:90-163`.
- [ ] **SEC-04** PDF 8-page cap client-only — `lib/architecture-review/client.ts:28-30` vs submit route `:206-208`.
- [ ] **SEC-06** CSP `script-src 'unsafe-inline'` — `lib/csp.ts:22-25,36`.
- [ ] **COST-01 (≡VAL-11)** XFF-spoofable rate-limit key — `lib/rate-limit.ts:57-68`; submit `:344`; validator route `:40-44`.
- [ ] **VAL-03** CSV/formula injection — `lib/validator-control-review.ts:536-583`.
- [ ] **SWP-01** Zoho consent-filter bypass fallback — `lib/zoho-sync-leads.ts:176-209` (DB-condition-gated; see `09` #2).
- [ ] **CITE-09** no scheduled link checker — confirm absence in `.github/workflows/`.
- [ ] **GATE-01** denylist incomplete — `lib/security.ts:7-101,136-143` (gating *exists*; verify it's a denylist, not an allowlist).

The remaining 20 Low + 19 Info are itemized with locations in `01-findings.md`.

**Cross-checks the upstream chat should run to grade this audit's honesty:**
- Re-run the two static gates: `npm run lint` and `npm run typecheck` (audit claims both clean).
- Re-fetch a sample of the 48 citation URLs (audit claims 0 broken/false) — spot-check 5–10.
- Confirm the positive controls in `01-findings.md` ("Positive controls verified") — especially: results
  emailed only to the verified account (`free-tool-access.ts:56-62`), RLS on every table, Stripe webhook
  raw-body + unique `stripeEventId`, scrypt N=2¹⁵.

---

## 3. Upgrade research targets (for the "research potential upgrades" task)

Confirm current latest + advisory status, then bump forward (never `npm audit fix --force` — it downgrades Sentry):

| Package | Current | Why / target |
|---|---|---|
| `nodemailer` | 8.0.5 (pinned via `overrides`) | **4 open advisories**; move to **9.0.1**, drop/relax the override. Verify next-auth peer (optional). |
| `vitest` + `@vitest/coverage-v8` | 4.0.18 | Pre-4.1 critical (dev UI). Target **4.1.9+**. |
| `@sentry/nextjs` | 10.53.1 | OpenTelemetry-core baggage DoS fanout. Target **10.62.0+**. |
| `next` | 16.2.6 | Bundled postcss XSS / drift. Target **16.2.9+**. Recheck `/_next/image` + Server Actions advisories for the running version. |
| `pdf-parse` / `pdfjs-dist` | 1.1.1 / 5.6.205 | Parse untrusted uploads. Find current safe pins; consider replacing `pdf-parse@1.1.1` (stale, unmaintained). |
| `uuid` (transitive) | <11.1.1 | Buffer-bounds; needs override feasibility check via `exceljs`/`next-auth`. |
| `tmp`, `undici@7`, `vite`, `js-yaml`, `tar`, `@babel/core`, `esbuild` | transitive | Forward-bump; fixes available. |

Also research (non-dependency upgrades):
- **CSP nonces** to drop `'unsafe-inline'` in Next 16 (App Router nonce pattern).
- **Durable idempotency store** options (the in-memory cache won't survive serverless) — DB-backed replay table.
- **Disposable-domain list automation** (e.g. a maintained upstream dataset vendored at build time) for GATE-01.
- **Server-side PDF page counting** without full parse (cheap header scan) for SEC-04.
- **DMARC** path to `p=quarantine`/`reject` with SPF/DKIM alignment for the ZeptoMail/Resend sender.

---

## 4. Cowork prompt — copy-paste to test & validate

> Paste the block below into a Cowork session rooted in this repo. It first **independently verifies the
> findings** (doesn't trust the audit), then **implements and validates the Tier-0/Tier-1 fixes** on a
> branch, with tests proving each fix and the full local gate green.

```
You are working in the `zokorp-platform` repo. There is a completed read-only security/correctness
audit at `audit/2026-06-29/` (start with INDEX.md, 00-executive-summary.md, 01-findings.md,
08-remediation-backlog.md, 09-manual-verification-needed.md). The audit made NO code changes — every
fix is an unapplied proposal. The repo follows CLAUDE.md: commit to main only, but for THIS work create
a branch `fix/audit-2026-06-29` and do NOT push or merge without my approval.

GROUND RULES
- Do not touch production: no live Stripe/Zoho/WorkDrive/DB writes, no prod env. Use local/dev only.
- Treat the audit as a hypothesis. For every finding you act on, FIRST re-open the cited file:line and
  confirm or refute it in a short note. If you refute one, say so and skip it — do not "fix" a non-bug.

PHASE 1 — VERIFY THE AUDIT (no code changes yet)
1. Re-confirm the 6 Highs and the top Mediums using the checklist in
   `audit/2026-06-29/11-handoff-and-cowork-prompt.md` §2. Produce a table: finding ID | confirmed?/refuted? | note.
2. Re-run the static gates and record results: `npm run lint`, `npm run typecheck`.
3. Run the hermetic unit suite: `npx vitest run` (unit tests mock db/mail/http). Record pass/fail + coverage.
4. Do the one quantitative check the read-only pass couldn't (audit 09 item #1): write a Vitest harness
   that runs the deterministic engine + `buildArchitectureEstimateSnapshot` on a realistic 60–89-score
   submission with several `remediation-estimate` rules, and print `snapshot.totalUsd`. Confirm whether
   it can exceed the documented $650–$2,800 band (this grades ARCH-Q01's real-world severity).

PHASE 2 — RESEARCH UPGRADES
5. For each package in §3 of the handoff, look up the current latest + open advisories, and decide a
   target version. Produce an upgrade plan. Do not install yet.

PHASE 3 — IMPLEMENT FIXES (Tier 0 first, then Tier 1; one logical commit per fix on the branch)
Use `audit/2026-06-29/08-remediation-backlog.md` as the work order. At minimum:
   - ARCH-Q01/Q03: clamp the rendered estimate to the documented band ceiling AND force consultation-first
     when `analysisConfidence==="low"` (`lib/architecture-review/estimate-snapshot.ts`).
   - ARCH-Q02: make the stored quote == the emailed quote (single source of truth).
   - REL-01: idempotent worker — add `@@unique` on outbox `jobId` (+ migration), a pre-send marker, and
     stop `failJob` re-running a post-send job.
   - ARCH-02: validate payload BEFORE consuming rate limits.
   - ARCH-01: make `diagram-generator` output pass `validateSvgMarkup` (+ a generate→validate round-trip test).
   - DEP-02: nodemailer → 9.0.1 (relax the `overrides`), then the other forward bumps from Phase 2.
   - TYPE-04: make `lib/env.ts` validate required vars with zod and fail fast at boot; remove the secret
     fallbacks (SEC-01/02/08, PRIV-02) by folding them into that schema.
   - SEC-04 (server PDF page cap), SEC-03 (reference-fetch redirect:'manual' + post-DNS block),
     COST-01 (don't trust raw XFF), VAL-03 (CSV cell-prefix), SEC-CI-01 (least-privilege workflow perms),
     CITE-09 (scheduled link checker workflow).
For EACH fix add or update a test that fails before and passes after.

PHASE 4 — VALIDATE EVERYTHING (the gate from CLAUDE.md)
6. Run all of: `npm run lint && npm run typecheck && npm test && npm run build` — all must be green.
7. For any UI-affecting change, use Playwright to load the affected pages at 1440×900 and 390×844,
   screenshot into `.claude-screenshots/`, and review.
8. Re-run the new ARCH-Q01 harness to prove the quote is now bounded.
9. Run a fresh `npm audit` and report the before/after vulnerability delta.

PHASE 5 — REPORT
Produce a summary: which findings were confirmed vs refuted; what was fixed (with the proving test for
each); the dependency before/after; the full-gate results; and anything still requiring my decision
(e.g. the gating posture in `10-corporate-domain-gating-spec.md`, DMARC policy, durable idempotency
store choice). List anything from audit/09 that still needs prod access (DNS, Vercel env) — do not
attempt those.
```

---

## 5. One-line message you can send upstream

> Read-only audit done at commit `235bfca`. **No code was changed** — only 15 report files under
> `audit/2026-06-29/` were created. Findings: **0 Critical / 6 High / 20 Medium / 32 Low / 19 Info** (77
> unique). No High/Critical *security* holes; the 6 Highs are correctness/reliability/supply-chain
> (uncapped customer quote, dual quote engines, worker double-email, self-rejecting diagram SVG,
> rate-limit-before-validation, nodemailer pinned vulnerable, dead env validator). All 48 doc citations
> live-verified clean. Corporate-domain gating DOES exist (denylist) — brief's assumption corrected.
> Verification checklist + upgrade targets + a ready Cowork validate/fix prompt are in
> `audit/2026-06-29/11-handoff-and-cowork-prompt.md`.
