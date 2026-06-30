# 00 — Executive Summary

**Subject:** `zokorp-platform` — Architecture Diagram Reviewer + shared infrastructure (full-repo)
**Commit audited:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345` (main, 2026-05-22) · **Date:** 2026-06-29
**Type:** read-only forensic security & correctness audit · **Scope:** full line-by-line (reviewer, validator engine, whole repo)

## Verdict

**The platform is in solid shape security-wise — no Critical or High *security* holes, and the
hardest-to-get-right controls are correct.** Authentication (scrypt N=2¹⁵, timing-safe, enumeration-
resistant), authorization (`requireAdmin` everywhere, RLS on every public table), the Stripe webhook
(raw-body + idempotent), CSRF coverage, magic-byte upload validation, SVG sanitization, and data
minimization (raw diagram bytes genuinely removed; AES-256-GCM for the one stored blob) all hold up
under line-by-line review. `tsc` and `eslint` are clean. There is no server-side LLM, so OCR'd diagram
text has no prompt-injection sink. **All 48 unique documentation citations were live-verified: zero
broken, zero false** — nothing wrong is being emailed to customers today.

**The real risks are correctness and reliability in the money/email path of the free reviewer, not
security.** Six High findings, none security-exploitable: the customer-facing **consultation quote has
no upper bound** and can contradict the published $650–$2,800 band; there are **two divergent quote
engines** and the one shown to customers skips the low-confidence guardrail; the worker can **double-
send** the report email on a partial failure; the diagram generator emits SVG the app's **own validator
rejects**; rate limits are **metered before validation** (a typo burns a business domain's daily slot);
the dependency pin **traps nodemailer on a vulnerable 8.x line**; and the zod **env validator is dead
code** with no boot-time fail-fast.

**Tally (consolidated): 0 Critical · 6 High · 20 Medium · 32 Low · 19 Info** (77 unique, from 83 raw
findings across 9 workstreams).

## The six High findings (what to fix before broad/paid promotion)

1. **ARCH-Q01 — Uncapped customer quote.** `estimate-snapshot.ts:200` sums line items with no ceiling;
   only a `<60` score zeroes it. A 60–89 review with several high-hour rules emits a four/five-figure
   auto-quote that contradicts the documented band. *Confirmed in code.* (Magnitude check in `09`.)
2. **ARCH-Q02/Q03 (rolled into the quote fix) — Two quote engines + no confidence guardrail.** The
   stored `quote.ts` figure is not what the customer sees, and the rendered figure ignores low
   confidence (it only swaps an assumption sentence).
3. **REL-01 — Worker double-emails on partial failure.** No outbox `@@unique`, no sent-marker, and
   `failJob` re-runs the whole pipeline. Compounded by the submit route also processing the job inline.
4. **ARCH-01 — Diagram generator self-inconsistency.** Output fails the project's own
   `validateSvgMarkup` (proven by two existing tests).
5. **ARCH-02 — Rate limits before validation.** A failed/typo'd first submit consumes the whole
   business domain's single daily review slot.
6. **DEP-02 / TYPE-04 — Supply-chain pin + dead env validation.** `overrides` traps nodemailer at
   vulnerable 8.x and blocks the fixed 9.0.1; the zod env schema has zero callers (~22/99 vars) and
   never fails fast at boot.

## Highest-value Mediums

- **CITE-09** — no automated link/quote checker; 14 citations already depend on vendor redirects
  (Azure `entra` migration is the fragile one). Latent rot in the paid report.
- **SEC-02 / SEC-01 / PRIV-02** — secret fallbacks (`FOLLOWUP_SECRET`→`ZOHO_SYNC_SECRET`, archive
  key→hardcoded literal, `NEXTAUTH_SECRET` not hard-required). Cheap to remove via the boot env schema.
- **SEC-04 / SEC-06 / SEC-03** — server-side PDF page cap missing; CSP `unsafe-inline`; reference
  fetcher follows redirects with no DNS-rebind guard (low reachability — operator-curated URLs).
- **SWP-01** — Zoho consent-filter bypass via a legacy fallback (DB-condition-gated — verify in `09`).
- **GATE-01** — business-email gating *exists* (denylist) but is incomplete (see below).

## Correction to the audit's own brief

The brief assumed corporate-domain gating "likely does not exist yet." **It does** — `lib/security.ts`
denylists ~45 consumer + ~45 disposable domains and `free-tool-access.ts` enforces it server-side
alongside verification and recipient-locking. The gap is that it's a *static denylist with no MX/DNS
validation and no automated maintenance*, and the user-facing copy overstates it. Full analysis and a
hardening spec are in **`10-corporate-domain-gating-spec.md`**.

## Risk posture

| Dimension | Posture |
|---|---|
| AuthN / AuthZ / session | **Strong** |
| Data privacy / minimization / RLS / encryption | **Strong** (one consent-fallback to verify, SWP-01) |
| Payments (Stripe) | **Strong** (raw-body + idempotent) |
| SSRF / injection / XSS | **Good** (centralized, low-reachability fetch; React/escape XSS defenses) |
| Citation integrity (today) | **Clean** (0 broken/false of 48) — but unguarded against future rot |
| Customer-facing quote correctness | **Weak** (uncapped, dual-engine, no confidence gate) — top priority |
| Worker reliability / email idempotency | **Weak** (double-send window) |
| Supply chain | **Mostly clean** (nodemailer pin is the one real issue) |
| Config / env hygiene | **Weak** (dead env validator, secret fallbacks) |

## Bottom line
No launch-blocking *security* defect. The launch-blocking work is **making the free reviewer's quote
and email path correct and idempotent** (Tier 0 in `08-remediation-backlog.md`), plus removing the
nodemailer pin and the secret fallbacks. Most of Tier 0 is small-to-medium effort. Start with the quick
wins — nodemailer bump (DEP-02) and rate-limit ordering (ARCH-02) — then the quote single-source-of-
truth + idempotent worker as a coordinated change.
