# 10 — Corporate-Domain Gating: What Exists, Gaps, and Hardening Spec

**Audit commit:** `235bfca565b16ce59e388bd9dcedf94f8fc1f345` · **Date:** 2026-06-29 · **Mode:** read-only

## TL;DR — the prior assumption was wrong

The audit brief's CORRECTION 2 stated that the free-tool gate enforces only *inbox-ownership
verification* and that "no free-provider blocklist, MX lookup, or disposable-domain check has
been confirmed in source… if true corporate-only gating is intended, that logic likely does
not exist yet."

**That is incorrect. Denylist-based corporate-domain gating IS implemented.** The gate combines
**three** checks, all server-side:

1. **Authenticated, verified user** — `requireUser()` + `user.emailVerified`
   ([`lib/free-tool-access.ts:36-54`](../../lib/free-tool-access.ts)).
2. **Business-domain denylist** — `isBusinessEmail(accountEmail)` rejects known consumer and
   disposable mailbox hosts ([`lib/security.ts:136-143`](../../lib/security.ts)).
3. **No user-supplied recipient** — results go only to the signed-in account's email; a
   `submittedEmail` that differs is rejected ([`lib/free-tool-access.ts:56-62`](../../lib/free-tool-access.ts)).

So the enforced policy is actually: *"a verified, non-consumer, non-disposable inbox that you
own, and we only mail that inbox."* The gap is not "no domain gating" — it is that the gating is
a **static denylist with no DNS/MX validation and no automated maintenance**.

## What exists (evidence)

### The gate (`lib/free-tool-access.ts:29-68`)
```ts
const accountEmail = normalizeEmail(user.email);
if (!accountEmail || !user.emailVerified || !isBusinessEmail(accountEmail)) {
  throw new FreeToolAccessError(
    `Sign in with your verified business email to run ${input.toolName}.`, 401);
}
const submittedEmail = normalizeEmail(input.submittedEmail);
if (submittedEmail && submittedEmail !== accountEmail) {
  throw new FreeToolAccessError(
    `Results are sent only to the verified business email on your signed-in account (${accountEmail}).`, 400);
}
```

### The domain check (`lib/security.ts:7-143`)
- `CONSUMER_EMAIL_DOMAINS` — ~45 entries (`security.ts:7-50`): gmail/googlemail, yahoo (+co.uk/co.jp),
  ymail, rocketmail, outlook, hotmail (+co.uk), live, msn, aol, icloud/me/mac, proton.me/protonmail/pm.me,
  tutanota/tutamail/tuta.io, gmx.*, yandex.*, mail.ru, mail.com, **zoho.com**, fastmail.*, hushmail,
  inbox.com, qq, 163, 126, sina, naver, daum, hanmail, rediffmail.
- `DISPOSABLE_EMAIL_DOMAINS` — ~45 entries (`security.ts:53-96`): mailinator, guerrillamail.*,
  sharklasers, yopmail, tempmail/temp-mail.*, throwaway*, maildrop, 10minutemail.*, trashmail.*,
  getnada/nada.email, mohmal, emailondeck, mintemail, spambox, discard.email, dispostable, fakeinbox,
  mytemp.email, mailnesia, spam4.me, dropmail, mailcatch, mvrht, 33mail, moakt, wegwerfmail, anonbox,
  incognitomail, burnermail, fakemail.
- `isBusinessEmail()` = `!FREE_EMAIL_DOMAINS.has(getEmailDomain(email))` where `getEmailDomain`
  lowercases, splits on `@`, and requires exactly two parts (`security.ts:127-143`).

### Strengths
- Server-side, applied at the single choke point every free tool calls.
- Verification step backstops non-existent domains: a fabricated domain cannot receive the
  verification email, so it cannot reach a verified state — even though `isBusinessEmail` itself
  does no DNS lookup.
- Disposable coverage includes the highest-traffic throwaway services.
- Denylist is code-owned with an explicit "edit this list" comment — no admin-UI tampering surface.

## Gaps / weaknesses

### GATE-01 — Denylist is inherently incomplete (consumer + disposable bypass) — Severity: Medium
- **Location:** `lib/security.ts:7-101`
- **Evidence:** Static lists of ~45 + ~45 domains. There are *thousands* of disposable-email
  domains (public maintained lists carry 30k–100k+), and many legitimate consumer/ISP mailbox
  hosts are absent (e.g. `comcast.net`, `verizon.net`, `btinternet.com`, `web.de`, `seznam.cz`,
  `t-online.de`, country-specific Yahoo/Outlook variants, `*.onmicrosoft.com`).
- **Impact:** A user wanting free output on a personal address simply uses any consumer/ISP host
  not on the list, or a disposable domain not on the list, verifies it, and passes the gate. The
  "business email" guarantee is best-effort, not reliable. Abuse/lead-quality control is weaker
  than the copy ("Personal email domains are not allowed") implies.
- **Recommendation:** See spec below — replace the hand-maintained disposable list with an
  automatically-updated upstream source, and decide whether consumer gating is a hard gate or a
  soft lead-quality signal.
- **Verification:** Confirmed in code.

### GATE-02 — No MX / deliverability validation at submission time — Severity: Low
- **Location:** `lib/security.ts:127-143` (no DNS), gate relies on prior email verification.
- **Evidence:** `getEmailDomain` does string parsing only; there is no MX/A lookup anywhere in the
  gate path. (This is acceptable *because* email verification is required first — noting it so the
  design assumption is explicit, not as a standalone hole.)
- **Impact:** Low. A custom vanity domain that is really a personal domain (has valid MX, not on
  the denylist) passes as "business." MX validation would not catch this anyway — only a
  reputation/allowlist approach would.
- **Recommendation:** If stricter assurance is ever required, MX presence is a weak signal; prefer
  an allowlist or a domain-reputation provider (spec below). Otherwise accept as-is and soften the
  user-facing copy.
- **Verification:** Confirmed in code (absence of DNS calls).

### GATE-03 — Subdomain and alias edge cases — Severity: Low
- **Location:** `lib/security.ts:127-143`
- **Evidence:** `getEmailDomain` returns the *full* host after `@`; the set check is exact-match.
  `user@mail.gmail.com` (host `mail.gmail.com`) would NOT match the `gmail.com` entry. Gmail/Yahoo
  don't issue user subdomains, so real-world impact is negligible, but the matcher is exact-host,
  not registrable-domain (eTLD+1) aware.
- **Impact:** Negligible today; could matter if a future provider issues per-user subdomains.
- **Recommendation:** Match against the registrable domain (eTLD+1) using a public-suffix list if
  this ever matters. Low priority.
- **Verification:** Confirmed in code.

### GATE-04 — `zoho.com` is denylisted while Zoho is the transactional email provider — Severity: Info
- **Location:** `lib/security.ts:37`
- **Evidence:** `zoho.com` is in the consumer list. The platform recently adopted ZeptoMail (Zoho)
  as the transactional sender (recent commit `a141c68`). No functional conflict (sender ≠ user
  inbox), but worth a deliberate confirmation that blocking `zoho.com` *user* signups is intended.
- **Impact:** None functional; product decision only.
- **Verification:** Confirmed in code; intent needs product confirmation (manual).

## Hardening spec (if stricter corporate-only gating is the intent)

The current design is a reasonable v1. Pick a target based on what "business email" is *for*:

### Option A — Keep denylist, automate it (recommended, low cost)
- Replace the hand-maintained `DISPOSABLE_EMAIL_DOMAINS` array with a build-time-vendored copy of a
  maintained upstream list (e.g. the widely-used `disposable-email-domains` dataset), refreshed by a
  scheduled GitHub Actions job that opens a PR when the list changes. Keep a small local
  *additions/overrides* file for domains seen in abuse logs.
- Expand `CONSUMER_EMAIL_DOMAINS` with the obvious missing ISP/regional hosts, OR demote consumer
  gating to a *soft* signal (allow but tag the lead as "consumer-domain") if the goal is lead
  quality rather than hard exclusion.
- Effort: **S–M**. Keeps the synchronous, no-network, deterministic property of the current gate.

### Option B — Add domain-reputation / disposable detection at verification time
- At the email-verification step (not the hot tool path), call a disposable/role-account detection
  API (or a self-hosted MX+reputation check) once and persist a `domainClass` on the user
  (`business | consumer | disposable | unknown`). The gate then reads the stored class.
- Pros: catches unlisted disposables; amortized to once-per-user. Cons: adds an external dependency
  and a new outbound-fetch surface (must be allowlisted — see SSRF findings).
- Effort: **M**.

### Option C — Allowlist for high-assurance contexts
- If certain tools must be truly corporate-only (e.g. anything healthcare-adjacent), maintain an
  *allowlist* of approved domains per tool, defaulting to deny. Strongest guarantee, highest ops
  burden. Reserve for specific gated tools, not the whole free-tool surface.
- Effort: **L** (plus ongoing curation).

### Cross-cutting recommendations regardless of option
- **Normalize for abuse dedup** at verification: collapse Gmail dots and `+tags` so one mailbox
  can't register N "distinct" verified accounts to multiply free runs. (This is dedup, not gating —
  pairs with the rate-limit findings in `05-reliability-cost-abuse.md`.)
- **Match on registrable domain (eTLD+1)** to close GATE-03.
- **Make the user-facing copy match reality.** "Personal email domains are not allowed" overstates a
  best-effort denylist; either strengthen the gate (Option B/C) or soften the copy.
- **Add a unit test** asserting representative consumer + disposable domains are rejected and a
  representative corporate domain is accepted, so list edits can't silently regress.

## Finding IDs contributed to the master catalog
GATE-01 (Medium), GATE-02 (Low), GATE-03 (Low), GATE-04 (Info).
