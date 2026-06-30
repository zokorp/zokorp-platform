# Reliability / Cost / Abuse audit — Architecture Reviewer + shared infra

- Audit commit: `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- Audit date: 2026-06-29
- Scope: worker behavior, rate limiting / abuse, email idempotency + deliverability, other crons.
- Method: read-only. No code executed, no network/DB/email calls. Every finding cites code read at this SHA.

---

## Worker

The Architecture Reviewer has **two independent ingestion/processing paths** that both call `processArchitectureReviewJob`:

1. **Synchronous (inline) path** — `app/api/submit-architecture-review/route.ts:401` creates a job and then immediately runs `processArchitectureReviewJob(createdJob.id)` in the request handler. The user's HTTP response carries the final status. This means OCR/rules/email all run inside the public POST request, not the background queue.
2. **Queue/worker path** — `lib/architecture-review/worker-run.ts` → `drainArchitectureReviewQueue` (`lib/architecture-review/jobs.ts:1330`) → `processArchitectureReviewJob`. Driven by:
   - `.github/workflows/architecture-review-worker.yml` (cron `*/5 * * * *`, POSTs `?limit=1` with `x-arch-review-worker-secret`) → `app/api/architecture-review/worker/route.ts`.
   - A second internal entrypoint `app/api/internal/cron/architecture-review-worker/route.ts` (GET, `CRON_SECRET`, `DEFAULT_LIMIT = 3`).

**Claim / lock.** `claimJob` (`jobs.ts:369-403`) is a real optimistic lease: a single `updateMany` flips `status` `queued|running → running`, bumps `attemptCount`, sets `lastHeartbeatAt`, gated on `status="queued" OR lastHeartbeatAt is null/older than LEASE_STALE_MS (75s)` and `nextRetryAt null/<=now`. If `count===0` it returns null. `drainArchitectureReviewQueue` pre-selects candidates with the same predicate (`jobs.ts:1336-1357`) then calls `processArchitectureReviewJob` which re-claims atomically — so two concurrent workers cannot both claim the same job. Good.

**Timeouts.** No wall-clock timeout wraps `processArchitectureReviewJob`. The only timeouts are on outbound HTTP: email providers 12s (`sender.ts:71,133`), SMTP handshake/socket configurable (`sender.ts:194-196`). The lease staleness window is 75s (`jobs.ts:152`), but the GitHub-Actions worker uses `--fail` curl with no `--max-time`; a long inline run could exceed Vercel's function limit and be killed mid-flight, leaving the job `running` until the 75s lease lapses and it is re-claimed.

**Retry / max-attempts.** `MAX_ATTEMPTS = 3` (`jobs.ts:153`). `failJob` (`jobs.ts:456-471`) re-queues (`status="queued"`, `nextRetryAt = now+60s`) while `attemptCount < 3`, else terminal `failed`. Fixed 60s backoff (no jitter/exponential). Note `claimJob` increments `attemptCount` on every claim, so an interrupted run that never reaches `failJob` still burns an attempt.

**Partial failure / idempotency — the central reliability problem.** `processArchitectureReviewJob` is **not idempotent across retries**, and `failJob` re-queues. The whole pipeline (lead creation, WorkDrive archive, Zoho estimate, outbox creation, email send, audit logs, tool-run record) runs sequentially with no per-step "already done" guard and no surrounding DB transaction. Critically, the **email send at `jobs.ts:1003` is followed by ~7 more awaited DB writes** (`jobs.ts:1011-1147`). If the email succeeds but any subsequent write throws (e.g. `leadLog.update`, `architectureReviewJob.update`, `recordLeadEvent`, schema drift on a non-`leadLog` table), control falls to the `catch` at `jobs.ts:1305` → `failJob` → job returns to `queued` → next worker pass re-runs the entire function → **creates a second `ArchitectureReviewEmailOutbox` row and sends the report email again.** There is no sent-marker check at function entry and no unique constraint on the outbox (see Email section). This is the double-email vector. See REL-01.

**Error leakage to clients.** Clean. The worker route returns only generic strings (`"Architecture review worker run failed."`, `worker-run.ts:44`; route maps to 500/503 with no detail, `worker/route.ts:53-55`). `safeSecretEqual` uses `timingSafeEqual` (`internal-route.ts:39-48`). The public submit route maps known errors to fixed messages and logs the real error server-side only (`submit-architecture-review/route.ts:479`). No stack traces, env, or secrets are returned to callers. One minor exception: provider error **bodies** are persisted to the outbox/`fallbackReason`/audit logs (`sender.ts:74,136`, truncated to 400 chars via `readResponseBodySnippet`) — internal-only, not client-facing (Info, see REL-05).

---

## Rate-limit / Abuse

**Is `ARCH_REVIEW_DAILY_LIMIT` enforced? YES.** Default `24` (`submit-architecture-review/route.ts:26`, `.env.example:96`). Enforced at `submit-architecture-review/route.ts:362` via `exceedsDailyLimit(user.id)` (`:256-283`), which counts `architectureReviewJob` rows + privacy `toolRun` rows for that `userId` in the trailing 24h and rejects with 429 when `>= max(1, ARCH_REVIEW_DAILY_LIMIT)`. The privacy path duplicates the same check (`architecture-review/privacy-telemetry/route.ts:155,60`). It is a **per-user** DB count (not per-IP, not spoofable via headers) — this is the strongest of the limiters.

**Layered limiters on the submit route (in order):**
1. **Per-domain:** `arch-review-domain:{emailDomain}`, limit **1** per 24h (`:303-307`). Strong anti-abuse control — one free review per business domain per day.
2. **Idempotency replay:** in-memory only (see below).
3. **Per-(user+IP) hourly:** `arch-review:{user.id}:{getRequestFingerprint}`, limit **8** / 1h (`:343-347`, `ARCH_REVIEW_RATE_LIMIT = 8`).
4. **Per-user daily:** the `ARCH_REVIEW_DAILY_LIMIT` check above.

**Rate-limit key derivation / spoofability.** `getRequestFingerprint` (`lib/rate-limit.ts:57-68`) returns the **first token of `x-forwarded-for`**, else `x-real-ip`, else `ua:<user-agent>`. The arch-review hourly key is `arch-review:{user.id}:{fingerprint}` — it **mixes authenticated user id with a client-controlled IP/UA**. Because the IP segment is attacker-controlled (any HTTP client can set `X-Forwarded-For`), an authenticated user can rotate the fingerprint to get a **fresh 8/hour bucket per spoofed value**, defeating limiter (3). On Vercel the platform overwrites `x-forwarded-for` with the real edge value, which mitigates this in production — but the code itself trusts the header (no trusted-proxy parsing), so the protection is environment-dependent, not enforced in code. The **per-user daily limit and per-domain limit are NOT IP-keyed**, so the absolute abuse ceiling stays at 24 jobs/user/day and 1/domain/day regardless of IP spoofing. Severity is therefore bounded — see COST-01.

**`RateLimitBucket` model.** Migration `0009_rate_limit_bucket` — PK `key`, `count`, `resetAt`, index on `resetAt`. `consumeRateLimit` (`rate-limit.ts:104-199`) uses a `Serializable` transaction with P2002/P2034 retry (3x), plus opportunistic cleanup of expired buckets. Correct and concurrency-safe at the DB layer. Note `consumeRateLimit` falls back to a **per-instance in-memory Map** when `!DATABASE_URL` or `NODE_ENV==="test"` (`:105-107`); in a multi-instance serverless deployment that fallback would be ineffective, but with `DATABASE_URL` set in production this path is not taken.

**Idempotency cache is in-memory, non-durable.** `lib/idempotency-cache.ts` is a process-global `Map` with 20-min TTL (`:11,62`). On serverless this does not dedupe across instances or cold starts, so the `x-idempotency-key` replay protection on submit is best-effort only — a retried submit landing on a different instance creates a **second job** (which then consumes daily-limit budget and triggers another full processing run + email). See REL-02.

**Auth gate.** Submit requires `requireVerifiedFreeToolAccess` (verified business email, `lib/free-tool-access.ts:29-59`) and `requireSameOrigin`. So abuse requires an authenticated verified account; this caps unauthenticated abuse but not authenticated/scripted abuse within the per-user/day ceiling.

---

## Email idempotency / deliverability

**Can the same report email be sent twice on a worker retry? YES (REL-01).**
- The send happens at `jobs.ts:1003` (`sendArchitectureReviewEmail`). It is a fire-and-forget REST/SMTP call with **no idempotency key sent to the provider** and **no sent-marker checked before sending**.
- A new `ArchitectureReviewEmailOutbox` row is `create`d every invocation (`jobs.ts:922-932`), and the outbox table has **no unique constraint on `jobId`** — schema shows only `@@index([jobId])`, `@@index([leadLogId])`, `@@index([status])` (`prisma/schema.prisma:591-593`). Nothing prevents N outbox rows / N sends for one job.
- `failJob` re-queues on any post-send exception (see Worker section), so a partial failure after a successful send re-runs the whole function and re-sends. The duplicate is invisible to dedupe because there is no `WHERE status='sent'` short-circuit anywhere in `processArchitectureReviewJob`.
- A successful run does set `status='sent'` on the job at the end (`jobs.ts:1044-1062`); a clean re-claim of an already-`sent` job is prevented because `claimJob` only matches `status in ('queued','running')`. So the duplicate risk is specifically the **partial-failure-after-send** window, not normal re-drains.

**Deliverability posture (SPF/DKIM/DMARC) — from docs/config only, no DNS calls.**
- `docs/05-dns-baseline-and-cutover-plan.md` records (refreshed 2026-03-02):
  - SPF: `v=spf1 include:zohomail.com ~all` — authorizes **only Zoho** sending hosts.
  - DKIM: only `zmail._domainkey` (Zoho) is documented. **No Resend or ZeptoMail DKIM selector** is present.
  - DMARC: `v=DMARC1; p=none; ...` — **monitor-only**, no quarantine/reject enforcement.
- Email is sent **preferentially via ZeptoMail → Resend → SMTP** (`sender.ts:239-263`). `EMAIL_FROM=hello@zokorp.com` (`.env.example:59`); `RESEND_FROM_EMAIL` / `ZEPTOMAIL_FROM_EMAIL` are operator-set and intended to be on the zokorp.com domain.
- **Gap (COST-02 / deliverability):** if the from-address is `@zokorp.com` and mail is sent via Resend, the message will **fail SPF** (Resend's hosts are not in the SPF include) and will only pass DMARC alignment if a Resend DKIM selector is published — which is **not documented**. ZeptoMail similarly requires its own verified-domain DKIM (the `.env.example:65` comment notes "must be on a verified domain", but no selector is recorded in the DNS baseline). With `p=none` the immediate effect is spam-foldering / reduced inbox placement rather than hard rejection, but report emails are the product's core deliverable, so silent under-delivery is a real cost/trust issue. Alignment for the active (non-Zoho) providers is **undocumented** in `docs/05`.

**Follow-up emails** (`architecture-followups.yml`, cron `43 14 * * *`) → `app/api/architecture-review/followups/route.ts`: dedupe is per-checkpoint via `followUpStatusJson["dayN"]`, written only after a send attempt (`:159-164`), and `dueFollowUpCheckpoint` skips days already marked (`lib/architecture-review/followup.ts:37-40`). This is idempotent for normal daily runs. Minor: the status write happens **after** the send, so a crash between send and the status `update` would re-send that checkpoint on the next daily run (low frequency, low impact). The follow-up secret falls back to `ZOHO_SYNC_SECRET` when `ARCH_REVIEW_FOLLOWUP_SECRET` is unset (`:43`) — audited but a secret-scope-broadening smell (Info).

---

## Other crons (lighter depth)

All internal crons share a uniform, sound shell: `CRON_SECRET` checked with `safeSecretEqual` (timing-safe), `503` when unconfigured, `401` when mismatched, generic 500 on failure, and an `AuditLog` row per outcome via `createInternalAuditLog`. No secrets/stack traces returned.

- **retention-sweep** (`app/api/internal/cron/retention-sweep/route.ts` → `runRetentionSweep`): clean wrapper; redaction is idempotent by nature (re-redacting already-redacted rows is a no-op). Not deeply traced.
- **zoho-sync-leads** (`zoho-sync-leads/route.ts` → `runZohoLeadSync`): idempotent via flags — selects `OR: [{ syncedToZohoAt: null }, { zohoSyncNeedsUpdate: true }]`, `take: 100`, and clears `zohoSyncNeedsUpdate: false` after success / re-arms `true` on failure (`lib/zoho-sync-leads.ts:144-147,376-385`). Good dedupe model.
- **zoho-sync-service-requests**, **zoho-sync-estimate-companions**, **operational-digest**: same secret/audit shell (not individually deep-traced; flagged as consistent pattern).

---

## Findings

### [REL-01] Worker is not idempotent against double-email on partial failure after send
- **Severity:** High
- **Category:** Reliability
- **Location:** `lib/architecture-review/jobs.ts:1003` (send), `:1011-1147` (post-send writes), `:1305-1308` (catch→failJob), `:456-471` (failJob re-queues), `:922-932` (per-run outbox create); `prisma/schema.prisma:591-593` (no unique on outbox jobId)
- **Evidence:**
  ```ts
  // jobs.ts:1003
  const sendResult = await sendArchitectureReviewEmail({ to: job.userEmail, ... });
  if (sendResult.ok) {
    await db.architectureReviewEmailOutbox.update({ ... });   // :1011
    // ... ~7 more awaited writes (leadLog, job, recordLeadEvent, audit, toolRun) ...
  }
  // jobs.ts:1305
  } catch (error) {
    return failJob(job, message);   // re-queues if attemptCount < 3
  }
  // jobs.ts:461
  status: retriable ? "queued" : "failed",
  ```
  No `WHERE status='sent'` guard at function entry; outbox has only `@@index([jobId])`, no `@@unique`.
- **Impact:** If the email send succeeds but any of the ~7 subsequent DB writes throws (transient DB error, schema drift on a non-leadLog table, Prisma timeout), the job is re-queued and the **entire pipeline re-runs**, creating a second outbox row and **re-sending the full report email** to the customer. Also produces duplicate leads / duplicate Zoho estimates / duplicate audit rows. At low volume the blast radius is small, but it is exploitable by any transient infra hiccup and degrades trust on the product's core deliverable.
- **Recommendation (NOT APPLIED):** (a) Add `@@unique([jobId])` (or `@@unique([jobId, attemptNumber])`) to `ArchitectureReviewEmailOutbox` and make outbox creation `upsert`/skip-if-exists; (b) at the top of `processArchitectureReviewJob`, short-circuit if the job is already `sent`/`fallback`; (c) gate the send on outbox `status` (only send when an outbox row for the job is still `pending`), and mark `sent` in the same write that records provider success before doing downstream best-effort writes; (d) wrap downstream non-critical writes (audit/toolRun/leadEvent) in try/catch so they cannot trigger a re-queue after a successful send.
- **References:** schema `prisma/schema.prisma:572-594`; `MAX_ATTEMPTS=3` at `jobs.ts:153`.
- **Verification:** Read jobs.ts:1003-1308 and schema 572-594; confirmed no entry guard and no unique constraint. To fully confirm a live duplicate one would need to inject a throw after `jobs.ts:1003` and observe a second send — not run (read-only).

### [REL-02] Submit idempotency + replay cache is in-memory only (non-durable on serverless)
- **Severity:** Medium
- **Category:** Reliability
- **Location:** `lib/idempotency-cache.ts:11,42-71`; consumed at `app/api/submit-architecture-review/route.ts:329-341,413-414`
- **Evidence:**
  ```ts
  // idempotency-cache.ts:11
  const idempotencyCache = global.__zokorpIdempotencyCache ?? new Map<string, IdempotencyEntry>();
  // ttlMs = 20 * 60 * 1000 (:62)
  ```
- **Impact:** On Vercel (multiple instances, cold starts), an `x-idempotency-key` replay can miss the cache and create a **second job**, which then runs the full processing pipeline (OCR cost already on client, but server-side rules + Zoho + email) and sends a second email — consuming daily-limit budget and duplicating outreach. The DB-backed rate limiters bound the worst case, but the idempotency guarantee advertised by the `x-idempotency-key` header is effectively absent in production.
- **Recommendation (NOT APPLIED):** Back idempotency with a durable store (a `RequestIdempotency` table keyed on `userId+key` with a uniqueness constraint, or reuse `RateLimitBucket`-style DB rows), or derive job dedupe from a content hash + short window persisted in Postgres.
- **References:** REL-01 (the second job then carries the same double-send exposure).
- **Verification:** Read idempotency-cache.ts fully and the submit route usage; the Map is process-global with no DB persistence.

### [REL-03] No wall-clock timeout around job processing; lease relies on 75s staleness only
- **Severity:** Low
- **Category:** Reliability
- **Location:** `lib/architecture-review/jobs.ts:152` (`LEASE_STALE_MS = 75_000`), `:599-1308` (no timeout wrapper); `.github/workflows/architecture-review-worker.yml` (curl has no `--max-time`)
- **Evidence:** `processArchitectureReviewJob` runs all phases sequentially with only per-HTTP-call timeouts (`sender.ts:71,133,194-196`). The synchronous submit path runs the same function inside the public request (`submit-architecture-review/route.ts:401`).
- **Impact:** A slow OCR/rules/Zoho/WorkDrive step can exceed the serverless function limit and be killed mid-run, leaving the job `running` until the 75s lease lapses, then re-claimed — combining with REL-01 to raise duplicate-processing odds. The inline submit path can also hang the user's request.
- **Recommendation (NOT APPLIED):** Add an overall `Promise.race` timeout (< function limit) that calls `failJob` cleanly; add `--max-time` to the worker curl; consider always routing processing through the queue rather than inline in the request.
- **References:** REL-01.
- **Verification:** Read full function and workflow; no timeout construct present.

### [COST-01] Hourly rate-limit key trusts client-controlled `X-Forwarded-For` (spoofable bucket)
- **Severity:** Medium
- **Category:** Cost/Abuse
- **Location:** `lib/rate-limit.ts:57-68` (`getRequestFingerprint`); key built at `app/api/submit-architecture-review/route.ts:344`
- **Evidence:**
  ```ts
  // rate-limit.ts:58-67
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const realIp = request.headers.get("x-real-ip") ?? "";
  const candidate = forwardedFor.split(",")[0]?.trim() || realIp.trim();
  if (candidate) return candidate;          // attacker-controlled
  return `ua:${ua.slice(0, 120)}`;
  // submit route:344
  key: `arch-review:${user.id}:${getRequestFingerprint(request)}`,
  ```
- **Impact:** An authenticated user can rotate `X-Forwarded-For` to get a fresh 8/hour bucket per value, neutralizing the hourly limiter (limit 8 at `submit-architecture-review/route.ts:25,345`). Each extra accepted submission triggers a full server-side processing run + report email. **Bounded** by the IP-independent per-user daily limit (`ARCH_REVIEW_DAILY_LIMIT=24`) and per-domain limit (1/24h), so the absolute ceiling holds; on Vercel the edge also overwrites the header, mitigating in prod. Severity is Medium because the protection is environment-dependent rather than enforced in code, and the same spoofable fingerprint is reused by validator/mlops/auth/CSP limiters.
- **Recommendation (NOT APPLIED):** Parse `X-Forwarded-For` against a trusted-proxy hop count (or use the platform-provided client IP), and for authenticated routes prefer keying on `user.id` alone (the IP segment adds no security when the user id already scopes it and the IP is forgeable).
- **References:** same fingerprint used at `zokorp-validator/route.ts:41`, `mlops-forecast/route.ts:47`, `auth/*`, `security/csp-report/route.ts:34`.
- **Verification:** Read `getRequestFingerprint` and all consumer call sites; confirmed first-token-of-header with no trusted-proxy validation. Daily/domain limiters confirmed IP-independent at `submit-architecture-review/route.ts:256-283,303-307`.

### [COST-02] Sending providers (ZeptoMail/Resend) lack documented SPF/DKIM alignment; DMARC is p=none
- **Severity:** Medium
- **Category:** Cost/Abuse (deliverability)
- **Location:** `docs/05-dns-baseline-and-cutover-plan.md` (SPF/DKIM/DMARC records); `lib/architecture-review/sender.ts:239-263` (provider order ZeptoMail→Resend→SMTP); `.env.example:59,67-74`
- **Evidence (docs only, no DNS calls):**
  ```
  @ — TXT (SPF) — v=spf1 include:zohomail.com ~all
  zmail._domainkey — TXT (DKIM) — v=DKIM1; k=rsa; p=...     (Zoho only)
  _dmarc — TXT (DMARC) — v=DMARC1; p=none; ...              (monitor-only)
  ```
  Sender prefers ZeptoMail/Resend; `EMAIL_FROM=hello@zokorp.com` (`.env.example:59`).
- **Impact:** Report and follow-up emails sent via Resend (and ZeptoMail unless its verified-domain DKIM is published) from an `@zokorp.com` from-address will **fail SPF** and lack a documented DKIM selector, so they pass DMARC only by luck. With `p=none` the result is degraded inbox placement / spam-foldering rather than rejection — but these emails are the paid/free tool's primary deliverable, so silent under-delivery is a direct product-value and trust cost. Alignment for the active non-Zoho providers is undocumented.
- **Recommendation (NOT APPLIED):** Document and publish provider DKIM selectors (Resend `resend._domainkey`-style, ZeptoMail's `zmail`/custom selector per their verified-domain setup); add the chosen provider to SPF if it uses envelope-from on the domain; once aligned, move DMARC toward `p=quarantine`. Update `docs/05` to record alignment for whichever provider is live.
- **References:** `.env.example:62-69` notes ZeptoMail must be a verified domain; no selector recorded in DNS baseline.
- **Verification:** Read `docs/05` records and `sender.ts` provider order; did NOT perform DNS lookups (read-only constraint). Confirm by `dig TXT` for the published from-domain's SPF and the provider's DKIM selector at cutover time.

### [REL-04] failJob uses fixed 60s backoff and claim increments attempt even on interrupted runs
- **Severity:** Low
- **Category:** Reliability
- **Location:** `lib/architecture-review/jobs.ts:463` (`nextRetryAt: new Date(Date.now() + 60_000)`), `:390-394` (claim increments `attemptCount`)
- **Evidence:**
  ```ts
  // jobs.ts:463
  nextRetryAt: retriable ? new Date(Date.now() + 60_000) : null,
  // jobs.ts:390
  attemptCount: { increment: 1 },
  ```
- **Impact:** No exponential backoff/jitter means a persistently failing dependency (e.g. Zoho outage) retries every 60s up to 3 attempts, each re-running the costly pipeline (and, per REL-01, possibly re-sending). Because `claimJob` increments the attempt counter even when a run is killed before reaching `failJob`, the effective retry budget can be silently consumed by infrastructure terminations rather than logic failures.
- **Recommendation (NOT APPLIED):** Use exponential backoff with jitter; separate "claim/lease" accounting from "logical attempt" accounting so platform kills don't burn the retry budget.
- **Verification:** Read failJob and claimJob; behavior as quoted.

### [REL-05] Provider error bodies persisted to outbox / fallbackReason / audit logs (internal-only)
- **Severity:** Info
- **Category:** Reliability
- **Location:** `lib/architecture-review/sender.ts:74,136` (`readResponseBodySnippet(..., 400)`); stored at `jobs.ts:1177` (`errorMessage`), `:1205` (`fallbackReason`), `:1268` (audit `emailError`)
- **Evidence:** `error: 'RESEND_${response.status}:${errorBody}'` / `'ZEPTOMAIL_${response.status}:${errorBody}'`.
- **Impact:** Third-party error payloads (truncated to 400 chars) land in DB rows and audit logs. These are not returned to clients (the submit route maps to generic messages and serializes only `fallbackReason` via `serializeArchitectureReviewJobStatus`, `jobs.ts:1413-1419`, which the client does see for fallback). Low risk, but provider error bodies occasionally echo request fragments; worth confirming they never contain recipient PII before surfacing `fallbackReason` to the client.
- **Recommendation (NOT APPLIED):** Map provider errors to stable internal codes before persisting/serializing the client-visible `fallbackReason`.
- **Verification:** Traced `errorBody` from sender into jobs.ts persistence and into `serializeArchitectureReviewJobStatus`.

---

## Explicit answers to scope questions

1. **Is `ARCH_REVIEW_DAILY_LIMIT` enforced, and where?**
   Yes. Default `24` (`submit-architecture-review/route.ts:26`, `.env.example:96`). Enforced at `submit-architecture-review/route.ts:362` via `exceedsDailyLimit(user.id)` (`:256-283`) and mirrored in the privacy path (`architecture-review/privacy-telemetry/route.ts:155`). It is a **per-user 24h DB count** of jobs + privacy tool-runs — IP-independent and not header-spoofable.

2. **Is the worker idempotent against double-email?**
   No (REL-01). The send at `jobs.ts:1003` has no provider idempotency key and no pre-send sent-marker; ~7 awaited DB writes follow it; any post-send exception routes to `failJob`, which re-queues and re-runs the whole function, creating a **second outbox row** (no `@@unique` on outbox `jobId`) and **re-sending the report email**. Normal re-drains are safe (already-`sent` jobs aren't re-claimed); the gap is specifically partial-failure-after-send.

3. **What is the rate-limit key (user / IP / spoofable)?**
   Submit hourly limiter: `arch-review:{user.id}:{getRequestFingerprint(request)}` — **per-user + per-IP**, where the IP comes from `X-Forwarded-For`'s first token and is **client-spoofable** in code (`rate-limit.ts:57-68`, COST-01). Per-domain (`arch-review-domain:{emailDomain}`, 1/24h) and per-user daily limiters are **not** IP-keyed and bound the abuse ceiling. The `RateLimitBucket` itself is keyed on the string `key` (PK) and is concurrency-safe (Serializable tx, P2002/P2034 retry).

4. **Anything unverifiable read-only, and the exact check needed:**
   - **REL-01 live duplicate send:** would require injecting a throw after `jobs.ts:1003` and observing a second outbox row + second provider call — not executed (read-only). Static analysis is conclusive on the missing guard/constraint.
   - **COST-02 DNS alignment:** verified from `docs/05` only (refreshed 2026-03-02); current live alignment needs `dig TXT zokorp.com` (SPF), `dig TXT <provider-selector>._domainkey.zokorp.com` (Resend/ZeptoMail DKIM), and `dig TXT _dmarc.zokorp.com` — not run per the no-network constraint.
   - **COST-01 prod mitigation:** whether Vercel overwrites `X-Forwarded-For` at the edge for this deployment can only be confirmed by inspecting the live edge config/headers; in code the header is trusted.
   - **In-memory limiter/idempotency fallback (REL-02):** behavior under multi-instance serverless is inferred from the global-`Map` implementation; confirming cross-instance misses would require a deployed load test — not run.
