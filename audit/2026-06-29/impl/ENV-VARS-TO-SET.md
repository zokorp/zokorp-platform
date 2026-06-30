# ENV VARS TO SET IN VERCEL — required before the production deploy is healthy

**Read this before merging to main.** The implementation made boot env validation **fail fast** and
removed the secret cross-fallbacks (TYPE-04, SEC-01/02/08, PRIV-02). On the next production deploy the
server validates required env at startup (`instrumentation.register` → `validateServerEnv`) and
**throws (crashes the deploy) in production** if a required var is missing. Secrets that used to silently
borrow another secret now read only their own var.

I cannot see or set secret values — set these yourself in **Vercel → Project → Settings → Environment
Variables** (Production, and Preview if you want full parity). Names only below; never commit values.

## 1. REQUIRED at boot — deploy crashes if missing (set a distinct strong value)

| Var | Why it's newly required |
|---|---|
| `ARCHIVE_ENCRYPTION_SECRET` | **NEW hard requirement.** Previously fell back to `NEXTAUTH_SECRET` then a hardcoded literal (PRIV-02). Now it must be its own distinct value or the deploy fails fast. Generate a fresh 32+ byte random secret. |
| `NEXTAUTH_SECRET` | Now boot-validated (SEC-01). Almost certainly already set; confirm it is present and strong. |
| `DATABASE_URL` | Already required (boot-validated now). Confirm present. |
| `STRIPE_SECRET_KEY` | Already required (boot-validated now). Confirm present. |
| `STRIPE_WEBHOOK_SECRET` | Already required (boot-validated now). Confirm present. |

> If `ARCHIVE_ENCRYPTION_SECRET` was never set in prod before, the archive feature was encrypting with a
> key derived from `NEXTAUTH_SECRET` or the dev literal. Choose whether previously-archived blobs need
> re-encryption — see IMPL-OPEN-DECISIONS.md.

## 2. SET to restore feature parity — no longer borrows another secret (won't crash, but the feature degrades until set)

| Var | Behaviour if unset now |
|---|---|
| `ARCH_REVIEW_FOLLOWUP_SECRET` | No longer falls back to `ZOHO_SYNC_SECRET` (SEC-02). If unset, the follow-up endpoint returns 503 "not configured" and the scheduled follow-up workflow can't authenticate. Set a distinct value (and update the matching GitHub Actions secret of the same name). |
| `ARCH_REVIEW_EML_SECRET` | No longer falls back to `NEXTAUTH_SECRET` (SEC-08). If unset, the `.eml` download token isn't issued (fallback email path degrades). Set a distinct value. |
| `ARCH_REVIEW_CTA_SECRET` | No longer falls back to `NEXTAUTH_SECRET` (SEC-08). May intentionally share `ARCH_REVIEW_EML_SECRET`; if both unset, CTA links degrade to plain marketing URLs. Set a distinct value (or rely on the EML secret). |

## 3. No action needed (informational)
- Email providers (`ZEPTOMAIL_*`, `RESEND_*`, `EMAIL_SERVER_*`) and the Stripe price IDs remain
  optional/feature-specific — validated for shape only, never required at boot. Boot will not crash if a
  provider isn't configured (the sender degrades to the next provider / fallback).

## Quick verification after setting
- Deploy and confirm the server boots (no `Invalid or missing required environment variables` crash).
- Locally, `validateServerEnv` is covered by `tests/env-validation.test.ts`.
