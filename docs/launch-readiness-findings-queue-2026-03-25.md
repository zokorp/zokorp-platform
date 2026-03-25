# Launch Readiness Findings Queue

Date: March 25, 2026

## P0

None.

## P1

### P1-1: Root marketing domain still serves stale Squarespace site

- Affected journey:
  - any prospect starting from `zokorp.com` or `www.zokorp.com`
- Proof:
  - `https://zokorp.com` redirects to `https://www.zokorp.com/`
  - `https://www.zokorp.com` serves Squarespace HTML
  - live HTML still contains `/our-services`, `/contact-us`, and legacy `AWS AI/ML Engineer and Consultant` copy
- Business impact:
  - broad marketing would send traffic to the wrong product story
  - trust and conversion suffer because the public site and app say different things
  - SEO and paid traffic would amplify outdated messaging
- Blocks:
  - public launch and broad marketing
- Recommended action:
  - cut `zokorp.com` and `www.zokorp.com` to Vercel or redirect them into the new platform

### P1-2: WorkDrive archival path is provider-blocked

- Affected journey:
  - architecture-review follow-up when WorkDrive archival is requested
- Proof:
  - provider now reports truthful `402 PAYMENT_REQUIRED`
- Business impact:
  - optional archive/follow-up workflow is not fully operational
  - founder could believe archives are safely landing in WorkDrive when the provider account is actually blocked
- Blocks:
  - full confidence in the optional archive path
- Recommended action:
  - either upgrade/fix Zoho WorkDrive account access or narrow operational expectations around that feature

## P2

### P2-1: Browser-completed Stripe test checkout not yet executed

- Affected journey:
  - literal hosted checkout browser path
- Proof:
  - server-side flow is proven with signed webhook replay and consumption, but no live browser checkout was completed in Stripe-hosted UI during the audit
- Business impact:
  - low operational risk, but weaker confidence in front-end hosted checkout polish than a literal test purchase would provide
- Blocks:
  - does not block founder testing
  - may block "highest possible confidence" before public paid promotion
- Recommended action:
  - run one real Stripe test-mode browser checkout and observe fulfillment end to end

### P2-2: Real booked-call ingestion not yet observed with a matching live booking

- Affected journey:
  - architecture review -> Calendly booking -> booked-call sync -> service request / lead interaction
- Proof:
  - scheduled sync workflow is alive and successful
  - no matching recent booked call existed during audit window
- Business impact:
  - system appears ready, but the final event path has not been proven by a real booking artifact
- Blocks:
  - does not block founder demos
  - should be proven before claiming fully automated booked-call ops
- Recommended action:
  - create one real founder-controlled Calendly booking and verify ingestion

### P2-3: Unauthorized admin pages render restricted content with HTTP 200 instead of 403

- Affected journey:
  - non-admin visits to admin URLs
- Proof:
  - restricted page content renders instead of a forbidden status
- Business impact:
  - not a data leak, but it weakens semantic clarity for monitoring and can confuse expectation around true forbidden responses
- Blocks:
  - no
- Recommended action:
  - return 403 for unauthorized admin page requests where feasible

### P2-4: CSP can be tightened further

- Affected journey:
  - all browser-rendered app pages
- Proof:
  - current CSP still includes `script-src 'unsafe-inline'` and a broad `connect-src https:`
- Business impact:
  - current posture is acceptable for launch, but tighter CSP would reduce browser-side risk and future blast radius
- Blocks:
  - no
- Recommended action:
  - continue CSP hardening after launch blockers are cleared

## P3

### P3-1: Audit artifacts remain in production data

- Affected journey:
  - founder/admin data review
- Proof:
  - audit created service requests `SR-260325-6SEC9` and `SR-260325-WQP7Y`
  - audit created synthetic Stripe fulfillment and test entitlement/credit activity
- Business impact:
  - minor clutter in founder dashboards and production data
- Blocks:
  - no
- Recommended action:
  - keep them as known audit artifacts or clean them later with a deliberate data-maintenance pass

### P3-2: Local browser automation was partially limited during audit

- Affected journey:
  - browser-level automation confidence
- Proof:
  - Playwright/browser sandbox issues limited live browser automation on the audit machine
- Business impact:
  - functional verification is still strong because live HTTP, workflow, and screenshot evidence covered the critical paths
- Blocks:
  - no
- Recommended action:
  - optional future pass on a less restricted browser-capable environment

## Hardening Items Already Fixed During This Audit

These were findings at the start of the audit but are no longer open:

- architecture email delivery timeout behavior
- misleading WorkDrive network error handling
- architecture status polling causing extra processing
- non-idempotent lead-event writes
- architecture review depending on brittle background execution
- CSV formula injection in admin lead exports
- hidden subscription prices accessible at checkout-session creation
- incomplete runtime readiness surfacing for secret fallback boundaries
- cacheability on unauthorized admin lead export responses
