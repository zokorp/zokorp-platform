# Launch Readiness Audit Summary

Date: March 25, 2026  
Primary production app: [https://app.zokorp.com](https://app.zokorp.com)  
Public apex domain observed during audit: [https://zokorp.com](https://zokorp.com)  
Public `www` domain observed during audit: [https://www.zokorp.com](https://www.zokorp.com)

## Verdict

ZoKorp is **ready with named caveats** for founder-led testing, direct demos, and controlled traffic sent straight to `app.zokorp.com`.

ZoKorp is **not ready for broad public marketing from the root domain** until the marketing-domain mismatch is resolved. The main product experience is now real, coherent, and production-capable, but `zokorp.com` and `www.zokorp.com` still point at an older Squarespace site that does not match the live platform.

## What Was Proven

- The production app deployment is live on Vercel and healthy.
- Local validation passed:
  - `npm run lint`
  - `npm run typecheck -- --incremental false`
  - `npm test`
  - `npm run build`
  - `npm run smoke:production`
- The architecture-review funnel now works in production with inline job processing:
  - submission succeeds
  - result email is delivered
  - estimate wording and booking-first CTA are correct
- All three other free diagnostic tools were proven live:
  - AI Decider
  - Landing Zone Readiness Checker
  - Cloud Cost Leak Finder
- Privacy-first storage behavior is real for the free tools:
  - minimal lead/event storage by default
  - opt-in archive path
  - consent-gated CRM sync
  - retention infrastructure present
- Billing is strongly proven server-side:
  - checkout session creation
  - billing portal session creation
  - signed Stripe webhook fulfillment
  - entitlement and credit creation
  - validator consumption
  - credit decrement and purchase-required enforcement
- Service-request creation from the app is live and visible in the user account timeline.
- Scheduled operations are alive:
  - Vercel retention cron
  - GitHub Actions architecture worker
  - GitHub Actions Calendly sync
  - GitHub Actions Zoho sync

## Hardening Applied During This Audit

The audit was not passive. Several launch-relevant fixes were made while verifying live behavior:

- Increased SMTP timeout handling so production email delivery stops failing under slow provider responses.
- Corrected Zoho WorkDrive host handling so failures report truthfully instead of masquerading as generic network failures.
- Removed architecture-job status polling side effects that could trigger duplicate background processing.
- Made lead-event recording idempotent where source keys already exist.
- Changed architecture review processing to complete inline during submission instead of relying on fragile serverless background ownership.
- Added CSV formula-injection protection to admin lead exports.
- Closed server-side access to hidden subscription pricing in checkout-session creation.
- Expanded runtime readiness checks for secret fallback boundaries.
- Added `Cache-Control: no-store` on unauthorized admin lead-export responses.

## Biggest Remaining Blockers

### 1. Public domain mismatch

`zokorp.com` redirects to `www.zokorp.com`, and `www.zokorp.com` still serves an older Squarespace site. That means:

- public visitors do not land on the audited product
- copy and brand position are inconsistent
- CTA behavior is split between two different systems
- broad marketing spend would amplify the wrong site

This is the main launch blocker.

### 2. WorkDrive archival is provider-blocked

The code now reports the WorkDrive condition truthfully, but the provider is currently returning `402 PAYMENT_REQUIRED` for the archive-upload path. The platform is no longer hiding the problem, but the external provider configuration is not fully operational for that optional archival path.

### 3. A literal browser-completed Stripe test checkout was not performed

Server-side billing behavior is strongly proven through signed webhook replay and live entitlement consumption. That is enough to trust the core integration, but the exact hosted browser checkout completion path was not exercised in this audit.

### 4. Real booked-call ingestion remains operationally unproven

The Calendly sync workflow is alive and healthy, but there was no matching recent real booking during the audit window. The system is ready to ingest bookings, but a live booked-call artifact was not available to prove the final operational step.

## Recommended Launch Stance

### Safe now

- Founder demos
- Sharing direct links to `app.zokorp.com`
- Sending direct prospects to `/services` or specific tool pages on `app.zokorp.com`
- Controlled private beta or soft launch

### Do not do yet

- Broad public marketing using `zokorp.com`
- SEO/content promotion of the apex or `www` domain
- Paid acquisition to the root domain

## Immediate Next Steps

1. Cut `zokorp.com` and `www.zokorp.com` over to the Vercel platform, or intentionally redirect them into the live platform.
2. Decide whether WorkDrive archival should be:
   - enabled by upgrading/fixing the provider account, or
   - treated as a deferred follow-up feature with copy narrowed accordingly.
3. Run one real Stripe test-mode checkout in the browser for absolute confidence.
4. Run one real Calendly booking through the founder-owned booking page and verify that the sync creates the expected internal records.

## Audit Artifacts Created

- Audit user account was created and used for end-to-end flow proof.
- Two service requests were created as audit artifacts:
  - `SR-260325-6SEC9`
  - `SR-260325-WQP7Y`
- One signed webhook fulfillment artifact was created using a synthetic Stripe test session id:
  - `cs_test_audit_1774471262286`

These are harmless but should be understood as audit-created records if you review production data.
