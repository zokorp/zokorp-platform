# Soft-Launch Operational Evidence

## Current posture
- Launch mode: founder-led soft launch
- Public proof mode: representative/anonymized only
- Goal: keep operational proof repeatable and honest before broad promotion

## Repeatable production checks
- Provider and infrastructure audit:
  - `npm run ops:audit:production`
- Live signed-in browser journey:
  - `npm run journey:audit:production`
- Soft-launch operational proof:
  - `npm run ops:proof:production`
- Full soft-launch bundle:
  - `npm run soft-launch:audit:production`
  - this now includes a settle window and proof-step retry when the production database session pool is briefly saturated

## What `ops:proof:production` verifies
- A dedicated non-admin audit account can sign in to production
- The audit account holds a real `FTR` credit for `ZoKorpValidator`
- One real `FTR` validator run succeeds against production
- The `FTR` credit balance decrements by exactly one
- The validator run lands in account-linked history with delivery state metadata
- A synthetic booked-call event creates a linked `ServiceRequest` and account/admin artifact
- The script attempts the internal Calendly ingest route first and records if local verification falls back to direct linkage proof

## Evidence output
- JSON summary:
  - `output/playwright/production-operational-proof/summary.json`
- Browser screenshots:
  - `output/playwright/production-operational-proof/*.png`

## Local operator setup note
- Keep the dedicated browser-audit credentials in `.env.audit.local`.
- If the live booked-call proof should verify the internal ingest route directly from your machine, also store:
  - `CALENDLY_SYNC_SECRET=<current production sync secret>`
- The audit-account provisioning command now preserves that extra local override instead of wiping it out.

## Important caveats
- The booked-call proof is synthetic at the provider boundary. It proves linkage and operator visibility, not a human-created external Calendly booking.
- Before broad launch, the stronger external proofs are still:
  - one real founder-controlled Calendly booking observed end to end

## Confirmed monitored inbox proof
- Verified on March 30, 2026 using the real mailbox `consulting@zokorp.com`.
- Confirmed customer-facing result email delivery:
  - subject: `[ZoKorp] FTR validation result 56%`
  - folder: `Inbox`
  - displayed receive time: `6:03 PM` America/Chicago
  - content confirmation: score/result language and consultation-only posture present
- Confirmed auth email delivery:
  - subject: `Reset your ZoKorp password`
  - folder: `Inbox`
  - displayed receive time: `6:03 PM` America/Chicago
  - content confirmation: password-reset language and expiring-link warning present
- App-side audit evidence also confirmed:
  - validator run recorded `deliveryStatus: sent`
  - password reset request recorded `deliveryOk: true`

## Remaining external proof
- No major external ops proof gaps remain for the current soft-launch claim.

## Confirmed real Calendly booking proof
- Verified on March 30, 2026 for the founder-controlled booking created from `/services` with `consulting@zokorp.com`.
- Browser confirmation proved:
  - `/services` primary CTA opened Calendly
  - tracking tags were present:
    - `utm_source=zokorp`
    - `utm_medium=services-page`
    - `utm_campaign=architecture-follow-up`
  - real booking created for:
    - `7:30am - 8:00am, Tuesday, March 31, 2026`
- Production record proof confirmed after manual Calendly sync workflow dispatch:
  - `LeadInteraction.action = call_booked`
  - `provider = calendly`
  - booked time stored as `2026-03-31T12:30:00.000000Z`
  - linked `ServiceRequest` created:
    - tracking code: `SR-260330-Y55CZ`
    - type: `CONSULTATION`
    - status: `SCHEDULED`
    - title: `Architecture Review Follow-up`
  - matching ingest audit log recorded:
    - `integration.calendly_call_booked`
- Atlas could not verify admin screens directly because founder admin access was not supplied in-browser, but CLI verification confirmed the records.

## Last verified state
- This repo now carries repeatable CLI evidence for provider health, signed-in browser flow, validator credit consumption, internal booked-call ingest verification, confirmed monitored inbox delivery, and one real external Calendly booking with confirmed ZoKorp ingestion.
