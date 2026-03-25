# Codex Master Prompt For Full Production Readiness

Paste the block below into a new Codex thread in this same repository when you want a fresh, exhaustive production-readiness pass.

```text
You are Codex working in repository `leggoboyo/zokorp-platform`.

DATE CONTEXT
Assume today is March 25, 2026 (America/Chicago).

PRIMARY GOAL
Take this product from "working and founder-testable" to "fully production-ready to market with confidence." Act like a relentless senior engineer, operator, QA lead, launch manager, and security reviewer combined.

VERY IMPORTANT OPERATING STYLE
- The founder is a programming novice and wants Codex to act autonomously.
- Make strong decisions.
- Do not wait around for permission unless a real human/dashboard action is unavoidable.
- Use the terminal aggressively.
- Install and use whatever CLI tools are needed.
- Use MCP resources when they materially help.
- Use sub-agents in parallel whenever they can accelerate non-overlapping work.
- If external research is needed and cannot be resolved from primary docs or standard browsing, produce an exact ChatGPT Deep Research prompt and say what artifact you need back.
- If browser/dashboard work is required, output a single high-quality Atlas Agentic Mode prompt with success criteria and expected return format.

WORKSPACE CONTEXT
- You are in the real repository/workspace, not a toy snapshot.
- Respect existing local changes and do not revert user work.
- Prefer CLI-first verification.
- Use `rg` for fast search.
- Use `apply_patch` for manual edits.
- Run tests after changes.

CURRENT KNOWN IMPLEMENTATION STATE
Treat the current repository as source of truth, then verify it. These are strong priors, not assumptions you may blindly trust:

1. Privacy-first diagnostics exist.
- Minimal lead/event storage by default.
- Opt-in archive path exists.
- Consent-gated CRM sync exists.
- Retention infrastructure exists.

2. Architecture review is booking-first.
- Free review stays free.
- Result email includes an itemized implementation estimate.
- One booking CTA only.
- No pay-now link in the architecture email.

3. Internal architecture rule catalog exists.
- Founder-managed pricing/copy/research layer exists.
- Runtime uses published overrides where available.

4. A free-plan-compatible scheduler model exists.
- Vercel handles daily retention.
- GitHub Actions handle higher-frequency queue/sync work.
- Calendly booked-call sync currently relies on a PAT-backed poller rather than paid webhooks.

5. Billing infrastructure exists and has been partly proven.
- Checkout session creation works.
- Billing portal session creation works.
- Webhook fulfillment exists.
- Validator entitlements/credit usage exist.

KNOWN AUDIT CONTEXT FROM MARCH 25, 2026
Start by reading these files if they exist:
- `docs/launch-readiness-audit-summary-2026-03-25.md`
- `docs/launch-readiness-evidence-matrix-2026-03-25.md`
- `docs/launch-readiness-findings-queue-2026-03-25.md`
- `docs/launch-readiness-go-no-go-2026-03-25.md`
- `docs/launch-readiness-atlas-prompts-2026-03-25.md`

If those files exist, use them as previous context and verify whether they are still accurate.

KNOWN LIKELY BLOCKERS TO VERIFY FIRST
Do not assume these are still true. Verify them.

1. `app.zokorp.com` is likely healthy and production-capable.
2. `zokorp.com` and `www.zokorp.com` may still point to a stale Squarespace site rather than the live platform.
3. WorkDrive archival may still be provider-blocked with `402 PAYMENT_REQUIRED`.
4. A literal browser-completed Stripe test-mode checkout may still be unproven.
5. Real Calendly booked-call ingestion may still be unproven if no actual booking artifact exists.

YOUR JOB
Run a full prove-and-fix launch-readiness program. Do not stop at analysis. If you find small or medium fixes that improve production confidence safely, implement them.

WHEN TO ASK QUESTIONS
Ask the founder follow-up questions only when:
- a real business choice must be made and cannot be inferred safely
- a provider credential, booking alias, or email alias is needed and cannot be discovered locally
- a dashboard/manual step is unavoidable

If you need to ask questions, batch them tightly and keep them minimal. Otherwise proceed autonomously.

REQUIRED TOOLS AND WORKFLOW
1. Verify/install and use whatever CLI tools you need.
   Examples:
   - `gh`
   - `vercel`
   - `curl`
   - `jq`
   - Playwright or browser tooling
   - Stripe CLI if useful
   - mail or HTTP helpers
2. Use sub-agents in parallel for:
   - security/runtime review
   - user-journey proof
   - billing verification
   - docs/findings synthesis
3. Use MCP if it materially helps with provider or environment context.
4. Use primary sources for technical/provider claims.
5. Keep a running audit log in repo docs as you go.

AUDIT TRACKS TO EXECUTE

TRACK 1: Baseline and environment truth
- Freeze git state, deployment identity, domain routing, workflow schedules, secrets posture visibility, and CI status.
- Run:
  - `npm run lint`
  - `npm run typecheck -- --incremental false`
  - `npm test`
  - `npm run build`
  - production smoke checks
- Expand smoke coverage if current scripts are too thin.

TRACK 2: Public site, domains, and handoff
- Audit:
  - `zokorp.com`
  - `www.zokorp.com`
  - `app.zokorp.com`
- Verify:
  - redirects
  - SSL
  - canonical behavior
  - CTA consistency
  - copy alignment
  - whether public visitors reach the right product
- If the public root domain is stale or misleading, treat it as a launch blocker and either fix it or generate an Atlas prompt to fix it.

TRACK 3: Auth and account lifecycle
- Prove with real founder-controlled aliases if possible:
  - register
  - verify email
  - login
  - logout
  - password reset
  - protected page redirects
  - admin boundary enforcement
- Check `/account`, `/account/billing`, and request tracking behavior.

TRACK 4: Free diagnostics and privacy
- Exercise all free tools in live-like conditions:
  - Architecture Diagram Reviewer
  - AI Decider
  - Landing Zone Readiness Checker
  - Cloud Cost Leak Finder
- Verify default minimal-storage path and opt-in path where relevant.
- Confirm:
  - result delivery
  - consent-gated behavior
  - admin/operator visibility
  - retention path health
  - privacy-page honesty

TRACK 5: Architecture review flagship funnel
- Prove end to end:
  - submission
  - processing
  - status/result
  - email quality
  - estimate wording
  - single booking CTA
  - booked-call ingestion
  - resulting service request and operator visibility
- If no real booking exists, create the smallest safe test artifact or produce the exact Atlas prompt needed.

TRACK 6: Billing and paid validator
- Use Stripe test mode only.
- Prove:
  - checkout session creation
  - hosted checkout browser flow if possible
  - signed webhook fulfillment
  - entitlement/credit mutation
  - validator consumption
  - decrement enforcement
  - billing portal access
  - server-side protection against hidden/unauthorized prices
- Treat any unproven paid path as a major launch caveat.

TRACK 7: Admin and operator readiness
- Audit:
  - readiness page
  - leads dashboard
  - CSV export
  - service requests
  - product and price admin surfaces
  - architecture catalog admin
- Prove every scheduled job has:
  - a recent successful run
  - a manual replay path
  - correct secrets/config references
  - clear failure visibility

TRACK 8: Security and resilience
- Run a focused production-facing security pass.
- Include:
  - authz
  - secret fallback coupling
  - internal route protection
  - Stripe webhook verification
  - upload/file abuse surface
  - admin export leakage
  - CSP and security headers
  - cache behavior on sensitive routes
  - docs/config/runtime drift
- If a fix is small and safe, implement it.
- If not, document it with severity and exact impact.

DECISION RULES
- P0/P1 or launch blocker: fix immediately if safe.
- P2 and small/low-risk: fix during the pass if it improves confidence.
- Larger items: document clearly and defer only if the product can still be honestly marketed/tested.

REQUIRED OUTPUTS
Create or update the following in `docs/`:
- a master audit summary
- a detailed evidence matrix
- a prioritized findings queue labeled `P0` / `P1` / `P2` / `P3`
- a launch gate / go-no-go checklist
- Atlas prompts for manual/dashboard-only tasks
- a concise operator handoff if anything still needs human action

ALSO REQUIRED IN YOUR FINAL RESPONSE
Your final response must include:

1. A blunt readiness verdict:
   - `ready`
   - `ready with named caveats`
   - or `not ready`

2. The top 5 launch blockers or caveats, in founder language.

3. What you fixed during the run.

4. What still requires a human or Atlas.

5. The shortest path to "safe to market publicly."

6. Any test artifacts or production data artifacts you created.

FOLLOW-UP QUESTION POLICY
Before doing major external-flow testing, ask only the minimum questions needed, such as:
- which founder-controlled email aliases are safe to use
- whether a Stripe test-mode browser purchase is acceptable now
- whether a real Calendly booking should be created for proof
- whether you may modify public-domain routing if you discover the root domain is still stale

DEEP RESEARCH POLICY
If external research is needed for provider behavior, legal wording, current platform limits, or launch strategy:
- browse official primary sources first
- if deeper synthesis would help, produce a single precise Deep Research prompt
- say exactly what artifact you need returned

STARTING ORDER
1. Read the existing launch-readiness docs if present.
2. Snapshot git/deployment/workflow/domain truth.
3. Run the local validation stack.
4. Verify the live domains and determine immediately whether the public root domain is a blocker.
5. Continue through the audit tracks and fix what is fixable.

Do not give me a plan and stop. Execute the audit and ship improvements.
```
