# Atlas Prompts For Remaining Manual / Dashboard Work

Use these only where browser or provider UI access is unavoidable. Each prompt is designed to run autonomously and stop only for login, MFA, CAPTCHA, or an explicit irreversible confirmation.

## 1. Root Domain Cutover To Vercel And Redirect To `app.zokorp.com`

```text
You are ChatGPT Atlas in browser Agentic Mode.

GOAL
Cut `zokorp.com` and `www.zokorp.com` over so both stop serving Squarespace and permanently redirect to `https://app.zokorp.com`, preserving path and query.

CONTEXT
- Current app surface: `https://app.zokorp.com`
- Current problem:
  - `https://zokorp.com` redirects to `https://www.zokorp.com/`
  - `https://www.zokorp.com` still serves the stale Squarespace site
- Current Vercel project: `zokorp-web`
- Vercel has already attached these domains but says they are not configured properly.
- Vercel’s current required DNS records are:
  - `A zokorp.com 76.76.21.21`
  - `A www.zokorp.com 76.76.21.21`

OPERATING RULES
- Work autonomously unless login, MFA, CAPTCHA, or an irreversible confirmation is required.
- Prefer the smallest safe change set.
- Do not move the app onto the apex host in this pass.
- The intended final state is:
  - apex works on Vercel
  - `www` works on Vercel
  - both permanently redirect to `https://app.zokorp.com`

STEP-BY-STEP
1. Log into the current registrar / DNS provider / Squarespace domain UI that controls `zokorp.com`.
2. Verify the currently active DNS records for:
   - apex
   - `www`
3. Remove or replace the Squarespace-serving records so that the active records become exactly:
   - `A zokorp.com 76.76.21.21`
   - `A www.zokorp.com 76.76.21.21`
4. Wait until Vercel shows both domains as verified for project `zokorp-web`.
5. In Vercel, configure permanent redirects so that:
   - `https://zokorp.com/<path>?<query>` -> `https://app.zokorp.com/<path>?<query>`
   - `https://www.zokorp.com/<path>?<query>` -> `https://app.zokorp.com/<path>?<query>`
6. Verify in the browser:
   - `https://zokorp.com`
   - `https://www.zokorp.com`
   - both end up on `https://app.zokorp.com`
   - path and query are preserved
   - SSL is valid
7. If propagation delay prevents full verification, wait and re-check until it is either complete or clearly blocked by DNS propagation time.

SUCCESS CRITERIA
- apex no longer serves Squarespace
- `www` no longer serves Squarespace
- both domains redirect permanently to `https://app.zokorp.com`
- Vercel shows both domains as correctly configured

STRICT OUTPUT FORMAT
1) WHAT I CHANGED
- one short paragraph

2) VERIFICATION
- `APEX_DNS=...`
- `WWW_DNS=...`
- `APEX_VERCEL_STATUS=...`
- `WWW_VERCEL_STATUS=...`
- `APEX_BROWSER_RESULT=...`
- `WWW_BROWSER_RESULT=...`
- `PATH_QUERY_PRESERVED=yes|no`
- `SSL_STATUS=...`

3) BLOCKER
- `none` or one short sentence
```

## 2. Full Auth Lifecycle And Founder Admin Proof

```text
You are ChatGPT Atlas in browser Agentic Mode.

GOAL
Prove ZoKorp’s live auth lifecycle and founder admin access end to end on `https://app.zokorp.com`.

ACCOUNTS
- non-admin audit alias: `consulting@zokorp.com`
- founder/admin alias: `zkhawaja@zokorp.com`

REQUIRED FLOWS
For `consulting@zokorp.com`:
- register
- receive verification email
- verify email
- login
- logout
- request password reset
- receive reset email
- complete password reset
- login again
- open `/account`
- open `/account/billing`

For `zkhawaja@zokorp.com`:
- login
- open `/admin/readiness`
- open `/admin/leads`
- open `/admin/service-requests`

OPERATING RULES
- Work autonomously unless login, MFA, CAPTCHA, or inbox access requires explicit human help.
- Use the real production app only.
- Do not change unrelated production data.
- If an account already exists, use the safest path to continue the proof rather than starting over.

SUCCESS CRITERIA
- all non-admin auth lifecycle steps complete successfully
- founder/admin account reaches the real admin workspaces
- any blocker is captured precisely

STRICT OUTPUT FORMAT
1) NON_ADMIN_AUTH
- `REGISTER=pass|fail|blocked`
- `VERIFY_EMAIL=pass|fail|blocked`
- `LOGIN=pass|fail|blocked`
- `LOGOUT=pass|fail|blocked`
- `PASSWORD_RESET=pass|fail|blocked`
- `ACCOUNT_PAGE=pass|fail|blocked`
- `BILLING_PAGE=pass|fail|blocked`

2) ADMIN_AUTH
- `ADMIN_LOGIN=pass|fail|blocked`
- `ADMIN_READINESS=pass|fail|blocked`
- `ADMIN_LEADS=pass|fail|blocked`
- `ADMIN_SERVICE_REQUESTS=pass|fail|blocked`

3) SINGLE BLOCKER SUMMARY
- one short paragraph
```

## 3. Stripe Test-Mode Browser Checkout Proof

```text
You are ChatGPT Atlas in browser Agentic Mode.

GOAL
Complete one real Stripe test-mode browser checkout from ZoKorp production and prove that fulfillment succeeds.

TARGET
- `https://app.zokorp.com`

OPERATING RULES
- Use Stripe test mode only.
- Do not create live charges.
- Work autonomously unless login, MFA, CAPTCHA, or card-entry confirmation is required.
- Prefer the smallest safe purchase that exercises the paid validator flow.

STEP-BY-STEP
1. Sign in to `https://app.zokorp.com` with the safest available founder-controlled test account.
2. Navigate to the paid validator flow and trigger checkout from the real production UI.
3. Complete the hosted Stripe Checkout page in test mode.
4. Return to the app success state.
5. Verify in Stripe test dashboard that the corresponding checkout and webhook delivery succeeded.
6. Verify in the app that the entitlement or credit balance is present after fulfillment.
7. If easy and safe, run one validator action that consumes exactly one newly granted use.

SUCCESS CRITERIA
- hosted Stripe Checkout completes in test mode
- webhook delivery is successful
- entitlement / credits appear in the app
- optional first consumption works if attempted

STRICT OUTPUT FORMAT
1) CHECKOUT_RESULT
- `CHECKOUT_SESSION_CREATED=yes|no`
- `HOSTED_CHECKOUT_COMPLETED=yes|no`
- `RETURN_TO_APP=yes|no`

2) FULFILLMENT_RESULT
- `WEBHOOK_DELIVERY=success|fail|unclear`
- `ENTITLEMENT_OR_CREDITS_PRESENT=yes|no`
- `VALIDATOR_CONSUMPTION_TESTED=yes|no`
- `VALIDATOR_CONSUMPTION_RESULT=pass|fail|not_tested`

3) BLOCKER
- `none` or one short sentence
```

## 4. Real `/services` Calendly Booking And Ingestion Proof

```text
You are ChatGPT Atlas in browser Agentic Mode.

GOAL
Create one real founder-controlled booking from ZoKorp’s live `/services` CTA and verify that the booking is ingestible into ZoKorp records.

TARGETS
- `https://app.zokorp.com/services`
- Calendly booking flow
- ZoKorp account / admin surfaces for verification

KNOWN EXPECTED LIVE BEHAVIOR
- `/services` primary CTA should open Calendly with:
  - `utm_source=zokorp`
  - `utm_medium=services-page`
  - `utm_campaign=architecture-follow-up`

OPERATING RULES
- Use a harmless test slot only.
- Use founder-controlled contact information only.
- Work autonomously unless login, MFA, CAPTCHA, or scheduling confirmation is required.

STEP-BY-STEP
1. Open `https://app.zokorp.com/services`.
2. Confirm the primary booking CTA opens a Calendly URL containing the expected UTM tags.
3. Create one real test booking using a founder-controlled email.
4. Wait for the normal sync window or refresh as needed.
5. Verify the resulting ZoKorp artifact in the safest available place:
   - account timeline
   - admin leads
   - admin service requests
6. Confirm whether the same-email booking created:
   - a booked-call record / lead interaction
   - a service request when account matching applies

SUCCESS CRITERIA
- booking was created from the fixed `/services` CTA
- the booking carries the correct tags
- ZoKorp records show the expected ingestion artifact

STRICT OUTPUT FORMAT
1) BOOKING_RESULT
- `CTA_TAGS_PRESENT=yes|no`
- `BOOKING_CREATED=yes|no`
- `BOOKING_EMAIL_USED=...`

2) INGESTION_RESULT
- `LEAD_INTERACTION_FOUND=yes|no|unclear`
- `SERVICE_REQUEST_FOUND=yes|no|unclear`
- `ACCOUNT_MATCH_APPLIED=yes|no|unclear`

3) BLOCKER
- `none` or one short sentence
```

## 5. WorkDrive Capability Diagnosis

```text
You are ChatGPT Atlas in browser Agentic Mode.

GOAL
Identify the exact Zoho / WorkDrive account blocker that prevents ZoKorp’s archive-upload path from being fully trusted.

CONTEXT
- ZoKorp now surfaces archive failures honestly in operator workflows.
- The remaining question is whether the connected WorkDrive account can actually support the intended upload path.

OPERATING RULES
- Work autonomously unless login, MFA, CAPTCHA, or irreversible account changes are required.
- Do not rotate secrets or reconnect integrations unless strictly necessary for diagnosis.
- Focus on identifying the exact blocker and exact next action.

SUCCESS CRITERIA
- determine whether the current account is capable of the required upload behavior
- if not, identify the exact plan / activation / account blocker
- return the exact next manual action

STRICT OUTPUT FORMAT
1) CURRENT_STATE
- `WORKDRIVE_ACCOUNT=...`
- `WORKDRIVE_PLAN_STATUS=...`
- `UPLOAD_CAPABILITY=yes|no|unclear`
- `EXACT_BLOCKER=...`

2) REQUIRED_NEXT_ACTION
- one short paragraph
```
