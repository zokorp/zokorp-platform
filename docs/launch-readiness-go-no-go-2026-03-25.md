# Launch Gate and Go/No-Go

Date: 2026-03-25

## Decision summary

| Launch surface | Decision | Why |
| --- | --- | --- |
| Founder-led testing on `app.zokorp.com` | GO | Core auth, free tools, architecture funnel, service requests, and billing surfaces are working |
| Direct demos / invite-only soft launch to `app.zokorp.com` | GO WITH CAVEATS | Product experience is strong, but WorkDrive archival and Stripe webhook proof still need final tightening |
| Broad marketing using `zokorp.com` / `www.zokorp.com` | NO-GO | Public domain still lands on the older Squarespace site |
| Broad promotion of paid validator flow | CONDITIONAL | checkout and gate behavior are proven, but fresh Stripe test-mode webhook fulfillment still needs one clean re-proof |
| Marketing the architecture-review archival promise | CONDITIONAL | provider currently returns `402 PAYMENT_REQUIRED` on archival attempts |

## Gate checklist

### Green now
- Password auth + business-email verification are live
- Account hub is live
- AI Decider is live
- Landing Zone Readiness Checker is live
- Cloud Cost Leak Finder is live
- Architecture Diagram Reviewer is live
- Architecture estimate emails are visually strong and user-approved
- Services page and booking CTA are live
- Service requests are live
- Checkout-session creation is live
- Billing-portal session creation is live
- Validator gating is live
- GitHub Actions scheduled jobs are active and healthy
- Vercel daily retention cron posture is valid

### Yellow now
- WorkDrive archival only works up to the provider/account boundary; actual upload capability is not available today
- Admin/operator workflows exist, but were not fully exercised with an allowlisted founder session in this audit
- CSP remains broader than an ideal locked-down production policy

### Red now
- `zokorp.com` / `www.zokorp.com` are not aligned with the real platform/service surface

## Shortest path to full “ready to market”

1. Resolve the public domain split.
2. Prove one fresh Stripe test-mode purchase all the way through webhook fulfillment and immediate validator consumption.
3. Decide whether to upgrade/fix WorkDrive or narrow the archival expectation.
4. Verify admin workspace flows with a real allowlisted founder account.

## Recommended launch posture right now

Use this order:

1. Keep sending trusted people directly to `https://app.zokorp.com`.
2. Use the free architecture review + estimate email + booking flow as the main outbound proof surface.
3. Do not push paid-validator marketing broadly until the Stripe webhook chain is freshly re-proven.
4. Do not treat apex/www as “live marketing ready” until the public-domain mismatch is corrected.
