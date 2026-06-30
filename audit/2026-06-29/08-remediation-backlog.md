# 08 — Remediation Backlog (prioritized)

**Audit commit:** `235bfca` · **Date:** 2026-06-29
Effort: **S** ≤2h · **M** ~½–2 days · **L** >2 days. Sequenced by (impact × likelihood ÷ effort).
All fixes are proposed in the per-area reports as **unapplied** diffs — nothing has been changed.

## Tier 0 — Do before broad / paid promotion (customer-facing correctness + money/email)

| # | ID(s) | Action | Effort |
|---|---|---|---|
| 1 | ARCH-Q01, ARCH-Q03 | Add an upper clamp + low-confidence guardrail to the **rendered** estimate (`estimate-snapshot.ts`). Force consultation-first when `analysisConfidence==="low"` or `totalUsd` exceeds the documented band ceiling. First run the magnitude check in `09` to confirm real-world blast radius. | M |
| 2 | ARCH-Q02 | Reconcile the two quote engines — delete or wire up `quote.ts` Formula A so the stored number == the emailed number (one source of truth). | M |
| 3 | REL-01 | Make the worker idempotent against double-email: add `@@unique` on outbox `jobId`, set a pre-send "sending" marker (or provider idempotency key), and make `failJob` not re-run a post-send job. | M |
| 4 | DEP-02 | Move nodemailer to **9.0.1** (drop/relax the `overrides` cap); re-run `npm audit`; smoke-test SMTP fallback path. | S–M |
| 5 | ARCH-02 | Move rate-limit consumption **after** payload validation (validate first, then meter), so a malformed submit doesn't burn the domain's daily slot. | S |
| 6 | ARCH-01 | Fix the diagram generator so its output passes the project's own `validateSvgMarkup` (inline/whitelist the `data:` icon hrefs or switch to allowed embedding). Add a generate→validate round-trip test. | M |

## Tier 1 — Security & abuse hardening (before scale)

| # | ID(s) | Action | Effort |
|---|---|---|---|
| 7 | TYPE-04, TEST-01 | Make `lib/env.ts` real: validate all required vars with zod and **fail fast at boot**; add a test asserting completeness. Removes a class of silent-misconfig outages. | M |
| 8 | SEC-02, SEC-08, SEC-01, PRIV-02 | Remove all secret fallbacks: `FOLLOWUP_SECRET`→`ZOHO_SYNC_SECRET`, `.eml`/CTA→`NEXTAUTH_SECRET`, archive key→literal; hard-require `NEXTAUTH_SECRET`. Fold into the boot env schema (#7). | S–M |
| 9 | SEC-04, SEC-05 | Enforce the 8-page PDF cap **server-side**; gate server `pdf-parse` so it doesn't run on attacker bytes when `clientPdfText` is present. | S |
| 10 | SEC-03 (≡VAL-01), VAL-02 | Harden the reference-material fetcher: route through `lib/http.ts`, set `redirect:"manual"` (re-validate host on each hop), add post-DNS private/link-local/metadata-range block. Low reachability today but cheap defense-in-depth. | M |
| 11 | COST-01 | Stop trusting raw `X-Forwarded-For` for rate-limit keys; use the platform's trusted client IP (or rely on the per-user daily limit as the ceiling). | S |
| 12 | SEC-06, SEC-07 | Tighten CSP: drop `script-src 'unsafe-inline'` (nonce/hash), emit CSP/HSTS in preview too (not only prod). | M |
| 13 | VAL-03 | Neutralize CSV/formula injection in the edit-guide export (prefix `=,+,-,@,tab,CR` cells with `'`). | S |
| 14 | SWP-01 | Remove/guard the Zoho lead-sync legacy fallback so it can't bypass the CRM-consent filter. | S |
| 15 | SEC-CI-01 | Add least-privilege `permissions:` blocks to the 6 scheduled/sync workflows. | S |

## Tier 2 — Reliability, citation durability, privacy

| # | ID(s) | Action | Effort |
|---|---|---|---|
| 16 | CITE-09 | Add a scheduled GitHub Actions job that GETs every `officialSourceLinks` URL (and any quote) and fails on 404/redirect/quote-drift. Prevents future link rot in the paid email. | M |
| 17 | CITE-01,03,07 | Normalize the 14 redirect-dependent URLs to their canonical final targets (esp. Azure `entra`, GCP `docs.cloud.google.com`, Snowflake `/en/`). | S |
| 18 | ARCH-04, REL-02 | Move job delivery off the synchronous request path (rely on the queue/cron worker); back idempotency replay with a durable store, not in-memory. | M |
| 19 | ARCH-05 | Include `ToolRun.reportJson` (or scrub the user paragraph) in the retention sweep. | S |
| 20 | COST-02 | Document + configure SPF/DKIM alignment for the sending domain; move DMARC toward `p=quarantine`/`reject` after monitoring. | M |
| 21 | REL-03, REL-04 | Add a wall-clock processing timeout; don't increment attempt count on interrupted (non-failed) runs. | S–M |
| 22 | DEP-01, DEP-07, DEP-03/04/05/06 | Forward-bump the dependency tree (vitest 4.1.9, sentry 10.62.0, next 16.2.9, etc.). **Never** `npm audit fix --force` (downgrades Sentry). | M |
| 23 | PRIV-01 | Stop logging the authenticated user email on the account-page error path. | S |

## Tier 3 — Product/UX + polish (non-blocking)

| # | ID(s) | Action | Effort |
|---|---|---|---|
| 24 | GATE-01/02/03, GATE-04 | Decide the gating posture (see `10-corporate-domain-gating-spec.md`): automate the disposable denylist, match on eTLD+1, soften copy or strengthen the gate; confirm `zoho.com` block intent; add a denylist regression test. | M |
| 25 | ARCH-Q04, VAL-08, VAL-10 | Validate admin override band min≤max; zod-validate code-owned catalog JSON; tighten unknown-rule fallback pricing. | S–M |
| 26 | ARCH-Q05 (webllm) | Remove the zombie `webllm`/llm-refine mode from `quote.ts`/`types.ts`/tests and close backlog HIGH-030. | S |
| 27 | ARCH-03, ARCH-06, VAL-04/05/06 | Return generic client errors; re-derive evidence server-side where feasible; fix sanitizer SSN gap + validator misreport. | M |
| 28 | TYPE-01/02/03, SWP-02/03/04, SEC-09 | zod on remaining boundaries; explicit `force-dynamic` on billing page; eTLD+1 origin trust; CLAUDE.md model-count fix. | M |

## Sequencing note
Tier 0 items #1–#6 are the launch-relevant set — they are correctness/money/email defects that affect what a paying customer receives. #4 (nodemailer) and #5 (rate-limit ordering) are quick wins that can land immediately. #1–#3 need a short design pass (one source of truth for the quote; idempotent worker) and should ship together.
