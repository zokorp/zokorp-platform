# IMPL-VERIFICATION — finding-by-finding confirm/refute

Every finding acted on was re-opened at its cited `file:line` (current HEAD == the audited SHA
`235bfca`, zero drift) before any change. Verified by 3 parallel read-only agents + direct reads.

| ID | Audit claim | Verdict | Note / what was done |
|---|---|---|---|
| **ARCH-Q01** | Customer quote (`estimate-snapshot.ts` `totalUsd`) is an unclamped sum | **CONFIRMED** | Magnitude harness proved a 60–89 high-hour cluster summed to ~$17,775. Hard-clamped to the documented band ($650 floor / $2,800 ceiling), line items scaled to match. |
| **ARCH-Q02** | Two divergent quote engines; stored `quote.ts` figure never rendered | **CONFIRMED** | Formula B is the live customer number; `report.consultationQuoteUSD` now derives from the canonical Formula B snapshot (stored == emitted). Formula A `@deprecated`. |
| **ARCH-Q03** | Low-confidence reviews still emit a payable figure | **CONFIRMED** | `estimatePolicyForScore` now takes `analysisConfidence`; low → consultation-first / $0. |
| **ARCH-01** | Diagram generator emits `data:` SVG its own `validateSvgMarkup` rejects | **CONFIRMED** | Icons inlined instead of `data:` `<image href>`; generate→validate round-trip test added; the test asserting the `data:` URI was flipped. |
| **ARCH-02** | Rate limits consumed before payload validation | **CONFIRMED** | Reordered: idempotency replay → parse/validate → meter. Test: malformed submit returns 400, `consumeRateLimit` never called. |
| **ARCH-04** | Full delivery runs inline in the submit request (2nd non-idempotent trigger) | **CONFIRMED (mitigated)** | The inline + cron paths now share the idempotent outbox claim, so the dual path can't double-send. Full async decoupling deferred (UX change) — see OPEN-DECISIONS. |
| **REL-01** | Worker double-emails on partial failure (no `@@unique`, `failJob` re-runs) | **CONFIRMED** | `@@unique([jobId])` (+ dedup migration), `pending→sending` atomic claim before send, status-gated `failJob`, Resend `Idempotency-Key`. Test: post-send crash doesn't re-send. |
| **DEP-02** | `overrides` pins nodemailer to vulnerable 8.x | **CONFIRMED** | nodemailer → 9.0.3, override relaxed; SMTP API unchanged; suite green. |
| **DEP-01/03/04/06** | vitest/sentry/next/uuid outdated | **CONFIRMED** | Bumped (vitest 4.1.9, sentry 10.62.0, next 16.2.9, postcss/uuid overrides). `npm audit` 23 → 0. |
| **DEP-07** | pdf-parse 1.1.1 stale, parses untrusted uploads | **CONFIRMED** | Migrated both call sites to `unpdf` (isEvalSupported:false); pdf-parse removed. |
| **TYPE-04** | `lib/env.ts` zod schema is dead code; no boot fail-fast | **CONFIRMED** | Real schema + `validateServerEnv` called from `instrumentation.register` (throws in prod, warns in dev — verified live in dev boot log). Completeness test added. |
| **SEC-01** | `NEXTAUTH_SECRET` not hard-required | **CONFIRMED** | Boot validation now requires it. |
| **SEC-02** | `ARCH_REVIEW_FOLLOWUP_SECRET` → `ZOHO_SYNC_SECRET` fallback | **CONFIRMED** | Fallback removed; endpoint uses its own secret only. |
| **SEC-08** | `.eml`/CTA secrets → `NEXTAUTH_SECRET` | **CONFIRMED** | Fallbacks removed (CTA may still share the sibling EML secret). |
| **PRIV-02** | Archive key → `NEXTAUTH_SECRET` → hardcoded literal, no prod guard | **CONFIRMED** | Reads `ARCHIVE_ENCRYPTION_SECRET`; throws in prod if unset; non-prod dev constant only. |
| **SEC-04** | 8-page PDF cap client-side only | **CONFIRMED** | Server-side page cap (unpdf `numPages`); over-cap → 413 before extraction. |
| **SEC-05** | Server pdf-parse runs on attacker bytes when `clientPdfText` absent | **CONFIRMED** | Text extracted server-side only when client text absent; parser is hardened unpdf. |
| **SEC-03 (VAL-01)** | Reference fetcher follows redirects, no post-DNS block, not via `lib/http.ts` | **CONFIRMED** | New `ssrf-safe-fetch.ts`: host allowlist (primary) + IP deny ranges + connect-time IP pinning + manual per-hop redirect revalidation + caps. |
| **COST-01 (VAL-11)** | Rate-limit key trusts raw `X-Forwarded-For` | **CONFIRMED** | Prefer platform-trusted `x-vercel-forwarded-for`/`x-real-ip`; never the spoofable left-most XFF. |
| **VAL-03** | Edit-guide CSV export vulnerable to formula injection | **CONFIRMED** | Formula-trigger cells prefixed with `'`; CR/Tab/full-width handled; separators quoted. |
| **SEC-06** | CSP `script-src 'unsafe-inline'` | **CONFIRMED** | Per-request nonce + `strict-dynamic` via `proxy.ts` middleware; `unsafe-inline` dropped from script-src. |
| **SEC-07** | CSP/HSTS only when `NODE_ENV=production` | **CONFIRMED** | CSP per-request in all envs (middleware); HSTS + static headers always emitted. |
| **SWP-01** | Zoho lead-sync legacy fallback bypasses consent filter | **CONFIRMED (reachable)** | Reachable under schema drift. Fallback now syncs **nothing** (+audit log) instead of an unfiltered query. |
| **SEC-CI-01** | 6 sync workflows lack least-privilege `permissions:` | **CONFIRMED** | `permissions: { contents: read }` added to all 6; calendly's third-party actions SHA-pinned. |
| **CITE-09** | No scheduled link/quote checker | **CONFIRMED** | `scripts/check_citation_links.mjs` + scheduled workflow; fails on 404/redirect. |
| **CITE-01/03/07** | 14 redirect-dependent URLs | **PARTIALLY REFUTED → fixed** | Checker found **13** real redirects (not the audit's specific Azure entra-only framing). Normalized all 13 to clean-200 canonical targets (GCP host, Azure `/en-us/`, Snowflake `/en/`, Azure entra, AWS CITE-04 page). 47/47 now clean. |
| **CITE-04** | AWS fault-isolation page body unverified | **CONFIRMED (worse)** | The page now 302s to the pillar index (removed). Repointed to `use-fault-isolation-to-protect-your-workload.html` (200). |
| **GATE-01** | Disposable/consumer denylist incomplete | **CONFIRMED** | Vendored `disposable-email-domains` (~120k) + overrides file + weekly refresh-PR workflow. |
| **GATE-03** | Exact-host match, not eTLD+1 | **CONFIRMED** | Now matches registrable domain (eTLD+1) via `tldts` as well as exact host. |
| **GATE-04** | `zoho.com` denylisted while Zoho is the sender | **CONFIRMED (kept)** | Per decision: `zoho.com` stays blocked for signups; flagged for product confirmation. |
| **PRIV-01** | User email logged on account-page error | **CONFIRMED** | Email removed from the error log. |
| **ARCH-Q04** | Admin override band not validated min≤max | **CONFIRMED** | Inverted band (min>max) now rejected; test added. |
| **ARCH-Q05** | Zombie `webllm` mode in types + confidence math | **CONFIRMED** | `webllm` removed from the context type, the metadata zod enum, and the confidence math; confidence is findings-only. (The separate `llm-refine` *phase* label is left in place — harmlessly filtered out — see OPEN-DECISIONS.) |

## Cross-checks (grading the audit's honesty)
- `npm run lint` clean, `npm run typecheck` clean (matches the audit's claim of clean static gates).
- All 48/47 citation URLs verified live (the audit's "0 broken" was true at audit time; 13 have since
  started redirecting and are now normalized).
- Positive controls spot-confirmed during edits: recipient locked to verified account, RLS intact,
  Stripe webhook idempotency untouched, no committed secrets.

## Not changed (refuted / non-bugs / out of scope)
- The audit's specific "Azure `active-directory`→`entra` is the fragile redirect" framing was only
  partly right — most Azure URLs needed a `/en-us/` locale prefix, and only the managed-identity URL
  needed the entra path. Fixed the actual redirects the live checker found.
