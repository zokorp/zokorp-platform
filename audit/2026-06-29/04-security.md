# Security Audit — zokorp-platform

- **Scope:** Application security (SSRF, Auth/Authz, Secrets, File upload, Prompt-injection, Stripe webhook / CSP)
- **Commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- **Date:** 2026-06-29
- **Mode:** READ-ONLY forensic audit. No edits, no network calls, no side-effecting commands. Secret values never reproduced.
- **Auditor:** Senior application-security auditor

---

## Executive summary

The platform shows a mature, defense-in-depth security posture. Outbound fetch is constrained to fixed first-party (Zoho/Resend/ZeptoMail) endpoints built from env config — **no user-supplied URL reaches `fetch`**. The one user-influenced fetch path (`validator-reference-material.ts`) is gated by a domain allowlist, but its URLs are sourced from a server-side filesystem catalog (not request input), and the only public profile (FTR) carries no URLs. Auth uses scrypt (N=2^15) with timing-safe compare and an enumeration-resistant dummy-hash path; `requireAdmin()` is enforced on every admin page and every admin server action. The Stripe webhook verifies the raw body before parsing and is idempotent at the DB level (unique `stripeEventId` + unique `CheckoutFulfillment.stripeCheckoutSessionId`). File uploads are magic-byte validated and size-capped server-side, processed in memory. No external LLM is wired in, so OCR text has no prompt-injection sink.

The most material findings are hardening/defense-in-depth, not active exploits: a still-present `ARCH_REVIEW_FOLLOWUP_SECRET → ZOHO_SYNC_SECRET` compatibility fallback (secret-boundary blurring), a missing server-side PDF **page** cap on architecture-review uploads (the 8-page cap is client-only), an SSRF defense gap in the reference-material fetcher (allowlist checked pre-DNS, redirects followed, no post-resolution private-range block), `NEXTAUTH_SECRET` not hard-required at boot, and a CSP that permits `script-src 'unsafe-inline'`.

**Severity counts:** Critical 0 · High 0 · Medium 4 · Low 3 · Info 3

---

## Area 1 — SSRF

**Outbound-fetch inventory.** Two sinks exist:

1. `lib/http.ts` — `fetchWithTimeout()` (`lib/http.ts:13-58`). A thin wrapper around `fetch` adding only an `AbortController` timeout. **It does NOT enforce an allowlist and does NOT block private / link-local / metadata IP ranges (no post-DNS resolution check).** All callers, however, pass **fixed first-party endpoints** constructed from env config, not user input:
   - `lib/architecture-review/sender.ts:39,117` — `process.env.ZEPTOMAIL_API_URL ?? "https://api.zeptomail.com/..."`, hardcoded `https://api.resend.com/emails`.
   - `lib/zoho-crm.ts`, `lib/zoho-invoice.ts`, `lib/zoho-workdrive.ts`, `lib/zoho-sync-leads.ts` — Zoho API hosts from env/OAuth config.
   None of these incorporate request-controlled host/path values, so `fetchWithTimeout` is not a user-reachable SSRF primitive at this commit.

2. `lib/validator-reference-material.ts:97` — `fetchReferenceText(url)` calls native `fetch(url, { redirect: "follow" })`. This is the only path where a URL is data-driven. It is gated by `isAllowedReferenceUrl()` (`:143-163`) — an HTTPS/HTTP + host-suffix allowlist (`aws.amazon.com`, `docs.aws.amazon.com`, `awsstatic.com`, `awspartner.com`, `amazonaws.com`) that also rejects `localhost`/`127.0.0.1`/`::1` literals.

**User-influence trace.** `loadTargetReferenceMaterial(input.target)` is called from `lib/validator.ts:71`. `input.target` is produced by `resolveValidatorTargetContext()` (`app/api/tools/zokorp-validator/route.ts:111`) from a Zod-validated `validationTargetId` string — the client supplies an **ID**, not URLs. The URLs themselves come from a server-side catalog: static `FTR_TARGETS` (no URLs) plus `record.checklist_url` / `record.calibration_guide_url` read from on-disk JSON index files via `safeReadJson` (`lib/validator-library.ts:159-236`). These are not runtime/DB editable by users. Additionally, the public FTR profile is the only one a non-admin can run (`route.ts:80-88`), and FTR targets define **no** URLs. Net: an external attacker cannot steer the reference fetch to an arbitrary host.

**Residual SSRF weaknesses (defense-in-depth):** `fetchReferenceText` follows redirects (`redirect: "follow"`) and applies the allowlist only to the *initial* URL — an allowlisted host that 30x-redirects to an internal address would be followed, and there is no post-DNS-resolution private-range guard (DNS-rebinding class). See SEC-03. This is low-probability given the URL source, but the OWASP SSRF cheat sheet recommends blocking on the *resolved* IP and disabling/validating redirects.

**`/_next/image` SSRF.** `next.config.ts` defines **no `images` block** (no `remotePatterns` / `domains`). With no remote patterns configured, Next.js's image optimizer will not proxy arbitrary remote origins, so the `/_next/image` endpoint is not usable as an open SSRF proxy here. (Verified by absence in `next.config.ts:25-36`.)

**CVE-2024-34351 (Server Actions SSRF via Host header).** This affects self-hosted Next.js `>=13.4.0 <14.1.1` (GHSA-fr5h-rqp8-mj6g), fixed in 14.1.1. This app is **Next.js 16** and deploys on Vercel, so it is well past the fixed range and not affected. (Not the `/_next/image` SSRF — that is a separate issue class.) No finding.

---

## Area 2 — Auth / Session / Authorization

**Password hashing.** `lib/password-auth.ts` uses scrypt with `N = 2**15` (32768), `r = 8`, `p = 1`, 64-byte key, 16-byte random salt, `maxmem = 128MB` (`:4-7,22-56`). Verification uses `crypto.timingSafeEqual` after a length check (`:82-86`). Encoded format is self-describing (`scrypt$N$r$p$salt$hash`), enabling parameter upgrades. Solid.

**Account enumeration.** `authorize()` (`lib/auth.ts:48-132`) always runs `verifyPassword` against either the real hash or a constant `DUMMY_PASSWORD_HASH` (`:18-19,57,63,75,80`) on every non-success branch (unknown user, missing `userAuth`, unverified email, disabled schema), normalizing timing and preventing user enumeration via response latency.

**Lockout.** 8 failed attempts → 15-minute lock (`:16-17,91-100`), with audit logging (`:102-112`) and reset-on-success (`:117-125`).

**Session strategy.** JWT (`:36-38`). The `jwt` callback re-loads the DB user on every call, enforces `emailVerified`, and invalidates sessions when `passwordUpdatedAt` is newer than token `iat` (`:171-180`) — password change revokes existing sessions. Admin role is re-synced from the allowlist on each token refresh (`:182`).

**Authorization helpers.** `requireUser()` / `requireAdmin()` (`lib/auth.ts:228-253`) are server-side; `requireAdmin` gates on `hasVerifiedAdminAccess()` which requires both `emailVerified` AND allowlist membership (`lib/admin-access.ts:16-18`).

**Admin enforcement coverage (verified):**
- All admin pages call `requireAdmin`: `app/admin/{prices,products,leads,operations,service-requests,readiness,architecture-catalog,architecture-catalog/[ruleId],billing}/page.tsx`.
- All admin mutations are server actions in `app/admin/actions.ts`, and **every** exported action's first statement is `await requireAdmin()` (`:65,92,135,160,185,232,238,251,264,282,288,294`).
- No `app/api/admin/*` route handlers exist (admin writes go through the guarded server actions).

**Admin allowlist parsing.** `parseAdminEmails()` (`lib/security.ts:114-125`) splits on comma, trims, lowercases, and `.filter(Boolean)` drops empty entries — empty/whitespace `ZOKORP_ADMIN_EMAILS` yields an empty Set (no bypass), comparison is case-insensitive and whitespace-tolerant. Good. See SEC-09 (Info): no normalization for unicode/look-alike domains, acceptable.

**CSRF / same-origin.** `requireSameOrigin()` (`lib/request-origin.ts:129-160`) requires an `Origin` or `Referer` and matches it against trusted origins. Applied to all browser-facing state-changing routes (validator, mlops-forecast, all `auth/*`, register, submit-architecture-review, services/requests, stripe checkout/portal, arch-review checkout/privacy). Machine-to-machine routes (cron/worker/webhooks) instead use signature/secret auth. Coverage is complete.

**Findings:** SEC-01 (auth secret not hard-required), SEC-09 (Info).

---

## Area 3 — Secrets hygiene

**ARCH_REVIEW_* secrets & CRON_SECRET.** The intended design is per-purpose secrets, with documented compatibility fallbacks (`lib/runtime-readiness.ts:111-128,340-448` reports each):
- `ARCH_REVIEW_WORKER_SECRET` — worker route.
- `ARCH_REVIEW_EML_SECRET` — signed .eml; falls back to `NEXTAUTH_SECRET` (`lib/architecture-review/jobs.ts:183`).
- `ARCH_REVIEW_CTA_SECRET` — CTA link signing; falls back to `ARCH_REVIEW_EML_SECRET` → `NEXTAUTH_SECRET` (`lib/architecture-review/cta-links.ts:6`).
- `ARCH_REVIEW_FOLLOWUP_SECRET` — follow-up route; **falls back to `ZOHO_SYNC_SECRET`** (see SEC-02).
- `CRON_SECRET` — internal cron routes.

All bearer/secret comparisons go through `safeSecretEqual()` (`lib/internal-route.ts:39-48`) which uses `crypto.timingSafeEqual` (with a length-check short-circuit — standard and acceptable). Stripe uses its own `constructEvent`; Calendly uses HMAC verification.

**FOLLOWUP → ZOHO_SYNC_SECRET fallback: STILL PRESENT.** `app/api/architecture-review/followups/route.ts:43`:
```
const configuredSecret = process.env.ARCH_REVIEW_FOLLOWUP_SECRET ?? process.env.ZOHO_SYNC_SECRET ?? "";
```
This blurs two trust boundaries (anyone holding the lead-sync secret can also drive the follow-up email route). See SEC-02.

**Committed secret scan.** No live secrets committed. The only secret-shaped match is the canonical AWS *documentation example* key in a test fixture (`tests/validator-control-review.test.ts:20` — `AKIAIOSFODNN7EXAMPLE` / `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`), which is a public placeholder, not a real credential. The only git-tracked env file is `.env.example` (the contract). Local `.env.local`, `.env.audit*.local`, `.env.vercel*` exist on disk but are **untracked and gitignored** (verified via `git ls-files` and `git check-ignore`). `DUMMY_PASSWORD_HASH` in `lib/auth.ts:18-19` is an intentional constant scrypt hash for timing normalization, not a secret.

**Findings:** SEC-02 (FOLLOWUP fallback), SEC-08 (Info — EML/CTA fallbacks to `NEXTAUTH_SECRET`).

---

## Area 4 — File upload

Two upload paths, both Node runtime, both in-memory (no filesystem writes):

**Validator** (`app/api/tools/zokorp-validator/route.ts`): size cap enforced server-side **twice** — on `file.size` before buffering (`:100-106`) and on `buffer.length` after (`:140-145`), using `maxUploadBytes(UPLOAD_MAX_MB ?? 10)`. Type validation via `isAllowedFileType(name, type, buffer)` (`:130`) which, when a buffer is present, requires a **magic-byte** match (PDF `25 50 44 46 2d`, XLSX/ZIP `50 4b 03 04`) AND consistency with extension or MIME (`lib/security.ts:145-213`). Processing is in-memory (`Buffer.from(await file.arrayBuffer())`).

**Architecture review** (`app/api/submit-architecture-review/route.ts`): size cap (`ARCHITECTURE_REVIEW_UPLOAD_MAX_MB ?? 8`) enforced on `diagramRaw.size` (`:134-137`) and again on `bytes.length` after buffering (`:141-143`). Per-format **magic-byte** checks: PNG `89 50 4E 47 0D 0A 1A 0A` (`:85-92`), JPEG `FF D8 FF` (`:94-101`), PDF `25 50 44 46` (`:103-110`), and SVG via `isSafeSvgBytes` (`:237`). Extension/format-claim consistency enforced (`DIAGRAM_FORMAT_MISMATCH`). Processed as `Uint8Array` in memory.

**SVG safety** (`lib/architecture-review/svg-safety.ts:91-161`): blocks `<script>`, `javascript:`, `<foreignObject>`, external/data-URI `href`/`xlink:href`, `@import url(...)`, external `url(...)` references, and oversized dimensions — strong anti-XSS/anti-SSRF for SVG. SVGs are not rendered server-side (only label text extracted), reducing risk further.

**6MB / 8-page caps.** The **6MB** cap referenced in the prompt corresponds to `PDF_OCR_MAX_FILE_BYTES = 6 * 1024 * 1024` in `lib/architecture-review/client.ts:30` and the **8-page** cap to `PDF_OCR_MAX_PAGES = 8` (`client.ts:29`). `client.ts` is **browser-side** (uses `document.createElement`, `pdfjs-dist`, `tesseract.js` — `:73,142,202,246`). The server route's overall **byte** cap (8MB) is enforced server-side, but there is **no server-side PDF page-count cap**: the server `pdf-parse` fallback (`route.ts:206-208`) and the worker parse OCR text without re-checking page count. See SEC-04. Tests in `tests/architecture-review-file-validation.test.ts` document the intended magic-byte/size behavior.

**Findings:** SEC-04 (no server-side page cap), SEC-05 (Low — server `pdf-parse` runs on attacker bytes when client text absent).

---

## Area 5 — Prompt-injection posture

**No external LLM is wired in.** `package.json` contains no `openai` / `@anthropic-ai` / `web-llm` / `langchain` / `cohere` / `mistral` / `@ai-sdk` dependency (verified). The architecture-review pipeline is rules-based: OCR text (`metadata.clientPdfText` / `clientPngOcrText` / `clientSvgText`) flows into `evaluateArchitectureReviewInput(... ocrText ...)` (`lib/architecture-review/jobs.ts:646-681`), a deterministic engine — **not** a prompt. There is no code path that concatenates OCR text into a prompt, shell command, or model call. OCR text is therefore treated as data.

The `"webllm"` mode string is a confirmed **zombie**: it survives only as a Zod enum member (`lib/architecture-review/types.ts:211`), a quote-context union (`lib/architecture-review/quote.ts:61`), and a cost-heuristic branch (`quote.ts:148`). The `llm-refine` phase and `llmRefinement` schema are likewise vestigial — no live LLM consumes them. No prompt-injection sink exists at this commit. See SEC-10 (Info — dead surface cleanup).

---

## Area 6 — Stripe webhook & CSP

**Raw-body signature verification.** `app/api/stripe/webhook/route.ts:29` reads `await request.text()` (raw) and passes it to `constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET)` (`:34-42`) **before** any JSON parse. Missing signature or secret → 400 (`:25-27`). Correct.

**Idempotency (DB-enforced).** `recordStripeWebhookEvent` upserts on unique `stripeEventId` (`lib/stripe-webhook-events.ts:71-98`; schema `StripeWebhookEvent.stripeEventId @unique`, `prisma/schema.prisma:203`). Fulfillment runs inside `db.$transaction` and inserts a `CheckoutFulfillment` row keyed on `stripeCheckoutSessionId @unique` (`prisma/schema.prisma:188`); a duplicate raises Prisma `P2002`, caught by `isDuplicateCheckoutFulfillmentError` (`lib/stripe-webhook-handlers.ts:27-41,373-392`) and short-circuited to `"duplicate_short_circuit"` with an audit log — **no double-fulfillment / double credit grant on retries**. Entitlement and credit-balance mutations use `upsert` + ledger entries inside the same transaction (`:238-372`), matching CLAUDE.md conventions. On handler error the route returns 500 so Stripe retries (`route.ts:59-75`).

**CSP & headers.** `next.config.ts:8-23` sets HSTS (preload, 2y), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a locked-down `Permissions-Policy`, and a CSP (production only) built by `buildContentSecurityPolicy()` (`lib/csp.ts`). CSP includes `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, scoped `form-action`/`frame-src` for Stripe/YouTube, and `upgrade-insecure-requests`. **Weaknesses:** `script-src` always includes `'unsafe-inline'` (and `'unsafe-eval'` outside production), and `style-src 'unsafe-inline'` — see SEC-06. `report-uri` points to `/api/security/csp-report`, which is rate-limited and writes to `AuditLog` (`app/api/security/csp-report/route.ts`).

**Findings:** SEC-06 (CSP `unsafe-inline`), SEC-07 (Low — CSP not emitted in non-production).

---

# Findings

### [SEC-01] `NEXTAUTH_SECRET` is not hard-required at boot; can silently resolve to `undefined`
- **Severity:** Medium
- **Category:** Security (Auth/Session)
- **Location:** `lib/auth-secret.ts:1-13`; consumed at `lib/auth.ts:39`
- **Evidence:**
  ```ts
  export function getAuthSecret() {
    const nextAuthSecret = process.env.NEXTAUTH_SECRET?.trim();
    if (nextAuthSecret) return nextAuthSecret;
    const authSecret = process.env.AUTH_SECRET?.trim();
    if (authSecret) return authSecret;
    return undefined;   // <-- no throw
  }
  ```
- **Impact:** If neither `NEXTAUTH_SECRET` nor `AUTH_SECRET` is set, `authOptions.secret` is `undefined`. In production NextAuth requires a secret and will error at runtime, but the code does not fail fast or guarantee minimum entropy. A misconfigured deploy could degrade JWT signing/encryption integrity (NextAuth uses this secret to sign/encrypt session JWTs). Defense-in-depth: a weak/short secret would not be rejected.
- **Exploitability:** Difficulty High; precondition is an operator misconfiguration (missing/weak secret). Not externally triggerable on its own.
- **Recommendation (NOT APPLIED):** Throw in production when the resolved secret is absent or shorter than ~32 bytes; rely on `runtime-readiness` only as a secondary signal.
  ```ts
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET is required");
  if (secret && secret.length < 32 && process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET too short");
  return secret;
  ```
- **References:** https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/ ; https://next-auth.js.org/configuration/options#secret
- **Verification:** Read `lib/auth-secret.ts` in full and its single consumer `lib/auth.ts:39`. Inference (failure mode) — exact check: confirm no startup assertion exists; `runtime-readiness.ts` reports but does not block boot.

---

### [SEC-02] `ARCH_REVIEW_FOLLOWUP_SECRET` still falls back to `ZOHO_SYNC_SECRET`
- **Severity:** Medium
- **Category:** Security (Secrets / Authorization boundary)
- **Location:** `app/api/architecture-review/followups/route.ts:43-46`
- **Evidence:**
  ```ts
  const configuredSecret = process.env.ARCH_REVIEW_FOLLOWUP_SECRET ?? process.env.ZOHO_SYNC_SECRET ?? "";
  const usingZohoFallbackSecret = !process.env.ARCH_REVIEW_FOLLOWUP_SECRET && Boolean(process.env.ZOHO_SYNC_SECRET);
  ```
- **Impact:** Two distinct trust boundaries are merged. Any party (or system component) authorized only for Zoho lead sync (`ZOHO_SYNC_SECRET`) can also authenticate to the follow-up route and trigger architecture-review follow-up emails to leads. Compromise/leakage of one secret expands blast radius to the other surface. Comparison itself is timing-safe (`safeSecretEqual`), so this is purely a boundary/secret-hygiene issue, not a bypass. The fallback is logged (`:60-64`), which aids detection.
- **Exploitability:** Difficulty Medium; precondition is that `ARCH_REVIEW_FOLLOWUP_SECRET` is unset (fallback active) AND the actor possesses `ZOHO_SYNC_SECRET`. No external pre-auth path.
- **Recommendation (NOT APPLIED):** Remove the `?? process.env.ZOHO_SYNC_SECRET` fallback; require a dedicated `ARCH_REVIEW_FOLLOWUP_SECRET` and return 503 if unset (the route already 503s on empty secret).
- **References:** https://owasp.org/Top10/A05_2021-Security_Misconfiguration/ ; https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **Verification:** Read the route in full; cross-checked against `lib/runtime-readiness.ts:398-412` which explicitly documents the fallback and recommends its removal. Confirmed live (not just readiness reporting).

---

### [SEC-03] Reference-material fetcher follows redirects and lacks post-DNS private-range blocking
- **Severity:** Medium
- **Category:** Security (SSRF defense-in-depth)
- **Location:** `lib/validator-reference-material.ts:90-137` (fetch at `:97`), allowlist `:143-163`
- **Evidence:**
  ```ts
  const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
  ```
  `isAllowedReferenceUrl` validates only the *initial* URL's hostname against suffix allowlist; it does not resolve DNS nor re-validate redirect targets.
- **Impact:** An allowlisted host that returns a 30x to an internal/metadata address (e.g. `169.254.169.254`) would be followed, and DNS for an allowlisted name resolving to a private IP (rebinding) is not blocked. Combined with `application/json`/`text` body return, a successful internal fetch could leak limited response text into extracted keywords. **In practice this is hard to reach:** the fetched URLs come from a server-side filesystem catalog (`lib/validator-library.ts:159-236`), not from request input, and the only publicly runnable profile (FTR) defines no URLs (`validator-library.ts:52-71`).
- **Exploitability:** Difficulty High; preconditions include the ability to control catalog JSON (operator/repo access) or an allowlisted AWS host performing an open redirect to an internal target. Not reachable by an ordinary authenticated user.
- **Recommendation (NOT APPLIED):** Set `redirect: "manual"` and re-validate each hop against the allowlist; resolve the hostname and reject RFC1918 / link-local / `::1` / `169.254.0.0/16` / `fd00::/8` ranges before connecting (or pin via a vetted resolver). Route this fetch through a hardened helper rather than bare `fetch`.
- **References:** https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- **Verification:** Read `validator-reference-material.ts` fully; traced caller chain `validator.ts:71` → route `:111` (`resolveValidatorTargetContext`) and confirmed URL provenance in `validator-library.ts`. Confirmed FTR carries no URLs and is the only public profile (`route.ts:80-88`).

---

### [SEC-04] Architecture-review PDF page count is capped client-side only (no server enforcement)
- **Severity:** Medium
- **Category:** Security (Resource exhaustion / DoS defense-in-depth)
- **Location:** Cap defined `lib/architecture-review/client.ts:28-30` (`PDF_OCR_MAX_PAGES = 8`, `PDF_TEXT_MAX_PAGES = 20`, `PDF_OCR_MAX_FILE_BYTES = 6MB`); server parse `app/api/submit-architecture-review/route.ts:206-208`
- **Evidence:**
  - `client.ts` is browser-side (`document.createElement` `:142`, `pdfjs-dist` `:202`, `tesseract.js` `:73,246`).
  - Server fallback parses without a page cap:
    ```ts
    const pdfParseModule = await import("pdf-parse");
    const parsed = await pdfParseModule.default(Buffer.from(bytes));
    ```
- **Impact:** A crafted PDF within the 8MB byte cap but with very many pages / heavy content can drive CPU/memory during server-side `pdf-parse`, since the 8-page guard lives only in the bypassable client. Byte cap (8MB) limits the worst case, and a rate limiter (8/hr per user + 1/day per domain + 24/day) caps frequency, so impact is bounded.
- **Exploitability:** Difficulty Medium; precondition is a verified business-email account (free-tool access) and a hand-built multipart request omitting `clientPdfText` to force the server parse path.
- **Recommendation (NOT APPLIED):** Enforce a server-side page cap after parse (e.g. reject `parsed.numpages > 8`) and a server-side OCR-bytes guard mirroring the client constants; treat client caps as UX only.
- **References:** https://owasp.org/www-community/attacks/Denial_of_Service ; https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- **Verification:** Confirmed cap constants live in `client.ts` (browser); confirmed server route/worker parse PDFs without a page check (`route.ts:206-208`; `jobs.ts:646-654` consumes text only). Byte cap and rate limits verified in `route.ts:134-143,343-371`.

---

### [SEC-05] Server-side `pdf-parse` executed on attacker bytes when client text is absent
- **Severity:** Low
- **Category:** Security (Untrusted parsing)
- **Location:** `app/api/submit-architecture-review/route.ts:203-213`
- **Evidence:**
  ```ts
  let clientPdfText = metadata.clientPdfText?.trim() ?? "";
  if (!clientPdfText) {
    const pdfParseModule = await import("pdf-parse");
    const parsed = await pdfParseModule.default(Buffer.from(bytes));
    clientPdfText = (parsed.text || "").replace(/\s+/g, " ").trim();
  }
  ```
- **Impact:** Routes attacker-controlled PDF bytes through `pdf-parse` (a third-party parser with a history of CVEs) in the request handler. Bounded by the 8MB cap and magic-byte pre-check, but increases dependency-vulnerability surface. Ties to SEC-04.
- **Exploitability:** Difficulty Medium; same preconditions as SEC-04 (omit `clientPdfText`). No known unpatched RCE in the pinned version was confirmed in this read-only pass.
- **Recommendation (NOT APPLIED):** Keep `pdf-parse` pinned/patched (track advisories); consider a worker/sandbox boundary and the SEC-04 page cap; consider requiring `clientPdfText` rather than re-parsing server-side.
- **References:** https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- **Verification:** Read the route path; confirmed the fallback runs in the request handler. Dependency-version vuln status not verifiable read-only without network — exact check: `npm audit` / advisory lookup for the pinned `pdf-parse` version.

---

### [SEC-06] CSP allows `script-src 'unsafe-inline'` (and `'unsafe-eval'` outside production)
- **Severity:** Medium
- **Category:** Security (XSS mitigation strength)
- **Location:** `lib/csp.ts:22-25,36`
- **Evidence:**
  ```ts
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (nodeEnv !== "production") scriptSrc.push("'unsafe-eval'");
  ...
  `script-src ${scriptSrc.join(" ")}`,
  ```
- **Impact:** `'unsafe-inline'` in `script-src` largely defeats CSP as an XSS backstop — any injected inline `<script>` would execute. `style-src 'unsafe-inline'` (`:37`) is lower-risk but also weakens the policy. The rest of the policy is strong (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`), so this is the main CSP gap.
- **Exploitability:** Difficulty High in isolation (requires a separate injection sink to leverage); this finding is about reduced mitigation, not a standalone vuln.
- **Recommendation (NOT APPLIED):** Move to a nonce/hash-based `script-src` (drop `'unsafe-inline'`); confine GTM via nonce. Tighten `style-src` to hashes/nonces where feasible.
- **References:** https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html ; https://owasp.org/Top10/A03_2021-Injection/
- **Verification:** Read `lib/csp.ts` in full and `next.config.ts:6-23` (where CSP is emitted production-only).

---

### [SEC-07] CSP / HSTS emitted only in production (`NODE_ENV === "production"`)
- **Severity:** Low
- **Category:** Security (Header hardening)
- **Location:** `next.config.ts:17-22`
- **Evidence:**
  ```ts
  ...(process.env.NODE_ENV === "production"
    ? [ { key: "Strict-Transport-Security", ... }, { key: "Content-Security-Policy", value: contentSecurityPolicy } ]
    : []),
  ```
- **Impact:** Preview/staging deploys not running with `NODE_ENV=production` ship without CSP/HSTS, leaving non-prod environments (which may carry real-ish data) less protected and masking CSP regressions until prod. Vercel production sets `NODE_ENV=production`, so prod itself is covered.
- **Exploitability:** Difficulty High; only affects non-production hosts.
- **Recommendation (NOT APPLIED):** Emit CSP on all environments (use report-only mode in non-prod if needed) and HSTS on any HTTPS host.
- **References:** https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
- **Verification:** Read `next.config.ts`. `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` are unconditional (`:8-16`); only CSP+HSTS are gated.

---

### [SEC-08] `.eml` / CTA signing secrets fall back to `NEXTAUTH_SECRET`
- **Severity:** Info
- **Category:** Security (Secret boundary)
- **Location:** `lib/architecture-review/jobs.ts:183`; `lib/architecture-review/cta-links.ts:6`
- **Evidence:**
  ```ts
  // jobs.ts
  return process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  // cta-links.ts
  return process.env.ARCH_REVIEW_CTA_SECRET ?? process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
  }
  ```
- **Impact:** When dedicated secrets are unset, email-artifact / CTA-link signing reuses the session-auth secret, coupling artifact signing to the auth trust boundary. `runtime-readiness.ts:346-390` surfaces this and recommends dedicated secrets. Lower impact than SEC-02 (these sign outbound artifacts rather than gate an inbound route).
- **Exploitability:** N/A (configuration hygiene).
- **Recommendation (NOT APPLIED):** Provision dedicated `ARCH_REVIEW_EML_SECRET` and `ARCH_REVIEW_CTA_SECRET`; consider removing the `NEXTAUTH_SECRET` fallbacks once set.
- **References:** https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **Verification:** Read both source lines and the corresponding readiness checks.

---

### [SEC-09] Admin allowlist matches on raw lowercased email (no unicode/IDN normalization)
- **Severity:** Info
- **Category:** Security (Authorization robustness)
- **Location:** `lib/security.ts:114-125`; `lib/admin-access.ts:8-18`
- **Evidence:** `parseAdminEmails` lowercases/trims/`filter(Boolean)`; `isAdminEmailAllowlisted` compares `email.trim().toLowerCase()` against the Set. No NFC/unicode or IDN-homograph normalization.
- **Impact:** Negligible in practice — admin role also requires `emailVerified` and the user record's email is itself normalized at registration. Noted only for completeness; no realistic bypass.
- **Exploitability:** N/A.
- **Recommendation (NOT APPLIED):** Optional: apply unicode NFC normalization to both allowlist and stored emails for parity.
- **References:** https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- **Verification:** Read both functions; confirmed `emailVerified` co-requirement at `admin-access.ts:16-18`.

---

### [SEC-10] Dead "webllm" / `llm-refine` surface remains after web-llm removal
- **Severity:** Info
- **Category:** Security (Attack-surface hygiene)
- **Location:** `lib/architecture-review/types.ts:211`; `lib/architecture-review/quote.ts:61,148`; `llm-refine` phase referenced in `lib/architecture-review/jobs.ts:73,178,287,325`
- **Evidence:** `mode: z.enum(["rules-only", "webllm"]).optional()` and a `context?.mode === "webllm"` cost-heuristic branch persist, though no LLM dependency exists in `package.json`.
- **Impact:** None today (no LLM sink, so no prompt-injection path — see Area 5). Pure dead-code/clarity concern; could mislead future contributors into re-enabling an LLM path without re-evaluating OCR-text-as-data handling.
- **Exploitability:** N/A.
- **Recommendation (NOT APPLIED):** Remove the `webllm` enum member, the `llm-refine` phase, and the `llmRefinement` schema, or document them as reserved/no-op.
- **References:** https://owasp.org/www-project-top-10-for-large-language-model-applications/ (LLM01 Prompt Injection — preventive context)
- **Verification:** Grepped repo for LLM SDKs (none) and for `webllm`/`llmRefinement`/`llm-refine` usage; confirmed OCR text flows only into the deterministic `evaluateArchitectureReviewInput` (`jobs.ts:659-681`).

---

## Direct answers to required questions

1. **Report path:** `/Users/zohaibkhawaja/Documents/Code/zokorp-platform/audit/2026-06-29/04-security.md`

2. **Is `lib/http.ts` SSRF-safe (allowlist + post-DNS private-range block)?** **No** — `fetchWithTimeout` (`lib/http.ts:13-58`) has neither an allowlist nor any IP-range blocking; it only adds a timeout. **However, it is not a user-reachable SSRF primitive** because every caller passes fixed first-party endpoints built from env config (no request-controlled host/path). The only data-driven fetch (`validator-reference-material.ts:97`) has its *own* host-suffix allowlist but follows redirects and lacks post-DNS private-range blocking (SEC-03); its URLs come from a server-side filesystem catalog, not user input, and the only public profile carries no URLs.

3. **Is the FOLLOWUP→ZOHO_SYNC_SECRET fallback still present?** **Yes** — `app/api/architecture-review/followups/route.ts:43`: `process.env.ARCH_REVIEW_FOLLOWUP_SECRET ?? process.env.ZOHO_SYNC_SECRET ?? ""` (SEC-02). Recommend removal.

4. **Are upload caps enforced server-side?** **Size caps: Yes** (both routes enforce byte caps on `file.size` and on the buffered length server-side, with server-side magic-byte type validation and in-memory processing). **PDF page cap (8-page): No** — that cap (and the 6MB OCR cap) lives only in browser-side `lib/architecture-review/client.ts`; the server does not enforce a page-count limit (SEC-04/SEC-05).

5. **Is the Stripe webhook raw-body + idempotent?** **Yes to both** — raw body via `request.text()` before `constructEvent` (`route.ts:29-42`), and idempotency enforced at the DB level by unique `StripeWebhookEvent.stripeEventId` plus unique `CheckoutFulfillment.stripeCheckoutSessionId`, with the `P2002` duplicate caught and short-circuited inside the fulfillment transaction (no double-fulfillment on retries).

## Unverifiable read-only (exact check needed)
- **SEC-01 failure mode** (boot behavior when secret missing/weak): would require running the app — exact check: start the server with `NEXTAUTH_SECRET`/`AUTH_SECRET` unset and observe NextAuth behavior; or add a startup assertion.
- **SEC-05 dependency vuln status** for the pinned `pdf-parse` (and transitive parsers): requires advisory lookup — exact check: `npm audit` / GitHub Advisory query for the locked version (no network performed in this audit).
- **Runtime CSP/HSTS header emission** on preview vs production: not exercised — exact check: inspect response headers on a live preview deploy vs production (confirmed in source only).
