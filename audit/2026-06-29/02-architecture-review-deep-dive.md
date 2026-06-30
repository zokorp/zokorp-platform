# Architecture Reviewer — End-to-End Data-Flow Deep Dive

- Audit scope: Architecture Diagram Reviewer flow + per-file deep read of flagged large files
- Audit commit: `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- Audit date: 2026-06-29
- Method: READ-ONLY static review. Every finding cites code read at `path:line`. No code was executed, no network/DB/email/Stripe/Zoho calls were made.

---

## (a) End-to-end data-flow narrative

1. **Browser capture & local evidence extraction** —
   `components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm.tsx`.
   - On submit the form first runs `isStrictDiagramFile(selectedFile)` (`onSubmit` at `ArchitectureDiagramReviewerForm.tsx:813`), which lives in `lib/architecture-review/client.ts:316`.
   - Per format it extracts text *client-side*: PNG/JPG via tesseract.js OCR (`extractPngTextEvidence`, `client.ts:71`), PDF via pdfjs text layer with OCR fallback (`extractPdfTextEvidence`, `client.ts:197`), SVG via label extraction after `validateSvgMarkup` (`extractSvgEvidence`, `client.ts:46`).
   - Client caps: `MAX_DIAGRAM_FILE_BYTES = 8MB` (`client.ts:25`), PDF OCR fallback gated at 6MB / 8 pages (`client.ts:30,29`), text scan ≤20 pages (`client.ts:28`).
   - A `FormData` is sent to `/api/submit-architecture-review` carrying `metadata` (JSON) + `diagram` (File). `metadata` includes `clientPngOcrText` / `clientPdfText` / `clientSvgText` (`ArchitectureDiagramReviewerForm.tsx:1153-1188`). **No recipient email is ever sent** — the server uses the verified account email.

2. **Submit route** — `app/api/submit-architecture-review/route.ts`.
   - `requireSameOrigin` (`route.ts:290`) → `requireVerifiedFreeToolAccess` (`route.ts:295`, `lib/free-tool-access.ts:29`) which enforces session + `emailVerified` + `isBusinessEmail` and rejects any `submittedEmail !== accountEmail`.
   - Domain rate-limit (1/24h) at `route.ts:302-322`, per-user fingerprint limit (8/h) at `route.ts:343`, idempotency cache lookup at `route.ts:329`, daily-limit count at `route.ts:362`.
   - `parsePayloadFromRequest` (`route.ts:116`) validates multipart, size, magic-byte signatures (`isPngBytes`/`isJpegBytes`/`isPdfBytes`), `isSafeSvgBytes` for SVG, and requires the matching browser-evidence text. Metadata validated by `submitArchitectureReviewMetadataSchema` (`lib/architecture-review/types.ts:229`).
   - Optional WorkDrive archive of the raw diagram if `saveForFollowUp` (`route.ts:375`).
   - `createArchitectureReviewJob` (`lib/architecture-review/jobs.ts:557`) persists a job row — **filename + mimetype only, never raw bytes**.
   - `processArchitectureReviewJob(createdJob.id)` is invoked **synchronously inside the request** (`route.ts:401`).

3. **Job processing** — `lib/architecture-review/jobs.ts:599`.
   - `claimJob` (atomic `updateMany` lease, `jobs.ts:369`) → phase machine (`updatePhase`, `jobs.ts:405`).
   - `nonArchitectureParagraphPrecheck` (`jobs.ts:338`) and OCR-evidence presence check.
   - Scoring: `evaluateArchitectureReviewInput` (`lib/architecture-review/evaluator.ts:43`) → `createEvidenceBundle` (`lib/architecture-review/evidence.ts:10`) → `buildReviewReportFromEvidence` (`client.ts:466`) → deterministic rules (`engine.ts` + `engine/*`).
   - Lead + estimate companion + Zoho invoice + email content (`buildArchitectureReviewEmailContent`, `lib/architecture-review/email.ts:653`) + outbox row.
   - Email send via `sendArchitectureReviewEmail` (`lib/architecture-review/sender.ts:239`) **to `job.userEmail` only** (`jobs.ts:1003-1008`).
   - On success/fallback the job's `reportJson`, `submissionContextJson`, `clientTimingJson` are scrubbed and metadata reduced via `scrubStoredMetadata` (`jobs.ts:1055-1058`, `1211-1214`); outbox bodies redacted (`jobs.ts:1021,1178`). Report is also written **unredacted** to `ToolRun` (`jobs.ts:1133`).

4. **Async drain / retry** — `lib/architecture-review/worker-run.ts:5` → `drainArchitectureReviewQueue` (`jobs.ts:1330`), driven by two entry points:
   - `app/api/architecture-review/worker/route.ts` (POST, `ARCH_REVIEW_WORKER_SECRET`, limit 1–10).
   - `app/api/internal/cron/architecture-review-worker/route.ts` (GET, `CRON_SECRET`, default limit 3).
   - Both constant-time compare via `safeSecretEqual` and return 503 when unconfigured. Same lease/claim path → no double-send.

5. **Status polling** — `app/api/architecture-review-status/route.ts:8`. `requireUser` + ownership check (`job.userId !== user.id` → 404). Returns `serializeArchitectureReviewJobStatus` (`jobs.ts:1404`).

6. **Privacy mode delivery** — `app/api/architecture-review/privacy-email/route.ts:282`. Same-origin + verified access; client-computed `report` is accepted (validated by `architectureReviewPrivacyEmailSchema`, `types.ts:312`), `userEmail` is re-stamped to `access.email` (`privacy-email/route.ts:393-396`), email sent **to `access.email` only**.

7. **Follow-ups** — `app/api/architecture-review/followups/route.ts:42`, builder `lib/architecture-review/followup.ts:59`. Secret-gated; emails sent to `lead.userEmail`.

8. **Diagram generation** — `lib/architecture-review/diagram-generator.ts` is **client-only** (imported solely by the form, `ArchitectureDiagramReviewerForm.tsx:22-24`). It produces an SVG file that is then fed back through the same upload validation.

**Raw-bytes verification (migration 0011):** `prisma/migrations/0011_architecture_review_remove_raw_bytes/migration.sql` drops `diagramBytes`. Current `model ArchitectureReviewJob` (`prisma/schema.prisma:526-570`) has no byte column; `createArchitectureReviewJob` receives only `diagramFileName`/`diagramMimeType` (`jobs.ts:557-597`). Raw bytes flow only to OCR/pdf-parse (transient) and to the **consented, encrypted** WorkDrive archive / `archiveToolSubmission` (`lib/privacy-leads.ts:289` `encryptArchivePayload`). **Confirmed: no raw diagram bytes are persisted to the database.**

---

## (b) Per-file analysis of flagged large files

### `components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm.tsx` (~1986 LOC)
Client component. OCR/pdf parsing all run in-browser; only extracted text + metadata + the file are POSTed. No recipient field is collected. The generated-diagram path (`handleGenerateDiagram`, line 730) sets the generated SVG as the upload file (line 761) — see ARCH-01. Client validation `isStrictDiagramFile` mirrors the server, so most malformed uploads are caught before the network call (defense in depth), but the *order* in `onSubmit` runs validation/extraction client-side **after** the server has already consumed rate limits on the eventual POST — see ARCH-02. No `dangerouslySetInnerHTML` of report content found in scope.

### `lib/architecture-review/jobs.ts` (~1422 LOC)
Core worker. Strengths: atomic `claimJob` lease (`jobs.ts:369`), idempotent interaction event IDs, post-delivery scrub of `reportJson`/context/timing/metadata (`jobs.ts:1055-1058`), `MAX_ATTEMPTS=3` with backoff (`failJob`, `jobs.ts:456`), schema-drift tolerance. Weaknesses: the entire pipeline (Zoho invoice sync, WorkDrive, email send) runs **synchronously in the submit request** via `processArchitectureReviewJob` (called from `route.ts:401`) — ARCH-04. Raw `error.message` is stored in `errorMessage` and surfaced to clients — ARCH-03. Report (with embedded user paragraph) is written to `ToolRun` and never scrubbed by the retention sweep — ARCH-05.

### `lib/architecture-review/diagram-generator.ts` (~1511 LOC)
All dynamic text passes through `escapeXml` (`diagram-generator.ts:527`) before entering the SVG (node labels at `:1409`, edge labels `:1369/:1389`, title `:1434/:1452`, lane labels `:1339`). Icon `href`s are either code-owned relative paths or `data:` base64 embeds from `icon-embeds.ts` (`resolveIconHref`, `:1178`). No `eval`/`new Function`/`innerHTML`. The injection surface (user narrative → node label) is properly escaped. The one real defect is functional: the embeds make the output fail the project's own SVG validator — ARCH-01.

### `lib/architecture-review/icon-embeds.ts` (~190KB)
A static `Record<string, string>` of `data:image/svg+xml;base64,...` icons (`icon-embeds.ts:3`). Code-owned, no user input, no injection vector. Note it is the source of the `data:` hrefs implicated in ARCH-01.

### `lib/architecture-review/email.ts` (~43KB)
Customer email builder. **Every interpolated value is escaped with `escapeHtml`** (`email.ts:67`) — including `report.flowNarrative` (`:549`), `finding.why`/`evidenceSeen`/`howToFix` (`:285-287`), official-link URLs/labels (`:293`), observation services (`:384`), and reference codes. The email does **not** embed the diagram SVG or raw OCR text. Case-study/counterfactual content is code-owned and still escaped (`:269,276`). No HTML-injection vector found from OCR/paragraph/findings. (Minor: `escapeHtml` order escapes `&` first — correct.)

### `lib/architecture-review/svg-safety.ts` + `server.ts`
`validateSvgMarkup` (`svg-safety.ts:82`) blocks `<script>`, inline `on*=` handlers, `javascript:`, `<foreignObject>`, external/`data:`/protocol `href`s (`isForbiddenProtocolReference`, `:22`), `@import url()`, non-fragment `url()`, and oversized dimensions/area. Shared by client (`client.ts`) and server (`server.ts:7`). This is a solid allowlist-style guard. Its strictness on `data:` is what surfaces ARCH-01.

---

## (c) Findings

### [ARCH-01] "Generate diagram" produces an SVG the app's own upload validator rejects
- Severity: High
- Category: Correctness
- Location: `lib/architecture-review/diagram-generator.ts:1178-1195,1416-1418`; `lib/architecture-review/svg-safety.ts:22-41,119-129`; `components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm.tsx:743-761`
- Evidence:
  - Generator embeds icons as data URIs: `resolveIconHref` returns `getArchitectureIconEmbed(node.iconKey)` (`diagram-generator.ts:1180`), rendered as `` `<image href="${escapeXml(iconHref)}" ...>` `` (`:1417`). `icon-embeds.ts:4` values are `"data:image/svg+xml;base64,..."`. Every generated diagram carries default-seed nodes with icon keys (`PROVIDER_DEFAULT_SEEDS`, `diagram-generator.ts:484+`), so a `data:` href is always present.
  - Validator forbids it: `isForbiddenProtocolReference` returns `true` for `data:` (`svg-safety.ts:32-34`); the `href` scan (`svg-safety.ts:119-129`) rejects the markup with "SVG with external or data URI references is not allowed."
  - The generated file is set as the upload (`ArchitectureDiagramReviewerForm.tsx:761 setSelectedFile(generatedFile)`) and then re-validated by `isStrictDiagramFile`/`extractSvgEvidence` (which call `validateSvgMarkup`) at submit time (`client.ts:374-378`, `client.ts:46-51`).
  - Tests confirm both halves: `tests/architecture-review-diagram-generator.test.ts:24` asserts the SVG contains `data:image/svg+xml;base64,`; `tests/architecture-review-svg-safety.test.ts:14-17` asserts `<image href="data:image/svg+xml;base64,...">` is rejected.
- Impact: A user who uses the built-in "Generate diagram" helper and then submits gets a client-side validation error ("SVG with external or data URI references is not allowed"); if it reached the server it would be a 400 `INVALID_DIAGRAM_FILE` (`route.ts:237,427`). The feature is effectively broken for its primary purpose, and (combined with ARCH-02) can waste the business domain's single daily slot.
- Recommendation (NOT APPLIED): allow code-owned `data:image/...;base64,` references in `validateSvgMarkup` (e.g., permit `data:image/png`/`data:image/svg+xml` while still blocking `data:text/html` and scriptable types), OR have the generator inline the icon `<svg>` markup instead of `<image href="data:...">`, OR strip/rewrite embeds in `makeGeneratedDiagramSvgFile`. Add a test asserting `validateSvgMarkup(generated.svg).ok === true`.
```diff
NOT APPLIED — illustrative, svg-safety.ts isForbiddenProtocolReference
- if (normalized.startsWith("data:")) {
-   return true;
- }
+ if (normalized.startsWith("data:")) {
+   // allow inert image data URIs used by the in-house diagram generator
+   return !/^data:image\/(png|jpeg|svg\+xml);base64,/.test(normalized);
+ }
```
- References: n/a
- Verification: Confirmed in code (and corroborated by the two existing tests).

### [ARCH-02] Domain (1/24h) and per-user rate limits are consumed before payload validation
- Severity: High
- Category: Reliability
- Location: `app/api/submit-architecture-review/route.ts:302-322,343-348,373`; `lib/rate-limit.ts:70-102`
- Evidence: The domain limiter is consumed at `route.ts:303` (`consumeRateLimit({ key: arch-review-domain:${emailDomain}, limit: ARCH_REVIEW_DOMAIN_LIMIT=1, windowMs: 24h })`) and the per-user fingerprint limiter at `route.ts:343`, both **before** `parsePayloadFromRequest(request)` at `route.ts:373`. `consumeRateLimit` increments the bucket on every allowed call (`rate-limit.ts:95-96` and the DB path `:165-174`). Idempotency replay also runs *after* the domain increment (`route.ts:329` is after `:303`).
- Impact: A first request that later fails validation (e.g., the ARCH-01 generated-SVG case, a wrong magic byte, oversize, missing evidence, malformed metadata) still burns the business **domain's only free architecture review for 24h** (`ARCH_REVIEW_DOMAIN_LIMIT = 1`, `route.ts:27`). For a multi-user company this means one user's failed/typo'd attempt locks out the whole domain for the day. Idempotent retries also re-burn the domain budget.
- Exploitability (security only): Low-effort denial-of-service against a competitor's domain is *not* possible (the limiter key is the *attacker's own* verified business domain), so blast radius is self-inflicted; classified Reliability rather than Security.
- Recommendation (NOT APPLIED): Move both `consumeRateLimit` calls to **after** `parsePayloadFromRequest` succeeds (validate first, then meter), or only consume the domain slot once the job is actually created. Alternatively raise `ARCH_REVIEW_DOMAIN_LIMIT` and/or only count *successful* submissions toward the domain cap.
- References: n/a
- Verification: Confirmed in code.

### [ARCH-03] Raw internal error message returned to client on job failure
- Severity: Medium
- Category: Security
- Location: `lib/architecture-review/jobs.ts:1305-1307,456-471,1412`; consumed by `app/api/architecture-review-status/route.ts:23` and `app/api/submit-architecture-review/route.ts:403,417`
- Evidence: The job catch-all stores the raw message: `const message = error instanceof Error ? error.message : "..."; return failJob(job, message);` (`jobs.ts:1306-1307`). `failJob` writes it to `errorMessage` (`jobs.ts:459-460`). `serializeArchitectureReviewJobStatus` returns it verbatim: `error: job.status === "failed" ? job.errorMessage : null` (`jobs.ts:1412`). Both the synchronous submit response and the status endpoint serialize via this function.
- Impact: Unexpected internal failures (Prisma error text, Zoho/WorkDrive client errors, null-deref messages, etc.) are reflected to the authenticated caller, leaking implementation/dependency detail. Contrast the route-level handlers which return generic strings (`route.ts:480`). Limited audience (authenticated, own job), hence Medium.
- Exploitability (security only): Difficulty low (just trigger any unhandled processing error); precondition: authenticated verified user, own job.
- Recommendation (NOT APPLIED): Persist the raw message for operators but return a generic client-facing string from `serializeArchitectureReviewJobStatus` (e.g., map to a stable code such as `PROCESSING_FAILED`); keep detail in `AuditLog`/server logs only.
- References: n/a
- Verification: Confirmed in code.

### [ARCH-04] Full delivery pipeline runs synchronously inside the submit HTTP request
- Severity: Medium
- Category: Reliability
- Location: `app/api/submit-architecture-review/route.ts:373-417`; `lib/architecture-review/jobs.ts:599-1308`
- Evidence: `processArchitectureReviewJob(createdJob.id)` is awaited inline in `POST` (`route.ts:401`). That function performs WorkDrive report archive (`jobs.ts:774`), Zoho invoice sync `syncZohoInvoiceEstimate` (`jobs.ts:821`), estimate companion writes, and the email send `sendArchitectureReviewEmail` (`jobs.ts:1003`) which itself can wait on ZeptoMail (12s, `sender.ts:71`) → Resend (12s, `:131`) → SMTP (up to 120s socket timeout, `sender.ts:196`).
- Impact: Worst case the request can block well beyond typical serverless/edge function limits (provider-dependent), causing a function timeout *after* a job row exists and possibly after the email was sent — the user sees a network error while the job actually progresses. The async `worker`/`cron`/status machinery exists but the hot path doesn't use it. The atomic `claimJob` lease prevents double-send if the worker later picks the same job, so correctness is preserved; this is a latency/timeout reliability issue.
- Recommendation (NOT APPLIED): Return `202 queued` immediately after `createArchitectureReviewJob` and let the worker/cron drain it (the client already polls the status endpoint and handles `status: "queued"`, `ArchitectureDiagramReviewerForm.tsx:1203`). Cap synchronous external-call budget if inline processing is retained.
- References: n/a
- Verification: Confirmed in code.

### [ARCH-05] ToolRun retains full report (with user's raw paragraph) and is excluded from the retention sweep
- Severity: Medium
- Category: Privacy
- Location: `lib/architecture-review/jobs.ts:1133,1289`; `lib/tool-runs.ts:91,278`; `lib/architecture-review/engine/shared.ts:475`; `lib/retention-sweep.ts:24-66`
- Evidence: `recordArchitectureReviewToolRun({ ..., report, ... })` is called on both sent and fallback paths (`jobs.ts:1133`, `:1289`) and stores it unencrypted as `reportJson: toJsonValue(input.report ...)` (`tool-runs.ts:91`). The report's `flowNarrative` embeds the user's raw paragraph: `` `... Narrative summary: ${paragraph}.${contradiction}` `` (`engine/shared.ts:475`). The retention sweep scrubs `LeadLog.reportJson`/`inputParagraph` (`retention-sweep.ts:41-46`), `ArchitectureReviewJob.reportJson`/context/timing (`:47-63`), and outbox bodies (`:66-`) — but never touches `ToolRun.reportJson`. The job itself nulls `reportJson` after send (`jobs.ts:1058`), so the ToolRun copy becomes the long-lived store.
- Impact: The user's submitted narrative text persists indefinitely in `ToolRun` while the parallel copies are deliberately scrubbed — an inconsistency with the product's "raw diagrams are not retained / minimal metadata" messaging (`ArchitectureDiagramReviewerForm.tsx:991,1403`). Blast radius is limited: `ToolRun` is scoped by `userId` and has RLS enabled (`prisma/migrations/0022_platform_foundation_audit/migration.sql:112`), and it is the user's own data — hence Medium/Privacy rather than higher.
- Recommendation (NOT APPLIED): Either store a redacted/finding-only report in `ToolRun` (omit `flowNarrative`/paragraph), or extend `retention-sweep.ts` to scrub/redact aged `ToolRun.reportJson` for the architecture-reviewer slug, matching the LeadLog/Job behavior.
- References: n/a
- Verification: Confirmed in code.

### [ARCH-06] Server trusts client-supplied PNG/SVG evidence text without re-derivation
- Severity: Low
- Category: Correctness
- Location: `app/api/submit-architecture-review/route.ts:155-156,203-213,241-243`; `lib/architecture-review/jobs.ts:646-650`
- Evidence: For PDFs the server re-parses server-side when the client text is missing (`route.ts:205-209`, `pdf-parse`), but for **PNG/JPG** it only checks `metadata.clientPngOcrText?.trim()` is non-empty (`route.ts:155,179`) and for **SVG** only `metadata.clientSvgText?.trim()` (`route.ts:241`); the bytes are validated for type but the evidence text is never re-extracted from them server-side. The job then scores entirely from this client text (`jobs.ts:646-650` selects `metadata.clientSvgText`/`clientPdfText`/`clientPngOcrText`).
- Impact: The image/SVG actually uploaded need not correspond to the `clientPngOcrText`/`clientSvgText` used for scoring — a client can submit arbitrary "OCR" text decoupled from the diagram. Because the text is only ever used as match-data and is escaped in the email, this is not an injection/authz issue; it is a scoring-integrity gap (a user can game their own review). The non-architecture prechecks (`jobs.ts:338`, `engine/shared.ts:354`) provide partial mitigation. The OCR text is **treated as data, not instructions** throughout (regex/substring matching only), so there is no prompt-injection-style risk.
- Recommendation (NOT APPLIED): If scoring integrity matters, re-extract SVG label text server-side via the existing `extractSvgEvidenceFromBytes` (`lib/architecture-review/server.ts:11`) and reconcile against the client text; PNG/JPG OCR cannot be re-run server-side cheaply, so document the trust boundary or cross-check token overlap.
- References: n/a
- Verification: Confirmed in code.

### [ARCH-07] In-memory idempotency cache (and in-memory rate-limit fallback) is non-durable across instances
- Severity: Low
- Category: Reliability
- Location: `app/api/submit-architecture-review/route.ts:324-341,413-415`; `lib/idempotency-cache.ts` (module-global `Map`); `lib/rate-limit.ts:24,70-102,104-107`
- Evidence: Idempotency entries live in a process-global `Map` (`idempotency-cache.ts` `global.__zokorpIdempotencyCache`). `consumeRateLimit` uses the durable DB bucket only when `DATABASE_URL` is set and `NODE_ENV !== "test"`; otherwise it falls back to a process-local `Map` (`rate-limit.ts:24,105-106`).
- Impact: On multi-instance/serverless deployments, idempotent replays of `x-idempotency-key` are not reliably deduped (each cold instance has its own cache), so a retried submit can create a second job + second email. (Rate-limit itself is DB-backed in production, so the limit is durable; only the idempotency dedup and the test/no-DB rate-limit path are process-local.) Low severity because duplicate jobs are otherwise harmless (no entitlement/payment mutation here) and the worker won't double-send a single job.
- Recommendation (NOT APPLIED): Back the idempotency cache with the DB (a unique key column) the same way `StripeWebhookEvent`/`rateLimitBucket` are, or document that idempotency is best-effort single-instance only.
- References: n/a
- Verification: Confirmed in code.

### [ARCH-08] Follow-up secret falls back to `ZOHO_SYNC_SECRET`
- Severity: Info
- Category: Security
- Location: `app/api/architecture-review/followups/route.ts:43-46,60-64`
- Evidence: `const configuredSecret = process.env.ARCH_REVIEW_FOLLOWUP_SECRET ?? process.env.ZOHO_SYNC_SECRET ?? ""` (`followups/route.ts:43`). When the dedicated secret is unset it reuses `ZOHO_SYNC_SECRET` and logs an audit event (`:60-64`).
- Impact: Secret reuse across two endpoints widens the blast radius if `ZOHO_SYNC_SECRET` leaks (an attacker could trigger follow-up email sends to existing leads, which still only go to each lead's own verified `userEmail`, so no recipient hijack). Comparison is constant-time (`safeSecretEqual`, `:56`) and unconfigured → 503. Recorded as Info/hardening; the fallback is intentional and audited.
- Recommendation (NOT APPLIED): Require a distinct `ARCH_REVIEW_FOLLOWUP_SECRET` in production and drop the fallback, or document the shared-secret risk in the env contract.
- References: `docs/03-environment-variables-template.md`
- Verification: Confirmed in code.

### [ARCH-09] Positive controls confirmed (no finding)
- Severity: Info
- Category: Security
- Location: multiple
- Evidence:
  - **Recipient is never user-controlled.** Standard, privacy, and follow-up sends all use the verified account email (`jobs.ts:1004`, `privacy-email/route.ts:393-396,518`, `followup.ts:119`); `requireVerifiedFreeToolAccess` rejects mismatched `submittedEmail` (`free-tool-access.ts:56-62`).
  - **No raw diagram bytes persisted.** Migration 0011 drop verified; schema has no byte column (`schema.prisma:526-570`); `createArchitectureReviewJob` takes filename/mimetype only (`jobs.ts:557`).
  - **Email is injection-safe.** All dynamic content escaped via `escapeHtml` (`email.ts:67`, used at `:269,276,285-300,549,...`); diagram SVG is not embedded in the email.
  - **OCR/paragraph text treated as data, not instructions.** Used only for regex/substring matching and truncated excerpts (`engine/shared.ts:191-273,438-476`), then escaped before display.
  - **Worker auth is constant-time + fail-closed.** `safeSecretEqual` + 503-when-unconfigured in both worker entry points (`worker/route.ts:33-43`, `internal/cron/.../route.ts:25-33`).
  - **Consented archive is encrypted at rest** (`encryptArchivePayload`, `privacy-leads.ts:289`).
- Verification: Confirmed in code.

---

## Severity counts
- Critical: 0
- High: 2 (ARCH-01, ARCH-02)
- Medium: 3 (ARCH-03, ARCH-04, ARCH-05)
- Low: 2 (ARCH-06, ARCH-07)
- Info: 2 (ARCH-08, ARCH-09)

---

## Items not verifiable read-only (for the manual-verification report)

1. **ARCH-01 runtime confirmation** — Whether `validateSvgMarkup` actually rejects a real generated diagram end-to-end. Check: in a scratch test run `validateSvgMarkup(generateArchitectureDiagramFromNarrative({provider:"aws",narrative:"users hit api gateway then lambda then rds"}).svg).ok` and confirm it is `false`. (Static reading + existing tests already make this near-certain.)
2. **ARCH-02 production rate-limit backend** — Confirm prod uses the DB bucket (`DATABASE_URL` set, `NODE_ENV=production`) so the domain increment is durable. Check `consumeRateLimit` path actually taken in deployed env (`lib/rate-limit.ts:104-107`).
3. **ARCH-04 serverless timeout ceiling** — The actual function max duration on Vercel for `/api/submit-architecture-review` (route config / `vercel.json` / plan limits) vs. worst-case SMTP 120s socket timeout. Verify the configured `maxDuration` for the route.
4. **ARCH-05 retention policy intent** — Confirm with the owner whether `ToolRun.reportJson` retention is intentional; verify whether any scheduled sweep outside `retention-sweep.ts` covers `ToolRun`. Check `.github/workflows/` and `scripts/` for a ToolRun-scrub job.
5. **ARCH-06 scoring-integrity expectation** — Product decision: is client-supplied OCR text an accepted trust boundary for free tools? Confirm with owner; not statically resolvable.
6. **ARCH-08 env contract** — Whether `ARCH_REVIEW_FOLLOWUP_SECRET` is set distinctly in Vercel prod (cannot read secrets). Check Vercel env config / `docs/03-environment-variables-template.md` expectations.
