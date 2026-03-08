# Billing Readiness Checklist

## Public pricing posture

- [x] Free diagnostic tools can be shown publicly.
- [x] Validator one-time credit pricing can be shown publicly.
- [x] Placeholder subscription pricing is hidden from public pricing and product pages by default.
- [ ] Final public subscription pricing approved by owner.
- [ ] Refund policy approved and published.
- [ ] Tax posture approved and configured.

## Stripe product and env hygiene

- [x] Validator one-time price env vars are mapped in docs.
- [ ] Subscription price env vars are confirmed as live-ready instead of placeholder-only.
- [ ] Billing portal configuration re-verified in the Stripe dashboard.
- [ ] Webhook signing secret verified in the deployment environment.

## Operational readiness

- [x] Checkout, webhook, entitlement, and portal code paths exist in the app.
- [ ] Failed webhook reconciliation runbook written and reviewed.
- [ ] Admin surfacing for webhook fulfillment failures exists.
- [ ] Admin surfacing for subscription state mismatches exists.

## Current default guardrails

- Public subscription pricing stays hidden unless `PUBLIC_SUBSCRIPTION_PRICING_APPROVED=true`.
- Test-mode placeholder values in Stripe docs are not treated as launch-approved commercial pricing.
