# 02d — Architecture Reviewer: Scoring & Quote Correctness Audit

- **Scope**: scoring + quote arithmetic and guardrails in `lib/architecture-review/*`
- **Commit**: `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- **Date**: 2026-06-29
- **Mode**: READ-ONLY forensic audit. No code/files changed except this report.

---

## TL;DR

The deterministic scoring and the two quote engines are arithmetically sound. **The single most important structural finding is that there are TWO different "consultation quote" figures with two different formulas, and the one the customer actually sees in the email is NOT the one in `quote.ts`.** The customer-facing dollar figure comes from `estimate-snapshot.ts` (`estimateSnapshot.totalUsd`), computed from code-owned `remediationHours × rate`. The `quote.ts` `calculateConsultationQuoteUSD` value is stored on the report (`consultationQuoteUSD`) and is referenced by `buildArchitectureConsultationQuote` line items, but **the email and the worker never render `report.consultationQuoteUSD` as the headline number** (verified: `grep consultationQuote lib/architecture-review/email.ts lib/architecture-review/jobs.ts` returns nothing).

Guardrails (low-confidence / regulated / broad-scope → diagnostic-first) are correctly enforced in **both** engines, with one isolated gap (ARCH-Q03). Admin overrides are well-isolated from code-owned hours/weights/citations (ARCH-Q07 confirms this is safe). The zombie `"webllm"` mode is dead and currently inert (ARCH-Q05).

---

## (a) The exact quote formula(s), transcribed with file:line

There are **two** quote computations. Both must be understood because they diverge.

### Formula A — `calculateConsultationQuoteUSD` (`lib/architecture-review/quote.ts:647-699`)

This populates `report.consultationQuoteUSD` and seeds `buildArchitectureConsultationQuote`'s line items. **It is NOT the email headline number** (see Formula B).

Guardrail short-circuits (all return the fixed advisory baseline `249`):
- `quote.ts:654-656` — `desiredEngagement === "review-call-only"` → `249`
- `quote.ts:658-660` — `requiresCustomScope(context)` → `249` (regulated scope ≠ "none", or ongoing-quarterly / architect-on-call)
- `quote.ts:662-664` — no positive findings → `249`
- `quote.ts:692-694` — `confidence < 0.85` → `249`

No-context legacy branch (`quote.ts:666-678`):
```
baseline = 249 + Σ finding.fixCostUSD   (positive findings only)
return min(scoreCapByBand(overallScore), baseline)
```

Main (with-context) branch (`quote.ts:680-698`):
```
baseHours      = Σ EFFORT_HOURS[finding.category][severityFromPoints(finding.pointsDeducted)]   (positive findings)
complexity     = 1 + clamp((tokenCount - 10) / 40, 0, 0.5)            // 1.0 .. 1.5
criticality    = criticalityMultiplier(workloadCriticality)          // 0.9 | 1.0 | 1.2
confidence     = estimateConfidence(positiveFindings, context)        // 0.7 .. 1.05
rate           = context.remediationRateUsdPerHour ?? 225
estimatedRemediationUsd = baseHours × rate × complexity × criticality × confidence
if (confidence < 0.85) return 249
baseline       = roundToNearest(249 + estimatedRemediationUsd, 25)    // nearest $25
return max(499, baseline)
```

**One-line Formula A:** `quote = max(499, roundTo25(249 + Σhours·rate·complexity·criticality·confidence))`, with hard `$249` floors for review-call-only, regulated/custom scope, no findings, or confidence < 0.85.

### Formula B — `buildArchitectureEstimateSnapshot` (`lib/architecture-review/estimate-snapshot.ts:133-256`) — THIS IS THE CUSTOMER-FACING NUMBER

Per positive finding (`estimate-snapshot.ts:146-192`):
```
remediationHoursLow/High = codeEntry.remediationHoursLow/High ?? 0.5     // CODE-OWNED catalog hours
scopeMultiplier          = isExpandedReviewScope(reviewScope) ? 1.15 : 1
estimatedHours           = roundHours( ((low+high)/2) × scopeMultiplier )  // max(0.5, round(x*2)/2)
derivedAmountUsd         = max(75, roundToNearest(estimatedHours × rate, 25))
amountUsd                = (pricingMode === "OVERRIDE")
                              ? midpointAmount(overrideMin, overrideMax)   // admin override path
                              : derivedAmountUsd
```
Total (`estimate-snapshot.ts:194-200`):
```
payableQuoteTotalUsd = Σ amountUsd (all candidate line items)
policy               = estimatePolicyForScore({overallScore, payableQuoteTotalUsd})
lineItems            = (policy.band === "consultation-only") ? [] : candidates
totalUsd             = Σ lineItems.amountUsd                 // 0 when consultation-only (score < 60)
```

**One-line Formula B (customer headline):** `totalUsd = Σ max(75, roundTo25(roundHours(avg(catalogHoursLow,catalogHoursHigh)·scopeMult)·rate))`, forced to `0`/"Consultation first" when `overallScore < 60`.

The email renders `estimateSnapshot.policy.payableQuoteEnabled ? toUsd(estimateSnapshot.totalUsd) : "Consultation first"` (`email.ts:487, 602, 754, 823`). `payableQuoteEnabled` is `false` for the consultation-only band (`estimate-snapshot.ts:107`) and for the optional-polish band when `totalUsd === 0` (`estimate-snapshot.ts:119`).

### Worked example (Formula B — the real customer number)

Submission: AWS, standard criticality, no regulated scope, expanded scope = false, rate = default `225`. Two positive findings survive:

1. `aws:public_database_exposure` — security, `remediationHoursLow=4, High=24` (`aws-launch-v1-catalog.ts:49`)
2. `aws:internet_facing_endpoint_without_tls` — security, `remediationHoursLow=2, High=12` (`aws-launch-v1-catalog.ts:48`)

Both are `consultation-only` policy-band rules, scoreWeight 5 each → overall score = `100 - 10 = 90` (no other deductions). Score ≥ 90 → `optional-polish` band, `payableQuoteEnabled = totalUsd > 0`.

- Finding 1: midpoint `(4+24)/2 = 14`; `roundHours(14×1) = 14`; `max(75, roundTo25(14×225)) = max(75, roundTo25(3150)) = 3150`.
- Finding 2: midpoint `(2+12)/2 = 7`; `roundHours(7) = 7`; `max(75, roundTo25(7×225)) = roundTo25(1575) = 1575`.
- `totalUsd = 3150 + 1575 = 4725` → email shows **$4,725**.

Note: this $4,725 is unbounded — Formula B has **no upper clamp** (see ARCH-Q01). For the same two findings, Formula A would have hit different floors/caps. The two engines are not reconciled.

---

## (b) The guardrail logic, transcribed

### Tier selection — `determineQuoteTier` (`quote.ts:176-209`)
```
review-call-only                          → "advisory-review"
ongoing-quarterly | architect-on-call
   | regulatoryScope !== "none"           → "implementation-partner"
analysisConfidence === "low"              → "advisory-review"
overallScore >= 90                        → "advisory-review"
overallScore >= 60                        → "remediation-sprint"
else                                      → "implementation-partner"
```
A `remediation-sprint` (the only tier `buildArchitectureConsultationQuote` will expand into payable line items) is therefore **unreachable** for any regulated scope, ongoing engagement, low confidence, or score outside 60–89. Verified against test `quote.test.ts:173-204` ("forces regulated scopes into custom-after-call pricing": expects tier `implementation-partner`, quote `249`).

### Score → policy band — `estimatePolicyForScore` (`estimate-snapshot.ts:95-131`)
```
overallScore < 60   → band "consultation-only",  payableQuoteEnabled = false, lineItems = []   (totalUsd forced to 0)
overallScore >= 90  → band "optional-polish",     payableQuoteEnabled = (totalUsd > 0)
else (60–89)        → band "remediation-estimate", payableQuoteEnabled = (totalUsd > 0)
```
This is the authoritative guardrail for the customer-facing number: any architecture scoring < 60 is **forced** to "Consultation first" with no dollar figure, regardless of how many findings or how high the per-finding hours. This is the strongest and correct guardrail.

### Confidence — `estimateConfidence` (`quote.ts:141-153`)
```
confidence = 1 - 0.1 × (# high-false-positive-risk positive findings)
           + (mode==="webllm" && ocrChars>=300 ? 0.05 : 0)
clamp(confidence, 0.7, 1.05)
```
`calculateAnalysisConfidence` (`quote.ts:159-174`): `>=0.95 → high`, `>=0.82 → medium`, else `low`.

### `requiresCustomScope` (`quote.ts:116-129`) — forces Formula A to $249
```
regulatoryScope && regulatoryScope !== "none"  → true
desiredEngagement ∈ {ongoing-quarterly-reviews, architect-on-call} → true
```

Confidence < 0.85 forces Formula A to $249 (`quote.ts:692-694`). Note the band edge: `medium` confidence starts at 0.82, but the quote floor triggers below 0.85 — so confidence in `[0.82, 0.85)` is labelled "medium" yet still forced to the diagnostic baseline. Intentional-looking, but see ARCH-Q06.

---

## (c) Admin-override isolation analysis

**Result: SAFE. Admin overrides cannot mutate code-owned hours, weights, citations, or rule versions.**

The customer dollar figure that flows to live email/checkout is Formula B via `loadArchitectureEstimateSnapshot` (`rule-catalog.ts:601-612`), which is the override-aware path. Live callers confirmed:
- `lib/architecture-review/jobs.ts:816` (async worker → email)
- `lib/architecture-review/checkout.ts:47` (Stripe checkout amount)
- `app/api/architecture-review/privacy-email/route.ts:405`

What an admin can submit (`parseArchitectureRuleCatalogFormInput`, `rule-catalog.ts:1175-1208`; form fields `app/admin/architecture-catalog/[ruleId]/page.tsx:251-300`):
`serviceLineLabel`, `pricingMode`, `publicFixSummary`, `internalResearchNotes`, `overrideMinPriceUsd`, `overrideMaxPriceUsd`, `nextReviewAt`, `changeSummary`. **Nothing else.** There is no form field or parse path for `remediationHoursLow/High`, `scoreWeight`, `maxPartialCredit`, `ruleVersion`, `officialSourceLinks`, or `estimatePolicyBand`.

Where the override is applied (`estimate-snapshot.ts:67-93`, `quoteAmountForFinding`):
```
if (pricingMode !== "OVERRIDE") return lineItem.amountUsd;   // code-derived
low/high = overrideMin/Max;
if both numbers → midpointAmount(low, high)
else low ?? high ?? lineItem.amountUsd
```
Crucially, even in OVERRIDE mode the **hours** displayed (`estimatedHours`, `remediationHoursLow/High`) still come from `codeEntry` (`estimate-snapshot.ts:149-150, 167-169`) — only the dollar `amountUsd` is replaced. So hours, citations, score weights, and policy bands remain fully code-owned. `normalizeOverrideAmount` (`rule-catalog.ts:277-283`) rejects negatives/non-finite and rounds to integer; `parseAmount` (`rule-catalog.ts:1183-1195`) rejects negatives and non-integers. This matches the CLAUDE.md contract ("admin rule-catalog UI can only edit customer-facing copy and price-override bands").

One residual risk note: an admin OVERRIDE with only `overrideMaxPriceUsd` set and `overrideMinPriceUsd` null returns the **max** (`estimate-snapshot.ts:88-90`), and an inverted band (min > max) is **not validated** — see ARCH-Q04 (Low).

---

## Findings

### [ARCH-Q01] Customer-facing email quote (Formula B `totalUsd`) has no upper bound
- **Severity**: High
- **Category**: Correctness
- **Location**: `lib/architecture-review/estimate-snapshot.ts:146-200`; consumed by `lib/architecture-review/email.ts:487,602`
- **Evidence**:
  ```ts
  const derivedAmountUsd = Math.max(75, roundToNearest(estimatedHours * remediationRateUsdPerHour, 25));
  ...
  const payableQuoteTotalUsd = quoteCandidateLineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  ...
  const totalUsd = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  ```
  There is a per-item **floor** (`max(75, …)`) but no per-item or total **ceiling**. With high-hour catalog rules (e.g. `aws:infrastructure_as_code_indicated` 8–60h → midpoint 34h → `roundTo25(34×225)=7650`; `aws:single_instance_production_compute` 6–40h; `aws:no_backup_strategy_for_stateful_data` 4–40h) a 60–89 score with several such findings can produce a five-figure auto-quoted dollar figure emailed to a free-tool user and used as the Stripe checkout amount (`checkout.ts:47`).
- **Impact**: A wrong/inflated customer-facing quote at scale. The docs explicitly promise a bounded estimate: `docs/architecture-review-pricing-matrix.md:23` states the remediation-sprint email range is "clamped to `$650-$2,200` low and `$850-$2,800` high" and `:78` says "The customer-facing Core Quote … is intentionally not a naive sum of all per-finding fix costs." Formula B **is** a naive sum with no clamp, contradicting the documented and intended behavior. (Formula A *does* clamp, but Formula A is not the number shown.)
- **Recommendation (NOT APPLIED)**: Apply an explicit band clamp to `totalUsd` (and/or per-item) consistent with the pricing-matrix doc, e.g. clamp the optional-polish/remediation-estimate `totalUsd` to a documented `[lowFloor, highCeiling]` band before it becomes `payableQuoteTotalUsd`. Alternatively, force scores in the high-hour cluster to consultation-first.
- **References**: `docs/architecture-review-pricing-matrix.md:23,78`; `lib/architecture-review/checkout.ts:47`
- **Verification**: Trace `jobs.ts:816 → loadArchitectureEstimateSnapshot → buildArchitectureEstimateSnapshot`; the returned `snapshot.totalUsd` is rendered at `email.ts:487/602/754/823`. No `Math.min`/clamp exists on `totalUsd` or `derivedAmountUsd` anywhere in `estimate-snapshot.ts`. The pricing test `tests/architecture-rule-catalog.test.ts` asserts specific totals but never asserts an upper bound, so the gap is uncaught.

### [ARCH-Q02] Two divergent "consultation quote" engines; `report.consultationQuoteUSD` is computed, stored, but never the headline number
- **Severity**: Medium
- **Category**: Correctness
- **Location**: `lib/architecture-review/quote.ts:647-761` (Formula A) vs `lib/architecture-review/estimate-snapshot.ts:133-256` (Formula B)
- **Evidence**: `report.consultationQuoteUSD` and `report.consultationQuote` are produced in `report.ts:213-219` and validated by the report schema (`types.ts:124-130`), but `grep -n "consultationQuote" lib/architecture-review/email.ts lib/architecture-review/jobs.ts` returns **no matches** — the email/worker render only `estimateSnapshot.totalUsd`. The two formulas use different inputs (Formula A: `EFFORT_HOURS` severity table + complexity/criticality/confidence multipliers + `$499` floor + `scoreCapByBand`; Formula B: catalog `remediationHours` + `scopeMultiplier` + `$75` per-item floor, no cap), so they will disagree for the same submission.
- **Impact**: Maintenance/correctness hazard and audit confusion. `consultationQuoteUSD` is persisted (and visible in audit logs / Stripe metadata adjacency) but is a different number from what the customer was quoted. A future change to `quote.ts` "to fix the quote" would have **no effect** on the customer-facing figure. The `$499` minimum and all the complexity/criticality multipliers in Formula A are effectively dead for the email path.
- **Recommendation (NOT APPLIED)**: Either (a) make the email render `report.consultationQuoteUSD` / `consultationQuote` and retire Formula B, or (b) explicitly document that `quote.ts` is legacy/secondary and Formula B is canonical, and remove or clearly mark the unused multipliers. Do not leave two unreconciled money formulas in the codebase.
- **References**: `lib/architecture-review/report.ts:213-219`; `lib/architecture-review/types.ts:124-130`; `docs/shared-diagnostic-quote-line-items.md:25-28`
- **Verification**: `grep -rn "consultationQuoteUSD\|consultationQuote" lib/architecture-review/email.ts lib/architecture-review/jobs.ts` → no matches (exit 1). Email money source confirmed at `email.ts:487,602,754,823`.

### [ARCH-Q03] Formula B applies no confidence guardrail; low-confidence reviews can still emit a payable dollar figure
- **Severity**: Medium
- **Category**: Correctness / Reliability
- **Location**: `lib/architecture-review/estimate-snapshot.ts:95-200`
- **Evidence**: `estimatePolicyForScore` keys only on `overallScore` and `payableQuoteTotalUsd`. There is **no `analysisConfidence` input**. A low-confidence review with `overallScore` in 60–89 (or ≥90 with findings) yields `payableQuoteEnabled = true` and a real `totalUsd`. Compare Formula A, which hard-stops at `confidence < 0.85 → 249` (`quote.ts:692-694`), and `buildArchitectureConsultationQuote`, which collapses to baseline when `analysisConfidence === "low"` (`quote.ts:707-729`). The snapshot only *softens the assumptions text* for low confidence (`estimate-snapshot.ts:210-212`) — it still shows the dollar figure.
- **Impact**: The documented guardrail "Low-confidence or custom-scope flows should not pretend the free submission approved a larger delivery scope" (`docs/shared-diagnostic-quote-line-items.md:34`) is enforced in Formula A but **not** in the customer-facing Formula B. A thin/ambiguous submission can still produce a payable, clickable Stripe quote.
- **Impact nuance**: Partially mitigated because the worker can downgrade confidence to `low` only via `nonArchitectureEvidence` (`evaluator.ts:84-87`) and a `low` confidence does change the **tier** (→ advisory-review) — but tier does not feed Formula B's band/total. So the email can still display a number.
- **Recommendation (NOT APPLIED)**: Pass `report.analysisConfidence` into `estimatePolicyForScore` and force `payableQuoteEnabled = false` (consultation-first) when confidence is `low`, matching `quote.ts:692` and the doc contract.
- **References**: `docs/shared-diagnostic-quote-line-items.md:34`; `lib/architecture-review/quote.ts:692-694,707-729`
- **Verification**: `estimate-snapshot.ts` has zero references to `analysisConfidence` except in the assumptions-text branch (`:210`). The function signature of `estimatePolicyForScore` (`:95-98`) takes only `overallScore` and `payableQuoteTotalUsd`.

### [ARCH-Q04] Admin OVERRIDE band is not validated for min ≤ max, and a max-only override returns the max
- **Severity**: Low
- **Category**: Correctness
- **Location**: `lib/architecture-review/estimate-snapshot.ts:67-93`; `lib/architecture-review/rule-catalog.ts:1183-1208,277-283`
- **Evidence**:
  ```ts
  if (typeof low === "number" && typeof high === "number") return midpointAmount(low, high);
  if (low !== null) return low;
  if (high !== null) return high;
  ```
  `parseAmount`/`normalizeOverrideAmount` reject negatives and non-integers but never check `min <= max`. An admin entering `overrideMinPriceUsd=5000, overrideMaxPriceUsd=500` yields `midpointAmount(5000,500) = roundTo25((5500)/2) = 2750` (silently averaging an inverted band). A max-only override (`min` blank) returns `high` (the larger), which is the less-conservative choice for a customer quote.
- **Impact**: An admin typo produces a plausible-but-wrong customer dollar amount with no rejection. Limited blast radius (requires admin action + OVERRIDE mode), hence Low.
- **Recommendation (NOT APPLIED)**: In `parseArchitectureRuleCatalogFormInput`/`normalizeOverrideAmount`, reject `min > max`; for partial bands, prefer the lower bound when only one is set, or require both when `pricingMode === "OVERRIDE"`.
- **References**: `app/admin/architecture-catalog/[ruleId]/page.tsx:285-289`
- **Verification**: No comparison between `overrideMinPriceUsd` and `overrideMaxPriceUsd` exists in `rule-catalog.ts` (searched `overrideMin`/`overrideMax` — only assignments/selects, no ordering check).

### [ARCH-Q05] Zombie `"webllm"` mode persists in types and confidence math after dependency removal (currently inert)
- **Severity**: Low
- **Category**: Correctness / Reliability
- **Location**: `lib/architecture-review/quote.ts:61,148-150`; `lib/architecture-review/types.ts:211`
- **Evidence**:
  ```ts
  // quote.ts:148
  if (context?.mode === "webllm" && (context.ocrCharacterCount ?? 0) >= 300) {
    confidence += 0.05;
  }
  ```
  `mode` is also a public type member (`quote.ts:61`) and a Zod enum value (`types.ts:211`). However, **no production code sets `mode: "webllm"`** — the only live constructor (`evaluator.ts:78`) hardcodes `mode: "rules-only"`, and the worker (`jobs.ts`) never sets a `mode` at all. The `@mlc-ai/web-llm` dependency is gone. So the `+0.05` branch is currently unreachable from production input.
- **Impact**: Today: none on output (dead branch). Risk: the path is still *type-reachable* and the metadata schema still **accepts** `mode: "webllm"` from a client (`types.ts:211`, `architectureReviewMetadataSchema`). If client metadata ever flowed into `quoteContext.mode` (it does not today — `jobs.ts` builds the context server-side), a client could nudge confidence up by 0.05 and potentially cross the 0.85 quote-floor or the medium/high band edge. The corresponding Formula A boost does not reach the email number (ARCH-Q02), limiting current severity to Low.
- **Recommendation (NOT APPLIED)**: Remove the `"webllm"` enum member from `types.ts:211` and `quote.ts:61`, and delete the dead `quote.ts:148-150` branch. This also closes the latent client-influence vector.
- **References**: `lib/architecture-review/evaluator.ts:78`
- **Verification**: `grep -rn "webllm" lib app components --include=*.ts --include=*.tsx | grep -v test` returns only the three declaration/branch sites above; no assignment of `mode: "webllm"` anywhere in production. `jobs.ts` quoteContext (via `evaluator.ts:75-83`) sets `mode: "rules-only"`.

### [ARCH-Q06] Confidence band label (`medium` ≥ 0.82) and quote floor (`< 0.85`) edges are off by 0.03
- **Severity**: Info
- **Category**: Correctness
- **Location**: `lib/architecture-review/quote.ts:165-173` vs `quote.ts:692-694`
- **Evidence**: `calculateAnalysisConfidence` returns `"medium"` for confidence in `[0.82, 0.95)`, but `calculateConsultationQuoteUSD` forces `$249` whenever `confidence < 0.85`. So a review labelled `medium` confidence with confidence in `[0.82, 0.85)` is simultaneously "medium" yet quote-suppressed to baseline. The tuple of thresholds (0.82 / 0.85 / 0.95) is not internally aligned.
- **Impact**: Confusing but not wrong: it only over-suppresses (errs toward diagnostic-first), which is the safe direction. No customer over-charge. Pure Formula A so does not reach the email number anyway.
- **Recommendation (NOT APPLIED)**: Align the floor threshold to the band boundary (`0.82`) or document the intentional 0.03 buffer.
- **References**: n/a
- **Verification**: Compare literal constants at `quote.ts:169` (`>= 0.82`) and `quote.ts:692` (`< 0.85`).

### [ARCH-Q07] Bare/unknown rule-id resolvers return `null` or echo the raw id silently (assessment of the flagged concern)
- **Severity**: Info (not a defect in the scoring/quote path)
- **Category**: Correctness
- **Location**: `lib/architecture-review/rules.ts:23-40`; `lib/architecture-review/pricing-catalog.ts:112-140`
- **Evidence**:
  ```ts
  // rules.ts:23
  function normalizeRuleId(ruleId: string) {
    if (architectureReviewRuleById.has(ruleId)) return ruleId;
    for (const namespace of RULE_NAMESPACE_ORDER) {
      const candidate = `${namespace}:${ruleId}`;
      if (architectureReviewRuleById.has(candidate)) return candidate;
    }
    return ruleId;                       // unknown bare id echoed back unchanged
  }
  export function getArchitectureReviewRule(ruleId: string) {
    return architectureReviewRuleById.get(normalizeRuleId(ruleId)) ?? null;   // → null for unknown
  }
  ```
  `pricing-catalog.ts:112-130` (`resolveArchitectureReviewPricingCatalogRuleId`) similarly returns `null` for an unknown id (only tries the `aws:` prefix as a fallback). The concern that "an unknown bare rule id resolves silently to null, dropping a rule from scoring/quote" is **real as a code shape but not exploitable in the scoring/quote path**, because:
  - Scores/quotes operate on **findings already produced by the deterministic engine** (`report.ts:202-203`, `quote.ts` consumes `finding.category`/`pointsDeducted`/`fixCostUSD`), not on a rule-id lookup. A null rule lookup does **not** drop a finding from `calculateOverallScore`/Formula A/Formula B.
  - In `estimate-snapshot.ts:147-150`, a `null` `codeEntry` falls back to `remediationHoursLow/High = 0.5` and a generic service label — the line item still appears and still contributes dollars (it does not vanish). So an unknown id degrades the *label/hours* gracefully rather than silently dropping money.
- **Impact**: No scoring/quote correctness bug. The only practical effect of a genuinely unknown finding id would be the `0.5h` fallback hours and a `Fix <ruleId>` label — visible, not silent-drop. Worth noting for the *other* arch agent's catalog-integrity scope (engine-emitted ids are all namespaced/known, per `engine.test.ts`).
- **Recommendation (NOT APPLIED)**: Optional: in dev/test, `console.warn` or assert when `getArchitectureReviewRule`/pricing resolver returns null for a finding id, to catch a future engine rename early.
- **References**: `lib/architecture-review/estimate-snapshot.ts:147-150`; `tests/architecture-review-engine.test.ts:82-90`
- **Verification**: Followed the finding → quote data flow; `pointsDeducted`/`category`/`fixCostUSD` are intrinsic to the finding object, independent of rule-id resolution. Confirmed `estimate-snapshot.ts` uses `?? 0.5` / `?? "Fix ${ruleId}"` fallbacks rather than dropping the item.

### [ARCH-Q08] Test suite asserts no upper bound and does not cross-check Formula A vs Formula B
- **Severity**: Info
- **Category**: Correctness (test gap)
- **Location**: `tests/architecture-review-quote.test.ts`; `tests/architecture-review-pricing-catalog.test.ts`; `tests/architecture-rule-catalog.test.ts`
- **Evidence**: `quote.test.ts` exercises Formula A floors (`:105` → 249, `:130` → 249, `:202` → 249) and the no-context cap (`:52` `quote).toBeLessThanOrEqual(1500)`), but there is **no test on `estimateSnapshot.totalUsd` upper bound** and **no test asserting Formula A and Formula B agree** (or are intentionally different). `architecture-rule-catalog.test.ts` checks override application and specific totals but not a ceiling. Consequently ARCH-Q01 and ARCH-Q02 would not be caught by `npm test`.
- **Impact**: Wrong/inflated customer money figures from Formula B are not guarded by any assertion.
- **Recommendation (NOT APPLIED)**: Add a snapshot test that a high-hour finding cluster (e.g. IaC 8–60h + backups 4–40h + compute 6–40h) at a 60–89 score yields a `totalUsd` within the documented `$650–$2,800` band, and a test pinning the relationship (or documented divergence) between `report.consultationQuoteUSD` and `estimateSnapshot.totalUsd`.
- **References**: `docs/architecture-review-pricing-matrix.md:23`
- **Verification**: Read all three test files; no `totalUsd` ceiling assertion and no Formula-A-vs-B comparison present.

---

## Things requiring runtime to fully confirm (read-only limits)

1. **Whether a real production score ever lands a high-hour cluster in the 60–89 band.** ARCH-Q01's worst case ($4,725) assumed two `consultation-only` findings that pushed the score to 90 (optional-polish). The truly dangerous case is several `remediation-estimate` high-hour rules co-occurring with score 60–89. Static reading shows it is *possible* (e.g. `infrastructure_as_code_indicated` 8–60h is `remediation-estimate`, `aws-launch-v1-catalog.ts:70`), but confirming a realistic submission that triggers it together would require running the deterministic engine. **Check needed**: feed `buildDeterministicReviewFindings` a prod-like AWS narrative, then `buildArchitectureEstimateSnapshot`, and read `snapshot.totalUsd` — must NOT execute side-effecting routes; a Vitest-only harness around the pure functions would suffice.
2. **DB-backed admin override behavior** (`fetchPublishedOverrides`, `rule-catalog.ts:525-590`) was read statically only; confirming inverted-band handling end-to-end (ARCH-Q04) needs a DB, which is out of read-only scope.

---

## Severity counts

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 2 |
| Low | 2 |
| Info | 3 |
| **Total** | **8** |
