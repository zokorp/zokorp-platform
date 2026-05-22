# Zoho consolidation research (May 2026)

**Question we set out to answer.** How much of the ZoKorp platform can live
inside a single Zoho account (`zkhawaja@zokorp.com`) on the free tier, without
losing functionality? Source materials: Zoho Bookings, ZeptoMail, Zoho Forms,
Zoho Meetings, and Zoho Mail product pages — read May 2026.

The platform already uses Zoho CRM, Zoho Invoice, and Zoho WorkDrive in
production. This doc covers the *remaining* candidates and the trade-offs of
moving each one in.

---

## Summary recommendation

| Candidate                        | Verdict        | Lift                                 |
|----------------------------------|----------------|--------------------------------------|
| **ZeptoMail** (replace Resend)   | **Migrate**    | Code already supports it (this PR). Just set env vars. |
| Zoho Mail SMTP (transactional)   | Skip           | Zoho themselves recommends ZeptoMail. Free tier is too low for app traffic. |
| Zoho Bookings (replace Calendly) | Skip           | No native webhooks on free tier → would need Zoho Flow middleware. |
| Zoho Meetings (replace Zoom)     | User-side only | Calendly config switch. No code change needed. |
| Zoho Forms (replace /contact)    | Probably skip  | Loses direct write to ServiceRequest table; gain is small. |

The single high-value move is **ZeptoMail**. The other Zoho replacements are
either worse than the current state or are user-side configuration changes
that don't involve the codebase.

---

## ZeptoMail (replaces Resend) — RECOMMENDED

**What it is.** Zoho's dedicated transactional-email service. Not Zoho Mail —
ZeptoMail exists *specifically* because Zoho's regular mailbox product isn't
designed for app-generated traffic, and Zoho explicitly steers transactional
senders to ZeptoMail.

**Pricing.** Free tier is 10,000 emails on first signup (one-time, not
monthly). After that, $2.50 per 10K emails — about 1/10th of Resend's
post-free pricing at the same volume. The platform's current outbound volume
is well under the one-time free credit.

**Why it's the right move.**
- Consolidates billing + auth into the existing `zkhawaja@zokorp.com` Zoho
  account.
- Cheaper than Resend at every scale above the free tier.
- Same DNS prerequisites (SPF, DKIM) as Resend — no new domain work if
  Resend is already verified for `zokorp.com`.

**What this PR did.** `lib/architecture-review/sender.ts` now tries providers
in this order:

1. **ZeptoMail** (if `ZEPTOMAIL_TOKEN` + `ZEPTOMAIL_FROM_EMAIL` are set)
2. **Resend** (if `RESEND_API_KEY` + `RESEND_FROM_EMAIL` are set)
3. **SMTP** (if all `EMAIL_SERVER_*` + `EMAIL_FROM` are set)

That means flipping to ZeptoMail is a pure env-var change — no code deploy,
no risk of breaking the current Resend path while migrating.

**Migration steps (for the owner, when ready).**

1. Inside Zoho ( `zkhawaja@zokorp.com` ) → go to ZeptoMail
   ( https://www.zoho.com/zeptomail/ ).
2. Create a Mail Agent for `zokorp.com`.
3. Add the SPF + DKIM records ZeptoMail shows to Cloudflare DNS for
   `zokorp.com`. Wait for green status.
4. Generate a **Send Mail Token** for the Mail Agent.
5. In Vercel (Project Settings → Environment Variables), add:
   - `ZEPTOMAIL_TOKEN` = the Send Mail Token
   - `ZEPTOMAIL_FROM_EMAIL` = the verified from-address (e.g.
     `hello@zokorp.com`)
   - `ZEPTOMAIL_FROM_NAME` = `ZoKorp` (or whatever the brand line should be)
6. Redeploy. The next email send will use ZeptoMail; Resend stays configured
   as a safety net until you remove its env vars.
7. After a week of clean ZeptoMail sends, remove `RESEND_API_KEY` and
   `RESEND_FROM_EMAIL` in Vercel and cancel the Resend account.

---

## Zoho Mail SMTP — SKIP

**What it is.** The SMTP host attached to a regular Zoho Mailbox.

**Why we're not using it for transactional.** Zoho's own documentation says:
> "For high-volume transactional emails, use ZeptoMail."
The free Zoho Mail SMTP limits are low (hundreds of messages/day) and shared
with human inbox traffic. App-generated emails (verification, password
resets, architecture review delivery, ops digest) would hit limits and get
flagged.

**Use case where Zoho Mail SMTP is still right.** If you ever want to send
*from yourself*, manually, via SMTP — e.g. an outreach email from
`zkhawaja@zokorp.com`. That's outside the scope of platform-generated mail.

---

## Zoho Bookings (replace Calendly) — SKIP

**Free tier.** $0, 1 staff member, 1 service. Looks close to Calendly's free
tier on paper.

**Blocker.** Zoho Bookings on the free tier exposes booking-completion
webhooks only via Zoho Flow (Zoho's iPaaS), not natively. That means
replacing Calendly would require a Zoho Flow account *and* a flow
specifically wired to POST to `/api/internal/calendly-booked-call` (or a
rewritten endpoint). That's more moving parts, not fewer.

**Current state works.** The platform's Calendly integration is already
live, free-tier-compatible (one active event, the Discovery Call), and
HMAC-verified at the webhook endpoint. Replacing it would be net negative.

---

## Zoho Meetings in Calendly (replace Zoom) — USER-SIDE

**What it is.** Calendly lets you attach a video-conference provider to each
event type. Zoom is the most common; Zoho Meetings is supported via
Calendly's native integration directory.

**No code change needed.** This is purely a Calendly settings flip:

1. Calendly → Integrations → Connect Zoho Meetings.
2. Edit the Discovery Call event type → change "Location" from Zoom to Zoho
   Meetings.
3. Save. New bookings get Zoho Meetings links.

**Whether it's worth doing.** Only if you want the meeting links + recordings
to live in Zoho instead of Zoom. Free-tier Zoho Meetings caps at 60 min /
100 participants — fine for discovery calls. No platform impact either way.

---

## Zoho Forms (replace /contact) — PROBABLY SKIP

**Free tier.** 3 forms, 500 submissions/month, 200 MB storage.

**What we'd lose.** The current `/contact` page POSTs into the platform's
`ServiceRequest` table, which:

- Feeds the admin queue at `/admin/service-requests`.
- Auto-syncs to Zoho CRM as a Lead.
- Triggers internal owner notification email.
- Records audit-log entries for compliance review.
- Honors business-email validation (`lib/security.ts` blocklist).

A Zoho Forms migration would require either:

- **(a)** Wiring a Zoho Forms webhook back into a new platform endpoint
  that recreates all of the above — net more code, not less.
- **(b)** Accepting that admin queue / CRM sync / audit log get bypassed —
  big regression for ops visibility.

**Use case where Zoho Forms is right.** A simple "subscribe to updates" or
"download the whitepaper" form that doesn't need to land in
`ServiceRequest`. The `/contact` page isn't that — it's the primary
sales-qualified-lead intake.

---

## Things that can't be Zoho-replaced

For completeness:

- **Stripe** — billing. Zoho Subscriptions exists but requires a complete
  rewrite of `lib/stripe-webhook-handlers.ts` and all entitlement logic.
  Stripe stays.
- **Postgres** — primary database. Zoho Creator's database is not a general-
  purpose backend.
- **NextAuth** — session management. No Zoho equivalent for the
  business-email-verified credentials provider pattern.
- **Vercel** — hosting. Zoho doesn't host arbitrary Next.js apps.

---

## Status after this PR

- [x] Code path for ZeptoMail added (`lib/architecture-review/sender.ts`)
- [x] Provider preference ZeptoMail → Resend → SMTP wired
- [x] `.env.example` documents new env vars
- [x] `lib/runtime-readiness.ts` recognizes ZeptoMail as a valid email config
- [x] `lib/auth-config.ts` includes ZeptoMail in `isResultEmailConfigured`
- [x] Tests cover ZeptoMail provider preference + fallback chain
- [ ] **OWNER:** Generate ZeptoMail Send Mail Token in Zoho
- [ ] **OWNER:** Add `ZEPTOMAIL_*` env vars in Vercel and redeploy
- [ ] **OWNER:** After a week clean, remove `RESEND_*` env vars
