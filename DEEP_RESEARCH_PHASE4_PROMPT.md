# Deep Research Prompt: ZoKorp Phase 4 Advisory

```text
You are ChatGPT Deep Research. Review the CURRENT pushed branch of `zokorp-platform` and advise on the best next phase after a completed privacy-first + booking-first + trust-hardening implementation.

DATE CONTEXT
Assume today is March 24, 2026 (America/Chicago).

SOURCE OF TRUTH
Do NOT inspect `main` as the implementation baseline.
Use this branch as the source of truth:
- Branch name: `codex/phase2-booking-first-catalog`
- Branch URL: https://github.com/leggoboyo/zokorp-platform/tree/codex/phase2-booking-first-catalog

WHO I AM
I am a non-technical founder/operator. Write plain-English recommendations first, technical detail second. Be decisive and practical.

CURRENT IMPLEMENTATION CONTEXT (VERIFY THIS FROM THE BRANCH)

PHASE 1 — PRIVACY-FIRST FOUNDATION
- Free diagnostic tools default to minimal `Lead` + `LeadEvent` storage.
- Full payload archival is opt-in only via encrypted `ArchivedToolSubmission`.
- Duplicate suppression uses short-lived `SubmissionFingerprint`.
- CRM sync is opt-in only.
- Retention sweeps exist and privacy copy reflects the real behavior.

PHASE 2 — BOOKING-FIRST ARCHITECTURE FLOW
- The architecture review remains free.
- The customer gets the result by email.
- The email includes:
  - itemized implementation line items
  - a total
  - assumptions/exclusions
  - estimate reference code
  - one booking CTA only
- There is no pay-now, checkout, or deposit link in that architecture email.
- The private architecture rule/pricing catalog is DB-backed with founder admin review and publish workflow.

PHASE 3 — TRUST HARDENING AND FOUNDER OPS
- Vercel-cron-compatible GET routes now exist for:
  - retention sweep
  - architecture review worker drain
  - Zoho lead sync
- Cron auth uses `CRON_SECRET`.
- Architecture rule runtime now keys off the published revision pointer rather than draft status, so saving a draft no longer changes live estimates.
- Founder-facing catalog UI now distinguishes states like:
  - Published
  - Draft Pending
  - Needs Review
  - Stale
- Customer-facing wording has been standardized from “final quote” to “Implementation Estimate”.
- A minimal `LeadInteraction` model exists for conversion events.
- Architecture CTA clicks now record a privacy-safe interaction event.
- Calendly webhook support exists:
  - verifies signed webhook deliveries
  - records booked-call interactions
  - automatically creates a `ServiceRequest` when the booked-call email matches an existing user
- Payment is still intentionally deferred until after the booking conversation.

COMMERCIAL MODEL DECISION THAT IS LOCKED FOR NOW
- Keep the architecture review free.
- Keep the email as the conversion surface.
- Keep the flow:
  free review -> emailed implementation estimate -> booked call -> payment later if moving forward
- Do NOT recommend immediate pay-now inside the architecture review flow unless you believe that would materially outperform the current model and can defend it strongly.

SPECIAL FOUNDER GOAL
The architecture rule/pricing catalog is not just a temporary admin feature. I want it to become a durable private knowledge base for architecture issues, fixes, pricing logic, and review history that I can maintain over time as a solo operator.

WHAT I NEED FROM YOU

1. VERIFY THE CURRENT BRANCH
- What is truly implemented?
- What is partially implemented?
- What still looks risky, brittle, or easy to misunderstand?

2. EVALUATE THE CURRENT COMMERCIAL MODEL
Given the current architecture-review funnel, tell me whether the model is now strong enough to operate as:
- free review
- emailed estimate
- booked call
- payment later

Specifically evaluate:
- trust
- conversion
- founder workload
- operational overhead
- whether “Implementation Estimate” is now the right wording
- what needs to exist after a booked call so this does not become a messy manual funnel

3. EVALUATE THE PRIVATE KNOWLEDGE-BASE MODEL
I want advice on how the architecture rule catalog should evolve next.
Tell me whether the next layer should be:
- stronger founder review workflow
- bundle/package logic across multiple rule IDs
- benchmark/source citation fields
- stale-review automation
- reporting on most frequent estimate lines
- auditability / publish controls
- extension of this model to other tools

Be practical for a solo founder. I care more about maintainability than theoretical completeness.

4. IDENTIFY THE TOP REMAINING RISKS
Prioritize business and founder-ops risk, not abstract code purity.
Examples:
- booked-call follow-up risk
- stale pricing risk
- admin workload risk
- copy/legal mismatch risk
- CRM pipeline mismatch
- estimate credibility risk
- data-model blind spots
- scheduling/webhook reliability risk

5. RECOMMEND THE NEXT PHASE
Pick one next phase and defend the order.
Do not give me a vague menu.
Possible examples:
- founder ops automation after booking
- admin reporting + funnel visibility
- quote governance enhancements
- service-request workflow hardening
- payment after the call
- marketing vs platform split
- extension of the catalog model to another tool
- something else higher leverage

6. LIST HUMAN / ATLAS TASKS
Tell me exactly what requires manual dashboard or browser work, including:
- Vercel env vars / cron verification
- Calendly webhook subscription setup
- booking page setup
- Zoho setup
- legal/copy review
- any later Stripe setup if you recommend it

7. WRITE THE NEXT CODEX PROMPT
Give me a clean next-step Codex prompt that:
- assumes Phases 1-3 above are already implemented
- uses this pushed branch as the source of truth
- does NOT redo privacy-first work
- does NOT undo the booking-first architecture flow
- clearly says what has already been done versus what to build next

PRIORITY FILES TO REVIEW
- `lib/architecture-review/email.ts`
- `lib/architecture-review/rule-catalog.ts`
- `lib/architecture-review/jobs.ts`
- `app/admin/architecture-catalog/page.tsx`
- `app/admin/architecture-catalog/[ruleId]/page.tsx`
- `app/api/internal/cron/retention-sweep/route.ts`
- `app/api/internal/cron/architecture-review-worker/route.ts`
- `app/api/internal/cron/zoho-sync-leads/route.ts`
- `app/api/architecture-review/cta/route.ts`
- `app/api/webhooks/calendly/route.ts`
- `lib/privacy-leads.ts`
- `lib/zoho-sync-leads.ts`
- `lib/service-requests.ts`
- `prisma/schema.prisma`
- `prisma/migrations/0013_privacy_first_leads/`
- `prisma/migrations/0014_architecture_rule_catalog/`
- `prisma/migrations/0015_architecture_rule_catalog_rls/`
- `prisma/migrations/0016_lead_interactions/`
- `vercel.json`
- tests covering the above

DELIVERABLE FORMAT
Return your answer in this exact structure:

1. EXECUTIVE SUMMARY
- Plain-English founder summary
- 5-10 bullets max

2. IMPLEMENTATION VERIFICATION
- Truly implemented
- Partially implemented
- Risky or overstated

3. COMMERCIAL MODEL ADVICE
- What is working
- What should change
- Whether payment should still stay later

4. PRIVATE KNOWLEDGE-BASE ADVICE
- Is the current rule-level catalog enough for now?
- What should be added next?
- What founder process should exist?

5. TOP RISKS
- Ordered highest to lowest severity
- Explain why each matters in business terms
- Include branch file references where possible

6. RECOMMENDED NEXT PHASE
- Pick the next phase
- Defend why it comes next
- Explain what to delay on purpose

7. HUMAN / ATLAS TASKS
- Flat checklist only

8. NEXT CODEX PROMPT
- A complete prompt block I can paste into Codex

STYLE REQUIREMENTS
- Write for a smart non-technical founder
- Be decisive
- Challenge weak assumptions
- Label inferences clearly
- Avoid “it depends” unless there is a real fork in the road

FAILSAFE
If you cannot reliably inspect the pushed branch, say that immediately and tell me exactly what artifact or access pattern you need.
```
