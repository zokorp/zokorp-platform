# ZoKorp Platform — Forensic Audit Index

**Repo:** `zokorp-platform` (`github.com/zokorp/zokorp-platform`)
**Commit audited:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345` (main, 2026-05-22)
**Audit date:** 2026-06-29 · **Mode:** read-only · **Scope:** full line-by-line (Architecture Reviewer + Validator engine + whole repo)
**Citation verification:** live GET (48/48 unique URLs fetched)

## Severity tally (consolidated unique)

| Critical | High | Medium | Low | Info | Total |
|:---:|:---:|:---:|:---:|:---:|:---:|
| **0** | **6** | **20** | **32** | **19** | **77** |

*(From 83 raw findings across 9 workstreams; 6 cross-agent duplicates merged.)*

## One-paragraph verdict

No Critical or High **security** vulnerability was found, and the controls that are hardest to get
right — auth, RLS, the Stripe webhook, CSRF, upload validation, SVG sanitization, data minimization,
and AES-256-GCM archive encryption — all hold under line-by-line review; `tsc`/`eslint` are clean and
all 48 documentation citations are live and accurate. The genuine risk is **correctness and reliability
in the free reviewer's money/email path**: the customer quote is uncapped and computed by two
unreconciled engines without a low-confidence guardrail, the worker can double-send the report email,
and config hygiene is weak (dead env validator, secret fallbacks, a nodemailer dependency pinned to a
vulnerable line). None of these block launch on security grounds, but the quote/email correctness items
(Tier 0 in the backlog) should be fixed before broad or paid promotion. Corporate-domain gating — which
the brief assumed was missing — actually exists as a denylist; its weakness is incompleteness, not
absence.

## Reports

| File | Contents |
|---|---|
| [00-executive-summary.md](00-executive-summary.md) | Verdict, the 6 Highs, risk posture, launch view |
| [01-findings.md](01-findings.md) | Consolidated master catalog (all 77, by severity) + positive controls |
| [02-architecture-review-deep-dive.md](02-architecture-review-deep-dive.md) | End-to-end data-flow trace + flagged-file analysis (ARCH-*) |
| [02b-validator-deep-dive.md](02b-validator-deep-dive.md) | Full validator engine + SSRF fetch (VAL-*) |
| [02d-scoring-and-quote-correctness.md](02d-scoring-and-quote-correctness.md) | Exact quote math, guardrails, override isolation (ARCH-Q*) |
| [02e-whole-repo-sweep.md](02e-whole-repo-sweep.md) | Admin/authz, proxy, cron/webhooks, Zoho, Prisma/RLS (SWP-*) |
| [03-citation-integrity.md](03-citation-integrity.md) | 48-URL live-verification inventory + results (CITE-*) |
| [04-security.md](04-security.md) | SSRF, auth/session, secrets, upload, Stripe/CSP (SEC-*) |
| [05-reliability-cost-abuse.md](05-reliability-cost-abuse.md) | Worker idempotency, rate limit, email deliverability (REL-*/COST-*) |
| [06-dependencies-supply-chain.md](06-dependencies-supply-chain.md) | npm audit interpreted, outdated, licenses (DEP-*) |
| [07-testing-types-env.md](07-testing-types-env.md) | tsc/eslint, env validation, testing, CI, privacy, a11y (TYPE-/TEST-/PRIV-/A11Y-/SEC-CI-) |
| [08-remediation-backlog.md](08-remediation-backlog.md) | Prioritized backlog, S/M/L effort, sequencing |
| [09-manual-verification-needed.md](09-manual-verification-needed.md) | What I couldn't verify read-only, with exact checks |
| [10-corporate-domain-gating-spec.md](10-corporate-domain-gating-spec.md) | Gating: what exists, gaps, hardening spec (GATE-*) |

## The 6 High findings at a glance

1. **ARCH-Q01** — customer quote has no upper bound (contradicts $650–$2,800 band) · `estimate-snapshot.ts:200`
2. **ARCH-01** — diagram generator emits SVG its own validator rejects · `diagram-generator.ts:1178-1195`
3. **ARCH-02** — rate limits consumed before payload validation · `submit…route.ts:302-373`
4. **REL-01** — worker double-emails on partial failure · `jobs.ts:1003-1308`
5. **DEP-02** — nodemailer pinned to vulnerable 8.x by `overrides` · `package.json:79-81`
6. **TYPE-04** — zod env validator is dead code; no boot fail-fast · `lib/env.ts:1-46`

## Method & constraints
Static, read-only. No edits to existing files, no git writes, no email/Stripe/Zoho/WorkDrive/DB calls,
no dev server, no `next build`. Nine parallel deep-read agents wrote the per-area reports; cross-agent
duplicates were merged in `01`. The six High findings and the central submit route were re-opened and
re-confirmed against source by the orchestrator. Network was limited to GET-only fetches of public
vendor docs for citation verification. No secret values are reproduced anywhere in this audit.
