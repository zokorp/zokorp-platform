# Open questions / unresolved items

## Human login/MFA blockers (required before full account verification)
- GitHub dashboard login/MFA required to verify repo visibility in UI, issues list, and project board columns.
- Vercel login/MFA required to verify linked repo/team settings and deployment configuration.
- Squarespace login/MFA required to verify DNS dashboard state, forwarding rules, and capture DNS screenshots.
- Supabase login/MFA required to verify auth/storage settings and current project configuration.
- Stripe login/MFA required to verify test-mode product/price/portal configuration in-dashboard.

## Business/legal/policy decisions
- Stripe live-mode activation details (legal entity and payout/banking setup).
- Tax collection policy and tax configuration regions.
- Refund policy, dispute handling policy, and customer support policy.
- Privacy Policy and Terms of Service content.

## Product and pricing decisions
- Final production pricing for monthly/annual plans (current Stripe values are placeholders).
- Final launch gating matrix: exact products/features unlocked by one-time purchase vs subscription.
- PayPal/Braintree phase-2 decision (confirm whether Stripe-only is sufficient for MVP launch).
- MLOps plan pricing values and overage rates:
  - Starter monthly amount
  - Starter annual amount
  - meter overage rate for `job_units`

## Content/ops decisions
- Blog migration execution approach (static migration vs CMS-backed).
- Final canonical wording for location/contact (current public pages show both Houston and Sugar Land references).

## MLOps business defaults to revisit
- First narrow vertical use case to optimize messaging and examples (current MVP is broad batch-ops baseline).
- Compliance roadmap after MVP (SOC2 target timing, non-HIPAA controls, security attestations).
