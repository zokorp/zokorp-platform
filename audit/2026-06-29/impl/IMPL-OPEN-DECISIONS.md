# IMPL-OPEN-DECISIONS — what still needs you

Everything code-side is implemented, tested, and committed on `fix/audit-2026-06-29`. The items below
need a human (you) because they require prod/Vercel/DNS/registrar access, a real send, or a product call.

## 1. Two named handoffs (I never attempt these)

### 1a. Set production env-var VALUES in Vercel — DO THIS BEFORE MERGING
See **ENV-VARS-TO-SET.md**. Boot validation now fails fast: if `ARCHIVE_ENCRYPTION_SECRET` (and the
other required vars) aren't set, the production deploy crashes at startup. Set the new/changed secrets
first, then merge.

### 1b. First real customer-facing email send (end-to-end verification)
All email tests are hermetic (transport mocked). After deploy, trigger ONE real architecture-review
submission on the preview/prod URL and confirm: exactly one email arrives, the quote is within
$650–$2,800 (or "Consultation first" for low confidence), and CTA links resolve. Do not script a loop.

## 2. Verify on the preview deploy before merging (Preview dial)
- **CSP nonce (SEC-06):** local `next dev` renders dynamically and can't reproduce static-page CSP
  behaviour. On the preview URL, open DevTools console on a few pages (home, /services, /software,
  /account) and confirm **no CSP violation errors** and scripts execute. The production `next build`
  succeeded and `next dev` showed 0 console errors at 1440×900 and 390×844 (screenshots in
  `.claude-screenshots/`), but the preview is the real check. Note: marketing pages now render
  dynamically (the documented nonce trade-off) instead of ISR — confirm that's acceptable, or we can
  scope nonces to the app host only.

## 3. COST-02 — SPF / DKIM / DMARC (registrar action — I can't publish DNS)
Publish these at your DNS provider for the sending domain (`zokorp.com`). Exact DKIM selectors/keys come
from each provider's domain-verification screen — copy them verbatim.

**SPF** (one TXT at the sending domain; keep ≤10 DNS lookups — merge into a single record):
```
zokorp.com.  TXT  "v=spf1 include:spf.zeptomail.com include:amazonses.com -all"
```
(ZeptoMail = `include:spf.zeptomail.com` for the .com region — use `.eu`/`.in` host if your ZeptoMail
account is regional. Resend sends via Amazon SES = `include:amazonses.com`. Drop an include if you
retire that provider.)

**DKIM** (add BOTH providers' records exactly as their dashboards show):
- ZeptoMail: a TXT at `<zepto-selector>._domainkey.zokorp.com` with the key from ZeptoMail → Domains.
- Resend: the 3 CNAME records (e.g. `resend._domainkey`, plus the MX/SPF for the `send.` subdomain) from
  Resend → Domains.

**Custom Return-Path / MAIL FROM (for SPF alignment):** configure a custom bounce subdomain in each
provider (e.g. `bounce.zokorp.com`) and add the CNAME/MX they specify, so the envelope-from aligns with
the visible From domain (required for strict DMARC alignment).

**DMARC** (TXT at `_dmarc.zokorp.com`) — staged rollout, advance only when aggregate reports are clean:
```
Phase 1 (now, ~2 weeks monitoring):
  _dmarc.zokorp.com.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@zokorp.com; ruf=mailto:dmarc@zokorp.com; fo=1; pct=100; aspf=s; adkim=s"
Phase 2 (after clean reports; ramp pct 25 -> 50 -> 100):
  ...  "v=DMARC1; p=quarantine; rua=mailto:dmarc@zokorp.com; pct=25; aspf=s; adkim=s"
Phase 3 (final):
  ...  "v=DMARC1; p=reject; rua=mailto:dmarc@zokorp.com; aspf=s; adkim=s"
```
Verify after publishing: `dig TXT zokorp.com`, `dig TXT <selector>._domainkey.zokorp.com`,
`dig TXT _dmarc.zokorp.com`.

## 4. Product decisions
- **GATE-04 — `zoho.com` signups:** kept on the consumer denylist (Zoho is your transactional sender,
  not a user inbox you accept). Confirm that's intended, or remove `zoho.com` from
  `CONSUMER_EMAIL_DOMAINS` in `lib/security.ts`.
- **ARCHIVE_ENCRYPTION_SECRET migration:** if archiving ran in prod while the key fell back to
  `NEXTAUTH_SECRET`/the literal, existing `ArchivedToolSubmission.payloadCiphertext` blobs were
  encrypted with that old key. Decide whether to set `ARCHIVE_ENCRYPTION_SECRET` to that previous value
  (to keep old blobs readable) or rotate and accept old blobs become undecryptable.

## 5. Deferred (lower-value / larger-change items — not done this pass)
- **ARCH-04 full async delivery:** the inline submit-path processing is now safe (shares the idempotent
  claim with the cron worker), so the High-severity double-send is fixed. Fully removing inline
  processing would change the synchronous "sent" response contract and the UX — left as a deliberate
  follow-up.
- **ARCH-Q05 `llm-refine` phase:** the `webllm` *mode* is removed. The separate `llm-refine` *phase*
  label is still in the phase enum/UI (harmlessly filtered out of timed phases); removing it touches the
  ~1985 LOC form, so deferred.
- **Low/Info polish not implemented** (no behavioural risk, backlog order): TYPE-01/02/03 (zod on
  remaining GET/webhook boundaries), SWP-02/03/04, SEC-09, A11Y-01, REL-03/04 (job wall-clock timeout /
  attempt accounting), ARCH-03/06, VAL-02/04/05/06/08/10, ARCH-Q06/Q07, CITE-05/06/08, ARCH-05
  (ToolRun retention). These remain tracked in the original audit `01-findings.md` / `08-remediation-backlog.md`.

## 6. From audit `09-manual-verification-needed.md` still needing prod/DNS access
- SPF/DKIM/DMARC current state (§3 above).
- Whether prod uses the DB-backed rate-limit path (`RateLimitBucket`) vs in-memory (affects COST-01 reach).
- Live CSP/HSTS header emission on preview vs prod (§2 above).
