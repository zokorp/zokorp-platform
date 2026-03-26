# Launch Gate / Go-No-Go

Date: 2026-03-25 (updated 2026-03-26)

## Decision Summary

| Launch surface | Decision | Why |
| --- | --- | --- |
| Founder-led testing on `app.zokorp.com` | GO | The core app is live, hardened, deployed, and re-smoked successfully |
| Direct demos / invite-only soft launch to `app.zokorp.com` | GO WITH CAVEATS | `/services` is now browser-proven live, but root-domain, auth, and booked-call artifacts still remain open |
| Broad marketing using `zokorp.com` / `www.zokorp.com` | NO-GO | Public root-domain traffic still lands on the stale Squarespace site |
| Broad promotion of paid validator flow | GO WITH CAVEATS | Checkout is browser-proven, but one non-admin purchase-plus-consumption artifact would tighten confidence further |
| Broad promotion of booked-call automation from `/services` | NO-GO UNTIL ONE REAL BOOKING ARTIFACT | The CTA is fixed live, but the final Calendly ingestion artifact still needs proof |

## Gate Checklist

### Green now

- `app.zokorp.com` production deployment is healthy after deploy `dpl_Eb6KoHxjki6AafqCBC7A53vyWJLU`
- `npm run lint` passed
- `npm run typecheck -- --incremental false` passed
- `npm test` passed with `281 / 281` tests
- `npm run build` passed
- production smoke passed against `https://app.zokorp.com`
- `/services` primary CTA now uses the tagged Calendly URL strategy live
- `/services` request copy is now honest about immediate request creation vs later booked-call sync
- `/services` signed-in first-paint behavior is fixed in code and covered by tests
- `/services` post-submit success state is now browser-proven live, with form hiding and working account navigation
- validator credit consumption no longer fails after post-run bookkeeping issues
- Stripe checkout/portal session creation no longer fails if audit logging fails
- browser-completed Stripe Checkout is proven in test mode
- admin pages now have a real forbidden boundary in code
- architecture-review status responses are fully `no-store`
- Calendly webhook signature freshness is enforced
- XLSX ingestion abuse surface is reduced with ZIP preflight and workbook limits
- WorkDrive archive failure states now surface in admin leads ops workflows
- runtime readiness now clearly distinguishes internal runtime config from external scheduler verification

### Yellow now

- full auth lifecycle still needs fresh live mailbox/browser proof
- founder admin login still needs fresh live browser proof
- CSP remains broader than ideal
- WorkDrive provider capability is still unresolved even though the operator visibility issue is fixed

### Red now

- `zokorp.com` / `www.zokorp.com` are still not aligned with the real platform
- one live `/services` -> Calendly -> internal-ingestion artifact is still missing

## Shortest Path To Full Public-Launch Readiness

1. Update DNS so both:
   - `zokorp.com`
   - `www.zokorp.com`
   point to Vercel (`76.76.21.21`)
2. After Vercel verifies both domains, permanently redirect apex and `www` to `https://app.zokorp.com`, preserving path and query.
3. Run one Atlas/browser auth pass using:
   - `consulting@zokorp.com`
   - `zkhawaja@zokorp.com`
4. Run one non-admin paid-validator purchase-plus-consumption proof.
5. Run one real `/services` booking and confirm the resulting `LeadInteraction` / `ServiceRequest`.

## Recommended Launch Posture Right Now

Use this order:

1. Send trusted people directly to `https://app.zokorp.com`.
2. Use the repaired `/services` flow and direct software-tool links for founder-led outreach.
3. Do not market the root domain publicly until the DNS cutover is complete.
4. Do not claim fully proven booked-call automation until the remaining browser/manual proofs are completed.
