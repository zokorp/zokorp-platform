# Atlas Prompts for Remaining Manual Work

Use these only for the parts that cannot be proven or changed safely from CLI alone.

## 1. Public domain handoff audit and cutover plan

```text
You are ChatGPT Atlas in browser Agentic Mode.

TASK
Audit the live public ZoKorp marketing/domain setup and determine the cleanest path to unify the public experience with the current Vercel platform app.

TARGETS
- Public domains:
  - https://zokorp.com
  - https://www.zokorp.com
  - https://app.zokorp.com
- Squarespace account/dashboard
- Vercel project: zokorp-web

BACKGROUND
- `app.zokorp.com` is the live modern platform app on Vercel.
- `zokorp.com` currently redirects to `https://www.zokorp.com/`.
- `www.zokorp.com` still serves the older Squarespace site.
- I need a browser-verified recommendation for the shortest, safest path to unify the public experience before broad marketing.

OPERATING RULES
- Work autonomously unless login, MFA, CAPTCHA, or explicit approval is required.
- Do not change DNS or cut traffic unless the UI makes it obvious and reversible and the task specifically says to do it.
- Default to discovery + recommendation unless a cutover path is clearly safe and explicitly requested.

SUCCESS CRITERIA
1) Verify the current behavior of apex, www, and app.
2) Determine whether the better path is:
   - move the public marketing experience onto Vercel, or
   - keep Squarespace temporarily but add a much stronger intentional handoff to `app.zokorp.com`
3) Return a precise recommendation with the exact dashboard objects or DNS records involved.

STEP-BY-STEP
1. Log into Squarespace.
2. Inspect the current domain/forwarding setup for `zokorp.com` and `www.zokorp.com`.
3. Log into Vercel and open project `zokorp-web`.
4. Inspect attached domains and production aliases.
5. Compare what currently serves:
   - apex
   - www
   - app
6. Determine the safest near-term cutover plan.
7. Do not execute the cutover unless it is explicitly obvious, fully reversible, and clearly intended by the current setup.

OUTPUT FORMAT
1) WHAT I VERIFIED
- one short paragraph

2) CURRENT STATE
- `APEX_BEHAVIOR=...`
- `WWW_BEHAVIOR=...`
- `APP_BEHAVIOR=...`
- `SQUARESPACE_DOMAIN_OBJECTS=...`
- `VERCEL_DOMAIN_OBJECTS=...`

3) RECOMMENDED PATH
- one short paragraph

4) REQUIRED HUMAN DECISION
- the single most important yes/no decision the founder must make
```

## 2. WorkDrive capability verification

```text
You are ChatGPT Atlas in browser Agentic Mode.

TASK
Verify whether the connected Zoho WorkDrive account is capable of accepting the architecture-review archive uploads used by ZoKorp, and identify the exact account/tier blocker if not.

TARGETS
- Zoho WorkDrive / Zoho account used by ZoKorp production

BACKGROUND
- ZoKorp can now reach the correct WorkDrive upload host.
- Production upload attempts return `402 PAYMENT_REQUIRED` when archive uploads are requested.
- I need to know whether this is a plan limitation, a missing activation step, or the wrong product/account.

OPERATING RULES
- Work autonomously unless login, MFA, CAPTCHA, or unavoidable approval is required.
- Do not rotate secrets or reconnect integrations unless strictly necessary to inspect the capability.
- Focus on identifying the exact blocker and the exact upgrade/activation step needed.

SUCCESS CRITERIA
1) Confirm whether the account can support API/file uploads to the intended folder.
2) If not, identify the exact plan/product/account blocker.
3) Return the exact next manual action required.

OUTPUT FORMAT
1) WHAT I VERIFIED
- one short paragraph

2) CURRENT STATE
- `WORKDRIVE_ACCOUNT=...`
- `WORKDRIVE_PLAN_STATUS=...`
- `API_UPLOAD_CAPABILITY=yes|no|unclear`
- `TARGET_FOLDER_STATUS=...`
- `EXACT_BLOCKER=...`

3) REQUIRED NEXT ACTION
- one short paragraph
```

## 3. Stripe dashboard proof pass

```text
You are ChatGPT Atlas in browser Agentic Mode.

TASK
Verify the ZoKorp Stripe test-mode dashboard setup for the validator purchase flow and confirm whether a fresh test purchase can be observed from checkout through webhook delivery and fulfillment.

TARGETS
- Stripe test dashboard for ZoKorp
- Vercel production app `app.zokorp.com`

BACKGROUND
- Checkout-session creation and billing-portal session creation are proven live.
- The remaining gap is proving a fresh Stripe test-mode purchase all the way through webhook delivery/fulfillment with dashboard evidence.

OPERATING RULES
- Use test mode only.
- Do not create live charges.
- If a safe test purchase can be completed in-browser, do it.
- If browser checkout completion is blocked, inspect webhook endpoint deliveries and report the exact blocker.

SUCCESS CRITERIA
1) Verify the configured webhook endpoint for ZoKorp production.
2) Inspect recent test-mode deliveries for the checkout flow.
3) If possible, complete one test purchase and confirm the webhook delivery result.

OUTPUT FORMAT
1) WHAT I VERIFIED
- one short paragraph

2) DASHBOARD EVIDENCE
- `WEBHOOK_ENDPOINT=...`
- `WEBHOOK_STATUS=healthy|failing|unclear`
- `RECENT_CHECKOUT_EVENT_FOUND=yes|no`
- `RECENT_WEBHOOK_DELIVERY_RESULT=...`
- `TEST_PURCHASE_COMPLETED=yes|no`
- `EXACT_BLOCKER_IF_NO=...`

3) RECOMMENDED NEXT STEP
- one short paragraph
```

## 4. Founder admin-session proof

```text
You are ChatGPT Atlas in browser Agentic Mode.

TASK
Verify ZoKorp’s founder/admin workspace using a real allowlisted founder account.

TARGETS
- `https://app.zokorp.com`
- founder/admin account that should be in `ZOKORP_ADMIN_EMAILS`

BACKGROUND
- The current audit account was not allowlisted as admin.
- I need browser proof that the founder account can use:
  - `/admin/readiness`
  - `/admin/leads`
  - `/admin/service-requests`

OPERATING RULES
- Work autonomously unless login, MFA, or email access is required.
- Do not change production data except for safe read-only navigation unless a tiny harmless save is explicitly needed to prove a screen works.

SUCCESS CRITERIA
1) Sign in as the real founder/admin account.
2) Open the three admin pages above.
3) Confirm they render the real admin workspace, not the restricted placeholder.

OUTPUT FORMAT
1) WHAT I VERIFIED
- one short paragraph

2) ADMIN RESULTS
- `ADMIN_READINESS=pass|fail`
- `ADMIN_LEADS=pass|fail`
- `ADMIN_SERVICE_REQUESTS=pass|fail`
- `BLOCKER_IF_FAIL=...`

3) RECOMMENDED NEXT STEP
- one short paragraph
```
