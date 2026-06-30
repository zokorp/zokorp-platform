# 06 — Dependencies & Supply Chain Audit

- **Repository:** `zokorp-platform`
- **Audit commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345`
- **Audit date:** 2026-06-29
- **Mode:** READ-ONLY forensic audit. No installs, no lockfile/config writes, no dev server.
- **Inputs:** `npm ls --depth=0`, `npm outdated`, `npm audit` (text + JSON) precomputed in scratch; plus read-only `node_modules/<pkg>/package.json` inspection, `git grep`, and `git ls-files`.

`npm audit` summary line:
> **23 vulnerabilities (2 low, 15 moderate, 4 high, 2 critical)** across 999 resolved deps (prod 349 / dev 517 / optional 166 / peer 57).

---

## 1. npm audit — interpreted

The 23 advisories collapse into a much smaller number of *root* problems. Most "high/moderate" counts are transitive fan-out from a handful of packages. Reachability is assessed best-effort against this app's actual usage.

### Critical (2 advisories, 1 root cause — DEV ONLY)

| Pkg | Advisory | Range / Fixed | Direct? | Reachability |
|---|---|---|---|---|
| `vitest@4.0.18` | GHSA-5xrq-8626-4rwp — Vitest UI server arbitrary file read+exec (CVSS 9.8) | `>=4.0.0 <4.1.0`; fixed `4.1.0`+ (wanted `4.1.9`) | direct (dev) | **Not reachable in prod.** Only exploitable when the Vitest **UI** server is listening. This repo runs `vitest run` (one-shot, no UI) in CI/local. No prod surface. Test-time only, and only if a dev opens `--ui` on an untrusted network. |
| `@vitest/coverage-v8@4.0.18` | inherits the above via `vitest` | same | direct (dev) | same — transitive on the vitest pin |

Both fix cleanly by bumping vitest to `^4.1.9` (semver-minor, non-breaking). See **DEP-01**.

### High (4 advisories)

| Pkg | Advisory(es) | Range / Fixed | Direct? | Reachability |
|---|---|---|---|---|
| `nodemailer@8.0.5` | GHSA-p6gq-j5cr-w38f (high, CVSS 7.1 — `raw` option file-read/SSRF), GHSA-268h-hp4c-crq3 (CRLF in `List-*` headers), GHSA-wqvq-jvpq-h66f (jsonTransport bypass), GHSA-r7g4-qg5f-qqm2 (OAuth2 TLS validation) | `<=9.0.0` (all of 8.x affected); **fix only at `9.0.1`** | **direct** | **Reachable but vulnerable code paths NOT exercised.** Used in `lib/auth-email.ts:62` and `lib/architecture-review/sender.ts:183` via `createTransport(...).sendMail(...)`. Both call sites pass only `to/from/subject/text/html` — they never set `raw`, never use `jsonTransport`, never write `List-*` headers, and never use OAuth2 token fetch (plain SMTP user/pass + ZeptoMail/Resend REST). The 4 vulnerable vectors are all opt-in features this code does not use. Residual risk: `to` is user-controlled (signup email), but the relevant CRLF advisory targets `List-*` header *comments*, not the envelope `to`. See **DEP-02**. |
| `tmp@<0.2.6` | GHSA-ph9p-34f9-6g65 — path traversal via prefix/postfix (high) | `<0.2.6`; fix available | transitive | Build/test-tooling transitive (no direct app import of `tmp`). `fixAvailable: true` via dep bump. Low real-world reachability — exploit needs attacker-controlled prefix/postfix passed to `tmp`. See **DEP-05**. |
| `undici@7.x (<7.28.0)` | 7 advisories incl. GHSA-vmh5-mc38-953g (TLS bypass via SOCKS5), GHSA-vxpw-j846-p89q (WS DoS), GHSA-hm92-r4w5-c3mj (SOCKS5 cross-origin) | `7.0.0 - 7.27.2`; fix `7.28.0`+ | transitive | Pulled in transitively (Next.js / fetch polyfill chain). App does not configure a SOCKS5 ProxyAgent or undici WebSocket client, so the headline TLS/SOCKS vectors are not on this app's path. Set-Cookie / cache advisories have broader theoretical reach but `fixAvailable: true` by a non-breaking bump. See **DEP-05**. |
| `vite@7.0.0-7.3.3` | GHSA-fx2h-pf6j-xcff (`server.fs.deny` bypass, Windows), GHSA-v6wh-96g9-6wx3 (launch-editor NTLM, Windows) | fix available | transitive (dev) | **Windows-only + dev server only.** This repo deploys on Vercel (Linux). `vite` is a transitive dev dep (via vitest tooling), not used to serve the app. Effectively non-reachable. See **DEP-05**. |

### Moderate (15 advisories — dominated by 2 fan-out roots)

- **Sentry/OpenTelemetry/Next/postcss cluster (8 of the 15):** `@opentelemetry/core <2.8.0` (GHSA-8988-4f7v-96qf, unbounded baggage memory) fans out to `@opentelemetry/instrumentation-http`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@sentry/node`, `@sentry/nextjs`; plus `postcss <8.5.10` (GHSA-qx2v-qp2m-jg93, CSS-stringify XSS) under `next` fanning to `@vercel/speed-insights` and `next-auth`. npm's only "fix" for these is `npm audit fix --force` → **`@sentry/nextjs@6.3.5`, a massive downgrade/breaking change** — do NOT take it. The real remediation is forward bumps of `@sentry/nextjs` (10.53.1 → 10.62.0) and `next` (16.2.6 → 16.2.9), which the audit's resolver doesn't surface because it only knows the published-downgrade path. See **DEP-03** and **DEP-04**.
  - postcss XSS reachability: requires rendering attacker-controlled CSS through PostCSS stringify into an HTML `<style>` context. Next's bundled postcss runs at **build time** on first-party CSS, not on user input → not reachable.
  - OTel baggage DoS reachability: requires accepting untrusted W3C `baggage` propagation headers. Sentry tracing is server-side; low reachability.
- **`uuid <11.1.1` (GHSA-w5hq-g745-h8pq, moderate):** buffer-bounds bug in v3/v5/v6 *when a `buf` arg is provided*. Transitive under `exceljs` and `next-auth`. **No fix available** below a breaking exceljs downgrade. Neither consumer calls uuid with an external `buf`, so not reachable. See **DEP-06**.
- **`js-yaml 4.0.0-4.1.1` (GHSA-h67p-54hq-rp68):** quadratic-complexity DoS on YAML merge keys. Transitive (tooling/config parsing). `fixAvailable: true`. Low reachability — app does not parse untrusted YAML at runtime. See **DEP-05**.
- **`tar <=7.5.15` (GHSA-vmf3-w455-68vh):** PAX file-smuggling parser differential. Transitive (install/build tooling). `fixAvailable: true`. Not on a runtime untrusted-input path. See **DEP-05**.
- **`@next-auth/prisma-adapter` / `next-auth` / `next` / `@vercel/speed-insights` "moderate" rows:** these are *labels-only* — they have no own-CVE; they're flagged purely because they "depend on vulnerable versions of" the packages above (next→postcss, next-auth→nodemailer/uuid/next). Fixing the roots clears them.

### Low (2 advisories)

- `@babel/core <=7.29.0` (GHSA-4x5r-pxfx-6jf8, arbitrary file read via sourceMappingURL, CVSS 3.2) — transitive build tooling, `fixAvailable: true`.
- `esbuild 0.27.3-0.28.0` (GHSA-g7r4-m6w7-qqqr, Windows dev-server file read, CVSS 2.5) — transitive dev tooling, Windows + dev-server only. Non-reachable on Vercel/Linux.

---

## 2. Outdated / pinned-version sanity

From `npm outdated` + `package.json`. Pins are mostly tight caret ranges that are slightly behind the latest patch — healthy, not alarming. Notable items:

| Package | Current | Wanted | Latest | Read |
|---|---|---|---|---|
| `next` | 16.2.6 | 16.2.9 | 16.2.9 | Patch behind. Bumping to 16.2.9 clears the postcss-fanout audit rows. **Recommend.** |
| `@sentry/nextjs` | 10.53.1 | 10.62.0 | 10.62.0 | Minor behind; 10.62.0 carries the OTel-core fix. **Recommend** (clears 8 audit rows). |
| `react` / `react-dom` | 19.2.3 (exact pin, no caret) | 19.2.3 | 19.2.7 | Exact-pinned (`"react": "19.2.3"`, package.json:52-53) — deliberate, fine. 19.2.7 is patch-only. Low priority. |
| `prisma` / `@prisma/client` | 6.19.3 | 6.19.3 | 7.8.0 | One full major behind (6 → 7). Pinned at current latest 6.x; v7 is a deliberate upgrade project, not a hygiene gap. Info only. |
| `stripe` | 20.4.0 | 20.4.1 | 22.3.0 | Two majors behind latest (20 → 22). Stripe SDK majors track API-version pins; staying on 20.x is a valid, conservative choice as long as the pinned Stripe API version is supported. Verify API-version support window. Info. |
| `next-auth` | 4.24.14 | — | (5.x "Auth.js" is a rewrite) | On the maintained v4 line. v5 is a separate migration. The audit "moderate" on next-auth is label-only (see §1). Info. |
| `zod` | 4.3.6 | 4.4.3 | 4.4.3 | Minor behind, no advisory. Low. |
| `nodemailer` | 8.0.5 | 8.0.11 | 9.0.1 | **The only safe-from-CVE version is `9.0.1`** (all 8.x are in `<=9.0.0` vulnerable range; `8.0.11` is NOT a fix). See **DEP-02**. The `overrides` pin currently *blocks* reaching 9.x. |
| `pdf-parse` | 1.1.1 | 1.1.4 | 2.4.5 | **1.1.1 is the oldest possible 1.x.** Unmaintained 1.x line; 2.x is a rewrite. No published npm advisory (does NOT appear in `npm audit`), but it parses **untrusted user PDFs** at `app/api/submit-architecture-review/route.ts:206` and `lib/validator.ts:74`. See **DEP-07**. |
| `pdfjs-dist` | 5.6.205 | 5.7.284 | 6.1.200 | Patch behind on 5.x; major 6 available. Parses untrusted PDFs at `lib/architecture-review/client.ts:202`. No advisory in audit, but historically PDF.js has had high-severity parser CVEs — keeping current matters. See **DEP-07**. |
| `tesseract.js` | 7.0.0 | 7.0.0 | 7.0.0 | Current. No advisory. OK. |
| `exceljs` | 4.4.0 | 4.4.0 | 4.4.0 | Current latest; only "vulnerable" via transitive `uuid` (see DEP-06). OK. |
| `jszip` | 3.10.1 | 3.10.1 | 3.10.1 | Current. License note in §5. |
| dev tooling (`@playwright/test`, `eslint`, `jsdom`, `@axe-core/playwright`, `vitest`, `@vitest/coverage-v8`) | various | minor-behind | — | Routine dev-tool drift. The only security-material one is vitest (DEP-01). |

---

## 3. `overrides` correctness

`package.json:79-81`:
```json
"overrides": { "nodemailer": "^8.0.5" }
```

**Coherent and intentional, but it is the thing pinning a vulnerable major.**

- `next-auth@4.24.14` declares `nodemailer ^7.0.7` as a peer, and crucially as **optional** (`peerDependenciesMeta.nodemailer.optional = true`, confirmed in lockfile line ~10462). So the override forcing 8.x over the 7.x peer does **not** create an install conflict — npm resolves a single `nodemailer@8.0.5` (lockfile line 10628, integrity-pinned, registry-resolved).
- The override is therefore *technically valid* — `npm ls --depth=0` reports a consistent tree.
- **However:** every 8.x release is inside the vulnerable range `<=9.0.0`. The override caps nodemailer at `^8` and thereby **prevents** the only fixed line (`9.0.1`). Whether this is "masking a vuln" depends on intent: it pins a clean, single-copy version (good for dedupe) but at a version with 4 open advisories. To remediate, the override must move to `^9.0.1` (and the app's `nodemailer` direct dep with it). See **DEP-02**.
- No other overrides exist. The lockfile root does not record a separate resolved `overrides` block (normal for npm v7+ lockfileVersion 3).

---

## 4. `@mlc-ai/web-llm` zombie reference (supply-chain / hygiene)

**Confirmed: the dependency is gone, but the concept lingers as dead code/config.**

- `@mlc-ai/web-llm` is **NOT** in `package.json` (verified — not in dependencies or devDependencies) and **NOT** in `package-lock.json` (`grep` for `mlc-ai`/`web-llm`/`webllm` in the lockfile returns 0 hits). So there is no installed package and no supply-chain attack surface from it today.
- A `"webllm"` **mode string** survives in source (git-tracked):
  - `lib/architecture-review/quote.ts:61` — `mode?: "rules-only" | "webllm";`
  - `lib/architecture-review/quote.ts:148` — `if (context?.mode === "webllm" && ...)`
  - `lib/architecture-review/types.ts:211` — `mode: z.enum(["rules-only", "webllm"]).optional(),`
  - `tests/architecture-review-quote.test.ts:124` — `mode: "webllm",`
- The repo's own backlog already tracks it: `docs/platform-improvement-backlog.md:103` — *"Remove the unused `@mlc-ai/web-llm` dependency if a real local refinement step is not being shipped."* (Note: that backlog line is itself slightly stale — the **dependency** is already removed; only the **mode wiring** remains.)
- Net: this is **Info-level code hygiene**, not an active supply-chain vuln. The risk is that the `webllm` branch is documented/typed/tested behavior with no backing implementation — a future contributor could re-add the dep to "make it work," reintroducing a large WASM/LLM supply-chain surface. See **DEP-08**.

---

## 5. License posture (best-effort, read from `node_modules/<pkg>/package.json`)

For a proprietary (closed-source) SaaS, the concern is strong/network copyleft (GPL/AGPL/SSPL) that could impose source-disclosure obligations on linked code.

**Direct deps — all permissive:** MIT / MIT-0 / ISC / Apache-2.0 across the board (next, react, react-dom, stripe, prisma, @prisma/client, @sentry/nextjs, nodemailer (MIT-0), next-auth (ISC), pdf-parse (MIT), pdfjs-dist (Apache-2.0), tesseract.js (Apache-2.0), exceljs (MIT), zod (MIT), etc.). No issue.

**Copyleft found (none are strong/network copyleft in the shipped app):**

| Package | License | Direct? | Assessment |
|---|---|---|---|
| `jszip` | `(MIT OR GPL-3.0-or-later)` | **direct** | Dual-licensed — you may **elect MIT**, so no GPL obligation. OK. |
| `@axe-core/playwright`, `axe-core` | MPL-2.0 | dev/test only | MPL is **file-level** weak copyleft; obligations attach only to modified MPL files. These are accessibility test deps, never linked into the shipped product. OK. |
| `lightningcss`, `lightningcss-darwin-arm64` | MPL-2.0 | transitive (build-time, via Tailwind 4 toolchain) | Build-time CSS transformer; MPL file-level copyleft does not infect first-party source. OK. |
| `@img/sharp-libvips-darwin-arm64` | LGPL-3.0-or-later | transitive (native binary under `sharp`) | LGPL permits use via **dynamic linking** without source-disclosure of the consuming app. It's a prebuilt platform binary loaded at runtime, not statically incorporated. Low concern; standard for the sharp ecosystem. |

**No AGPL, no SSPL, no GPL-only (non-dual), no CC-BY-SA / OSL / EUPL** detected. **License posture is acceptable for a proprietary SaaS.** See **DEP-09** (Info).

> Caveat: this is a best-effort scan of declared `license` fields in installed `package.json` files, not a full SPDX/license-text audit of all 999 deps. A dedicated tool (`license-checker`, `oss-review-toolkit`) would be needed for legal sign-off.

---

## 6. Lockfile integrity

- **Committed & tracked:** `package-lock.json` exists (500 KB) and is git-tracked (`git ls-files package-lock.json` → tracked). Good.
- **Format:** `lockfileVersion: 3` (npm v7+). Modern, integrity-hash-bearing.
- **In sync with package.json:** the lockfile root `packages[""]` dependency/devDependency block matches `package.json` exactly (same ranges, same `overrides`-driven nodemailer pin). `npm ls --depth=0` resolves a consistent tree with no `invalid`/`extraneous`/`missing` markers. No drift detected.
- **No non-registry sources:** every `"resolved"` URL in the lockfile points at `https://registry.npmjs.org`. **Zero** `git+`/`git:`/`github:`/`file:`/`link:`/`ssh://` dependencies. No tarball-from-URL, no local path deps. This is a clean registry-only supply chain — good integrity posture and minimizes the unaudited-source attack surface.
- **Integrity hashes present** (spot-checked: `nodemailer@8.0.5` carries a `sha512-…` integrity). 

No lockfile integrity findings beyond Info. See **DEP-10**.

---

## Findings

### [DEP-01] Vitest pre-4.1 critical UI file-read/exec (dev-only, fix is a free minor bump)
- **Severity:** Medium (rubric: critical CVSS but reachability gated to dev `--ui` mode → not exploitable in this app's prod/CI usage)
- **Category:** Supply chain
- **Location:** `package.json:69` (`@vitest/coverage-v8: ^4.0.18`), `package.json:77` (`vitest: ^4.0.18`); advisory GHSA-5xrq-8626-4rwp
- **Evidence:** `vitest@4.0.18`, `@vitest/coverage-v8@4.0.18` (npm ls); audit JSON marks both `critical`, range `>=4.0.0 <4.1.0`, CVSS 9.8
- **Impact:** Arbitrary file read + execution **only while the Vitest UI server is listening**. This repo runs `vitest run` (one-shot, no UI) in `npm test` — no listening server, no prod surface. Real exposure: a developer running `vitest --ui` on a shared/untrusted network.
- **Recommendation:** Bump to `vitest@^4.1.9` and `@vitest/coverage-v8@^4.1.9` (semver-minor, `fixAvailable: true`, non-breaking). Clears both critical rows.
- **References:** https://github.com/advisories/GHSA-5xrq-8626-4rwp
- **Verification:** `npm ls vitest @vitest/coverage-v8`; confirm `npm test` script is `vitest run` (no `--ui`) — `package.json:13`.

### [DEP-02] nodemailer 8.x has 4 open advisories incl. high file-read/SSRF; override blocks the only fix
- **Severity:** High (direct dep, reachable module — see reachability for why exploit vectors are currently not exercised)
- **Category:** Supply chain
- **Location:** `package.json:48` (`nodemailer: ^8.0.5`), `package.json:80` (`overrides.nodemailer: ^8.0.5`); advisories GHSA-p6gq-j5cr-w38f (high), GHSA-268h-hp4c-crq3, GHSA-wqvq-jvpq-h66f, GHSA-r7g4-qg5f-qqm2
- **Evidence:** `nodemailer@8.0.5` (npm ls; lockfile:10628). Audit range `<=9.0.0`, **no fix below `9.0.1`**.
- **Impact:** Four vectors: `raw`-option arbitrary file-read/SSRF (CVSS 7.1), `List-*` CRLF header injection, jsonTransport disableFileAccess bypass, OAuth2 TLS-validation gap. **Reachability:** nodemailer is used at `lib/auth-email.ts:62` and `lib/architecture-review/sender.ts:183`, but both call `sendMail` with only `to/from/subject/text/html` — they never set `raw`, never use `jsonTransport`/OAuth2, never write `List-*` headers. The vulnerable features are opt-in and not exercised, so practical exploitability today is low. Risk is latent: any future use of those options (or `raw`) would be immediately exploitable, and `to` is user-supplied.
- **Recommendation:** Move both the direct dep and the `overrides` entry to `nodemailer@^9.0.1` (the override currently *prevents* reaching the fixed line). Re-run tests — `lib/architecture-review-sender.test.ts` and `auth-email` flows. The optional `nodemailer ^7.0.7` peer on next-auth is `optional: true`, so a 9.x bump will not create a peer conflict.
- **References:** https://github.com/advisories/GHSA-p6gq-j5cr-w38f , https://github.com/advisories/GHSA-268h-hp4c-crq3 , https://github.com/advisories/GHSA-wqvq-jvpq-h66f , https://github.com/advisories/GHSA-r7g4-qg5f-qqm2
- **Verification:** `npm view nodemailer version` (→ 9.0.1 latest); confirm next-auth peer optionality: `node -e "console.log(require('next-auth/package.json').peerDependenciesMeta.nodemailer)"` → `{optional:true}`.

### [DEP-03] @sentry/nextjs / OpenTelemetry-core baggage DoS fanout (8 audit rows, forward-fixable)
- **Severity:** Low (moderate CVSS, low reachability, clean forward fix)
- **Category:** Supply chain
- **Location:** `package.json:41` (`@sentry/nextjs: ^10.48.0`, resolved 10.53.1); advisory GHSA-8988-4f7v-96qf on `@opentelemetry/core <2.8.0`
- **Evidence:** `@sentry/nextjs@10.53.1` (npm ls). Audit fans `@opentelemetry/core` → instrumentation-http → @sentry/node → @sentry/nextjs (+resources, +sdk-trace-base).
- **Impact:** Unbounded memory allocation parsing untrusted W3C `baggage` propagation headers (DoS). Server-side tracing; app does not accept untrusted baggage on a hot path → low reachability.
- **Recommendation:** Bump `@sentry/nextjs` to `^10.62.0` (npm outdated "latest"). **Do NOT** run `npm audit fix --force` — its only listed fix is the catastrophic downgrade to `@sentry/nextjs@6.3.5`.
- **References:** https://github.com/advisories/GHSA-8988-4f7v-96qf
- **Verification:** `npm view @sentry/nextjs version`; after bump, re-run `npm audit` and confirm the 5 OTel/Sentry rows clear.

### [DEP-04] Next.js bundled postcss XSS + version drift (label fanout to next-auth / speed-insights)
- **Severity:** Low (build-time-only reachability, patch bump available)
- **Category:** Supply chain
- **Location:** `package.json:46` (`next: ^16.2.6`); advisory GHSA-qx2v-qp2m-jg93 on `postcss <8.5.10` (`node_modules/next/node_modules/postcss`)
- **Evidence:** `next@16.2.6`; latest 16.2.9 (npm outdated). postcss XSS via unescaped `</style>` in stringify output.
- **Impact:** XSS requires attacker-controlled CSS run through PostCSS stringify into an HTML `<style>` context. Next runs bundled postcss at **build time** on first-party CSS, not user input → not reachable at runtime. The `next-auth` and `@vercel/speed-insights` "moderate" audit rows are label-only (they merely depend on this `next`).
- **Recommendation:** Bump `next` to `^16.2.9` (and `eslint-config-next` to match, 16.2.9). Clears the postcss row and its dependent labels.
- **References:** https://github.com/advisories/GHSA-qx2v-qp2m-jg93
- **Verification:** `npm view next version`; re-run `npm audit`.

### [DEP-05] Transitive build/runtime libs with available fixes (tmp, undici, vite, js-yaml, tar, @babel/core, esbuild)
- **Severity:** Low (mostly dev/build tooling and/or Windows-only/feature-gated; all `fixAvailable: true`)
- **Category:** Supply chain
- **Location:** transitive (no entries in `package.json`); advisories GHSA-ph9p-34f9-6g65 (`tmp`, high), GHSA-vmh5-mc38-953g + 6 more (`undici`, high), GHSA-fx2h-pf6j-xcff (`vite`, high, Windows), GHSA-h67p-54hq-rp68 (`js-yaml`), GHSA-vmf3-w455-68vh (`tar`), GHSA-4x5r-pxfx-6jf8 (`@babel/core`, low), GHSA-g7r4-m6w7-qqqr (`esbuild`, low, Windows)
- **Evidence:** all present in audit JSON with `fixAvailable: true` (except where noted) and resolved under transitive paths.
- **Impact:** `vite`/`esbuild` advisories are **Windows + dev-server only** — non-reachable on Vercel/Linux. `tmp`/`tar`/`js-yaml` are build/install tooling not on a runtime untrusted-input path. `undici` headline TLS/SOCKS5 vectors require a SOCKS5 ProxyAgent / undici WebSocket client this app doesn't configure; Set-Cookie/cache advisories have broader theoretical reach.
- **Recommendation:** Run `npm audit fix` (NON-force) in a branch to pull these transitive fixes, then re-verify `npm ls`/build/tests. None require `--force`.
- **References:** https://github.com/advisories/GHSA-ph9p-34f9-6g65 , https://github.com/advisories/GHSA-vmh5-mc38-953g , https://github.com/advisories/GHSA-fx2h-pf6j-xcff
- **Verification:** `npm audit` re-run after a non-force fix on a throwaway branch (out of scope for this read-only audit).

### [DEP-06] uuid <11.1.1 buffer-bounds (transitive via exceljs/next-auth) — no fix without breaking downgrade
- **Severity:** Low (not reachable — vulnerable path needs caller-supplied `buf`)
- **Category:** Supply chain
- **Location:** transitive under `exceljs` (`package.json:44`) and `next-auth` (`package.json:47`); advisory GHSA-w5hq-g745-h8pq
- **Evidence:** `uuid <11.1.1`, audit `fixAvailable: false` (only fix is `exceljs@3.4.0`, a breaking downgrade).
- **Impact:** Out-of-bounds write in `uuid` v3/v5/v6 **only when a `buf` argument is passed**. exceljs and next-auth call uuid without an external `buf`, so not reachable.
- **Recommendation:** Accept/track. Optionally pin `uuid` to `^11.1.1` via `overrides` if exceljs/next-auth tolerate it (verify compatibility before adding). Do not downgrade exceljs.
- **References:** https://github.com/advisories/GHSA-w5hq-g745-h8pq
- **Verification:** `npm ls uuid` to enumerate the two transitive paths; check exceljs/next-auth source don't pass `buf` to uuid.

### [DEP-07] PDF parsers handle untrusted uploads on stale lines (pdf-parse 1.1.1, pdfjs-dist 5.6.205) — no CVE, but parser risk
- **Severity:** Medium (untrusted-input parsers; no *published* advisory but oldest-pin / known-fragile)
- **Category:** Supply chain
- **Location:** `package.json:49` (`pdf-parse: ^1.1.1`), `package.json:50` (`pdfjs-dist: ^5.6.205`)
- **Evidence:** Installed `pdf-parse@1.1.1` (license MIT; deps `debug`, `node-ensure`), `pdfjs-dist@5.6.205`. **Neither appears in `npm audit`** (0 matches in audit JSON) — no current GHSA. Reachability is HIGH: `app/api/submit-architecture-review/route.ts:206-207` does `import("pdf-parse")` then parses a user-uploaded `Buffer`; `lib/validator.ts:74` parses `input.buffer` via `pdf-parse/lib/pdf-parse.js`; `lib/architecture-review/client.ts:202-203` runs `pdfjs.getDocument({data: pdfBytes})` on untrusted PDFs.
- **Impact:** Both libraries parse attacker-controlled files. `pdf-parse@1.1.1` is the **oldest 1.x release** of an effectively unmaintained line (the `node-ensure` shim and the historical "default test-file read" footgun are well known); `pdfjs-dist` 5.x has a long history of memory-safety parser CVEs in older builds. No advisory applies *today* (cannot confirm a CVE — stated honestly), but running the oldest pins on an untrusted-input boundary is a latent risk.
- **Recommendation:** (a) Patch-bump `pdfjs-dist` to `^5.7.284` (npm outdated "wanted") to stay current on parser fixes; evaluate major 6.x separately. (b) For `pdf-parse`, evaluate moving off the unmaintained 1.x — `pdf-parse@2.x` is a rewrite (validate API), or replace with pdfjs-based extraction already in the repo. At minimum confirm uploads are size/type-bounded and parsed off the request hot path.
- **References:** (no current GHSA for either — npm audit clean as of 2026-06-29); pdf-parse npm: https://www.npmjs.com/package/pdf-parse ; pdfjs-dist: https://www.npmjs.com/package/pdfjs-dist
- **Verification:** `npm view pdf-parse versions`, `npm view pdfjs-dist version`; re-run `npm audit` periodically to catch a newly-published advisory; confirm upload size/MIME guards at the two parse call sites.

### [DEP-08] `webllm` zombie mode references a removed dependency (`@mlc-ai/web-llm`)
- **Severity:** Info
- **Category:** Supply chain / code hygiene
- **Location:** `lib/architecture-review/quote.ts:61` & `:148`, `lib/architecture-review/types.ts:211`, `tests/architecture-review-quote.test.ts:124`; backlog note `docs/platform-improvement-backlog.md:103`
- **Evidence:** `@mlc-ai/web-llm` is absent from `package.json` AND `package-lock.json` (0 grep hits for `mlc-ai`/`web-llm`/`webllm` in the lockfile). The `"webllm"` mode string remains typed (`z.enum(["rules-only","webllm"])`), branched (`if (context?.mode === "webllm" ...)`), and tested.
- **Impact:** No active supply-chain surface (the package is not installed). Risk is latent/hygiene: documented+typed+tested behavior with no backing implementation invites a future contributor to re-add the heavy WASM/LLM dependency to "complete" the feature, reintroducing a large supply-chain surface. The backlog item itself is stale — it says "remove the dependency," but the dependency is already gone; only the mode wiring remains.
- **Recommendation:** Either (a) delete the dead `webllm` mode (enum value, branch, type, test) since no local-LLM step ships, or (b) explicitly document it as a reserved no-op. Update `docs/platform-improvement-backlog.md:103` to reflect that the dep is already removed.
- **References:** internal — `docs/platform-improvement-backlog.md:103`
- **Verification:** `git grep -i "webllm\|web-llm\|mlc-ai" -- ':!package-lock.json' ':!.claude/worktrees'` (only the 5 source/test/doc lines above); `grep mlc-ai package-lock.json` → no match.

### [DEP-09] License posture acceptable for proprietary SaaS; copyleft is dual/weak only
- **Severity:** Info
- **Category:** Supply chain (legal)
- **Location:** `package.json` direct deps; transitive copyleft enumerated below
- **Evidence (read from installed `package.json` license fields):** Direct deps all permissive (MIT/MIT-0/ISC/Apache-2.0). Copyleft present: `jszip` `(MIT OR GPL-3.0-or-later)` (direct, elect MIT); `axe-core` + `@axe-core/playwright` MPL-2.0 (dev/test); `lightningcss` + `lightningcss-darwin-arm64` MPL-2.0 (build-time); `@img/sharp-libvips-darwin-arm64` LGPL-3.0-or-later (transitive native binary, dynamic-link). **No AGPL/SSPL/GPL-only/CC-BY-SA/OSL/EUPL found.**
- **Impact:** No source-disclosure obligation triggered. jszip dual-license lets you elect MIT; MPL is file-level (build/test only); LGPL native binary is dynamically loaded.
- **Recommendation:** Document the MIT election for jszip in any license/NOTICE file. For legal sign-off, run a dedicated SPDX tool (`license-checker --production`, OSS Review Toolkit) over the full 999-dep tree — this audit only scanned declared `license` fields, not license texts.
- **References:** internal; SPDX identifiers per `node_modules/<pkg>/package.json`
- **Verification:** `npx license-checker --summary` (out of scope here — would touch node_modules read-only but is a tool invocation; run during a non-audit pass).

### [DEP-10] Lockfile committed, registry-only, in sync
- **Severity:** Info (positive finding)
- **Category:** Supply chain
- **Location:** `package-lock.json` (lockfileVersion 3, git-tracked)
- **Evidence:** `git ls-files package-lock.json` → tracked; root `packages[""]` deps match `package.json`; `npm ls --depth=0` consistent (no invalid/extraneous); every `"resolved"` points to `registry.npmjs.org`; **zero** git/file/link/ssh deps; integrity sha512 hashes present.
- **Impact:** Clean, reproducible, registry-only supply chain. No unaudited git-URL or local-path source surface.
- **Recommendation:** Maintain. Keep using `npm ci` in CI for lockfile-faithful installs. (No action required.)
- **References:** internal
- **Verification:** `grep -E '"resolved": "(git|file|link|ssh|https://github)' package-lock.json` → no matches; `git ls-files package-lock.json` → tracked.

---

## Severity counts (this report's DEP findings)

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 1 | DEP-02 |
| Medium | 2 | DEP-01, DEP-07 |
| Low | 3 | DEP-03, DEP-04, DEP-05 (also DEP-06) |
| Info | 4 | DEP-08, DEP-09, DEP-10 (plus DEP-06 borderline) |

> Note: report finding-severities are re-rated for *this app's reachability* and therefore differ from raw `npm audit` CVSS labels (e.g., vitest is CVSS-critical but dev-`--ui`-only → Medium here; the 8 Sentry/OTel "moderate" audit rows collapse to one Low forward-fix finding).

## Items not fully verifiable under read-only constraints

1. **Post-fix audit delta** — cannot run `npm audit fix` / `npm audit fix --force` (would modify node_modules/lockfile). Exact residual count after the recommended forward bumps is unverified. Check: on a throwaway branch run `npm audit fix` (non-force) + manual bumps of vitest@^4.1.9, @sentry/nextjs@^10.62.0, next@^16.2.9, nodemailer@^9.0.1, then `npm audit`.
2. **nodemailer 9.x compatibility** — DEP-02 recommends `^9.0.1`; could not install/test the bump. Check: `npm i nodemailer@^9.0.1` in a branch, run `tests/architecture-review-sender.test.ts` + auth-email flows + `npm run build`.
3. **Full SPDX license audit** — only declared `license` fields were read, not license texts across all 999 deps. Check: `npx license-checker --production --summary` (and `--onlyAllow` allowlist) for legal sign-off.
4. **pdf-parse / pdfjs CVE status is point-in-time** — confirmed clean in `npm audit` as of 2026-06-29; a future advisory would not appear retroactively. Check: re-run `npm audit` on a schedule; subscribe to GHSA for both packages.
5. **uuid override feasibility (DEP-06)** — whether `overrides.uuid: ^11.1.1` is compatible with exceljs/next-auth was not install-tested. Check: add override on a branch, `npm ci`, run tests.
