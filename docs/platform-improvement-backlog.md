# Platform Improvement Backlog

This file is the long-lived backlog for the `ZoKorp release hardening` automation.

## Status legend

- `[TODO][AUTO]` means the automation should eventually do the item.
- `[TODO][MANUAL]` means the item needs human input, external approvals, or external credentials.
- `[DONE]` means the item is complete.
- `[BLOCKED]` means the item is actionable in theory but currently blocked by something external.
- `[DEFERRED]` means the item is intentionally postponed or superseded.

## Processing rules

1. Work from top to bottom.
2. Take exactly one `[TODO][AUTO]` item per run.
3. After finishing an item, change its status and add a short evidence note directly below it.
4. Do not reorder the backlog unless there is a strong reason and the note explains why.
5. Skip `[TODO][MANUAL]` items until the required human input exists.

## Critical

- [DONE] CRIT-001 Create a shared client-side architecture-review evidence schema so the browser can submit extracted signals instead of raw diagram files. Done when: the schema exists in shared types, is validated on both client and server, and covers OCR text, detected components, provider hints, and user-supplied context.
  - Evidence: Added `clientExtractedEvidence` schema in shared architecture-review types, validated it in browser submit logic and server metadata parsing, and added schema/form tests that cover OCR text, detected components, provider hints, and user-supplied context.
- [DONE] CRIT-002 Implement browser-side PNG text extraction for the Architecture Diagram Reviewer. Done when: PNG OCR runs in the browser, progress is visible in the UI, and no server OCR is required for PNG uploads.
  - Evidence: Added browser PNG OCR extraction with in-form progress updates, submit metadata now carries `clientPngOcrText`, and server job processing now requires/uses client PNG OCR evidence instead of server OCR.
- [DONE] CRIT-003 Implement browser-side SVG text and dimension extraction for the Architecture Diagram Reviewer. Done when: SVG parsing runs in the browser and produces the same or better evidence than the current server path.
  - Evidence: Browser SVG extraction now persists `clientSvgText` and `clientSvgDimensions` in submit metadata, the job processor consumes client SVG text evidence first (with safe legacy fallback), and schema/form tests were updated to cover the new metadata fields.
- [TODO][AUTO] CRIT-004 Change the Architecture Diagram Reviewer submit flow so the server receives structured extracted evidence rather than the raw uploaded diagram. Done when: the submit API no longer requires raw diagram bytes for normal review processing.
- [TODO][AUTO] CRIT-005 Remove `diagramBytes` persistence from the architecture-review job model and add the required Prisma migration. Done when: raw diagram bytes are no longer stored in Postgres and the schema, code, and tests are updated.
- [TODO][AUTO] CRIT-006 Remove server-side `tesseract.js` from the architecture-review processing path once the browser path is complete. Done when: the review job can run end to end without server OCR for the supported file types.
- [DONE] CRIT-007 Rework the Architecture Diagram Reviewer progress UX to reflect browser preprocessing plus server scoring instead of a fake local-model phase. Evidence: removed the fake `llm-refine` runtime phase from `lib/architecture-review/jobs.ts`, updated visible phase labels/descriptions in `components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm.tsx`, and added regression coverage in `tests/architecture-review-form.test.tsx`.
- [DONE] CRIT-008 Standardize a single verified-business-email access strategy for all free tools. Done when: each free tool follows the same rule for account creation, verification, and result delivery.
  - Evidence: Added a canonical policy doc in `docs/free-tool-access-policy.md`, required a signed-in verified business-email account for all free consulting-style diagnostics, and updated the shared/dedicated tool pages so the UI and server now follow the same rule.
- [DONE] CRIT-009 Build a shared free-tool access gate component that explains why business-email verification is required and reuses account context consistently. Done when: Architecture Review, AI Decider, Landing Zone, and Cloud Cost use the same gate.
  - Evidence: Added `components/free-tool-access-gate.tsx` and applied it to Architecture Review, AI Decider, Landing Zone Readiness, and Cloud Cost so each tool now explains the verified-account requirement with shared sign-in/register behavior.
- [DONE] CRIT-010 Ensure no free tool sends consulting output to an unverified account. Done when: verified-business-email checks are enforced server-side for every quote-delivery path.
  - Evidence: Added `requireVerifiedFreeToolAccess` in `lib/free-tool-access.ts`, wired it into the AI Decider, Landing Zone Readiness, and Cloud Cost submission routes, and added route tests proving unverified access is rejected before persistence or email delivery.
- [TODO][AUTO] CRIT-011 Create a shared deterministic quote line-item schema for all diagnostic tools. Done when: every tool quote can render labeled line items, low/high amounts, and reasons from one typed contract.
- [TODO][AUTO] CRIT-012 Add itemized quote generation to AI Decider using the shared quote schema. Done when: the email and stored quote include line items instead of a range-only summary.
- [TODO][AUTO] CRIT-013 Add itemized quote generation to Landing Zone Readiness using the shared quote schema. Done when: the email and stored quote include deterministic line items instead of a range-only summary.
- [TODO][AUTO] CRIT-014 Standardize Architecture Diagram Reviewer quote packaging onto the same shared quote schema. Done when: architecture-review quote output, storage, and email rendering align with the other tools.
- [TODO][AUTO] CRIT-015 Persist lead consent and outreach preferences separately from the core submission payload. Done when: the data model can distinguish operational-result email from future marketing follow-up.
- [TODO][AUTO] CRIT-016 Add an unsubscribe and email-preferences flow that works across all diagnostic tools. Done when: emails include a functioning preference path and the backend respects opt-out state.
- [TODO][AUTO] CRIT-017 Rewrite the public privacy page so it accurately covers account verification, lead capture, result delivery, marketing follow-up, and data retention. Done when: the privacy page matches actual system behavior and references preference controls.
- [TODO][AUTO] CRIT-018 Rewrite the public terms/support/refund policy surfaces for public launch readiness. Done when: the public site clearly covers service scoping, refund posture, support expectations, and tool-output disclaimers.
- [TODO][AUTO] CRIT-019 Create a real internal lead dashboard that shows free-tool leads across all tools. Done when: an admin can see lead source, tool used, verification state, quote tier, email status, and next action in one place.
- [TODO][AUTO] CRIT-020 Add admin visibility for email delivery failures, CRM sync failures, and retry state across all tool submissions. Done when: staff can identify and reprocess failures without querying the database directly.
- [TODO][AUTO] CRIT-021 Create a registry-driven `ToolDefinition` contract for all software tools. Done when: tool metadata, auth mode, pricing mode, renderer, and submission strategy are declared in one registry shape.
- [TODO][AUTO] CRIT-022 Refactor the generic `/software/[slug]` page to render from the shared tool registry instead of hardcoded slug branches. Done when: adding a tool does not require editing central branching logic.
- [TODO][AUTO] CRIT-023 Move Cloud Cost Leak Finder into the registry-driven `/software/[slug]` path so all tools follow the same route architecture. Done when: the dedicated cloud-cost page is no longer a special-case route.
- [TODO][AUTO] CRIT-024 Add a documented scaffold path for new software tools so future Codex threads can add tools with minimal central edits. Done when: a new tool can be created from a repeatable template and registry entry.
- [DONE][AUTO] CRIT-025 Add a static fallback catalog for public software and pricing pages when the database catalog is unavailable. Evidence: `lib/catalog.ts` now returns a static public catalog for core offerings when `DATABASE_URL` is missing or the DB query fails, `tests/catalog.test.ts` covers the fallback, and local smoke keeps `/software/architecture-diagram-reviewer` plus `/software/landing-zone-readiness-checker` available without DB-backed catalog data. Done when: the site still shows core public offerings even if the DB is down or not configured.
- [TODO][AUTO] CRIT-026 Add account-history surfaces for all free-tool submissions so a verified user can see what they ran and what was emailed. Done when: account pages expose tool runs, timestamps, statuses, and quote summaries.
- [TODO][AUTO] CRIT-027 Create a consistent email outbox and retry model for AI Decider, Landing Zone, and Cloud Cost similar to the architecture-review pipeline. Done when: result delivery is durable and retryable across tools.
- [TODO][AUTO] CRIT-028 Add health reporting for the scheduled architecture worker, follow-up sender, and Zoho sync jobs. Done when: the repo has a documented and inspectable way to detect stale scheduled automation.
- [TODO][AUTO] CRIT-029 Build a shared “consulting quote package” renderer so all diagnostic tools email a consistent result structure. Done when: emails share a unified format for findings, line items, CTA, and follow-up expectations.
- [TODO][AUTO] CRIT-030 Keep the automation itself backlog-driven and self-terminating. Done when: the automation reads this file, updates statuses, and pauses itself when no `[TODO][AUTO]` items remain.

## High

- [TODO][AUTO] HIGH-001 Add PR auto-labeling and auto-merge behavior to the automation branch workflow. Done when: automation-created PRs receive a predictable label and can merge automatically when checks pass.
- [TODO][AUTO] HIGH-002 Add GitHub Actions inspection guidance to the automation flow so it waits on CI intelligently instead of guessing. Done when: the playbook and prompt describe when to inspect checks, wait, merge, or stop.
- [TODO][AUTO] HIGH-003 Add a shared analytics helper for all tool flows rather than ad hoc `gtag` snippets in each component. Done when: event tracking is centralized and typed.
- [TODO][AUTO] HIGH-004 Add missing analytics instrumentation to AI Decider. Done when: page view, form start, completion, email sent, and consultation CTA clicks are tracked for AI Decider like the other tools.
- [TODO][AUTO] HIGH-005 Normalize analytics event names across all diagnostic tools. Done when: the same conversion concepts use the same event taxonomy everywhere.
- [TODO][AUTO] HIGH-006 Capture UTM, referrer, and landing-page source metadata consistently for every lead-generating tool. Done when: each submission stores comparable source attribution fields.
- [TODO][AUTO] HIGH-007 Persist lead-source metadata consistently across AI Decider, Landing Zone, Cloud Cost, Architecture Review, and service requests. Done when: internal reporting can compare acquisition quality across entry points.
- [TODO][AUTO] HIGH-008 Add structured data for Organization, Service, and SoftwareApplication pages. Done when: public marketing pages and tool pages expose richer search-engine metadata.
- [TODO][AUTO] HIGH-009 Add tool-specific Open Graph and Twitter metadata so each tool has a distinct share preview. Done when: each tool page can be shared with relevant title, description, and image.
- [TODO][AUTO] HIGH-010 Rewrite the home page around ZoKorp Consulting as a business, not just “ZoKorp Platform.” Done when: the hero, value proposition, and CTAs clearly sell the consulting business and lead funnel.
- [TODO][AUTO] HIGH-011 Rewrite the about page around founder credibility, consulting positioning, and platform strategy. Done when: the page reads like a serious consulting-business about page instead of a generic platform description.
- [TODO][AUTO] HIGH-012 Replace or relabel placeholder case studies so the site does not overstate proof. Done when: placeholder content is clearly labeled or the page is rebuilt around real or safely framed examples.
- [TODO][AUTO] HIGH-013 Publish clearer service packages with example outcomes and pricing anchors. Done when: visitors can understand what paid help looks like before contacting ZoKorp.
- [TODO][AUTO] HIGH-014 Add a dedicated proof or portfolio section on the home and services pages. Done when: the site communicates evidence, process, and trust better than it does today.
- [TODO][AUTO] HIGH-015 Add a founder/contact CTA section to all major conversion pages. Done when: each high-intent page has an obvious next step to book or request help.
- [TODO][AUTO] HIGH-016 Add an internal admin page focused on free-tool leads and quote pipeline progression. Done when: admins can filter and manage diagnostic leads separately from service requests.
- [TODO][AUTO] HIGH-017 Add admin actions to retry email sends and CRM syncs. Done when: staff can recover failed operations without direct database edits.
- [TODO][AUTO] HIGH-018 Add account-page visibility for quote history and tool-result summaries. Done when: verified users can review what they were quoted and when.
- [TODO][AUTO] HIGH-019 Standardize a shared email wrapper template across all result emails. Done when: brand, trust copy, support links, and footer behavior are consistent.
- [TODO][AUTO] HIGH-020 Add unsubscribe and preferences links to all email templates. Done when: every result email footer reflects the real preference flow.
- [TODO][AUTO] HIGH-021 Add duplicate-submission detection to AI Decider. Done when: near-identical resubmissions can reuse prior results or present a clear duplicate message.
- [TODO][AUTO] HIGH-022 Add duplicate-submission detection to Cloud Cost Leak Finder. Done when: near-identical resubmissions are handled gracefully instead of generating noisy duplicate records.
- [TODO][AUTO] HIGH-023 Add abuse-prevention strategy for free tools beyond business-email filtering. Done when: bot friction, spam resistance, and rate-limit behavior are stronger and documented.
- [TODO][AUTO] HIGH-024 Add better rate-limit telemetry and admin visibility for diagnostic tools. Done when: operators can tell whether legitimate users or abuse traffic are hitting limits.
- [TODO][AUTO] HIGH-025 Fix password-reset URL generation to use request-aware origin logic. Done when: reset flows work cleanly in production, preview, and staging environments.
- [TODO][AUTO] HIGH-026 Server-render the header auth state rather than resolving it only on the client. Done when: signed-in users no longer see a logged-out flash in the site header.
- [TODO][AUTO] HIGH-027 Server-render the service-request panel auth state instead of relying on client fetch only. Done when: the services page reflects account state without a client-only correction pass.
- [TODO][AUTO] HIGH-028 Add production smoke verification to post-merge or pre-merge workflows where environment variables permit it. Done when: public-route regressions are easier to catch outside local unit tests.
- [TODO][AUTO] HIGH-029 Add a health/readiness document for scheduled GitHub workflows and required secrets. Done when: the repo clearly documents how queue drain, follow-ups, lead sync, and auto-merge work.
- [TODO][AUTO] HIGH-030 Remove the unused `@mlc-ai/web-llm` dependency if a real local refinement step is not being shipped. Done when: package usage matches actual behavior.
- [TODO][AUTO] HIGH-031 Or implement a real client-side local refinement step and make the UI truthful. Done when: the “local model refinement” phase corresponds to actual browser-side model logic.
- [TODO][AUTO] HIGH-032 Add tool-specific admin filters and search across submission tables. Done when: staff can filter by tool, company, email status, CRM sync status, and date.
- [TODO][AUTO] HIGH-033 Add a manual quote override path for admin follow-up without mutating the original deterministic result. Done when: staff can issue a revised consulting quote while preserving the original calculation.
- [TODO][AUTO] HIGH-034 Add clear support and contact-response expectations to public pages and result emails. Done when: customers know what happens after they request help or reply to a result.
- [TODO][AUTO] HIGH-035 Add a single-source-of-truth legal and policy decision document that the public pages can track against. Done when: the repo no longer has scattered unresolved policy notes.

## Medium

- [TODO][AUTO] MED-001 Extract shared wizard primitives for the free diagnostic tools. Done when: stepper layouts, button rows, validation messaging, and summary cards come from reusable components.
- [TODO][AUTO] MED-002 Extract shared business-email validation and explanatory copy. Done when: all diagnostic tools explain business-email requirements consistently.
- [TODO][AUTO] MED-003 Share the common lead-capture field set for full name, company, role, website, and email. Done when: overlapping forms reuse a common schema and UI.
- [TODO][AUTO] MED-004 Share quote-email sections instead of duplicating structure across each tool email builder. Done when: line-item rendering, CTA blocks, and footer text are reusable.
- [TODO][AUTO] MED-005 Standardize post-submit success state cards across free tools. Done when: result-complete states feel coherent across AI, cloud, readiness, and architecture flows.
- [TODO][AUTO] MED-006 Add route smoke tests for all public pages and major tool pages. Done when: basic render-path regressions are covered by automated checks.
- [TODO][AUTO] MED-007 Add unit tests for the registry-driven tool contract and route selection. Done when: future tool additions cannot silently break the shared software page.
- [TODO][AUTO] MED-008 Add unit tests for shared quote line-item generation. Done when: quote calculations have regression protection across tools.
- [TODO][AUTO] MED-009 Add tests for consent-preference persistence and unsubscribe handling. Done when: preference changes are validated by automated tests.
- [TODO][AUTO] MED-010 Add tests for email-fallback behavior across free tools. Done when: failure paths are predictable and covered.
- [TODO][AUTO] MED-011 Add tests for scheduled worker endpoint authentication and behavior. Done when: the secret-protected queue/follow-up endpoints have regression coverage.
- [TODO][AUTO] MED-012 Add coverage reporting to CI. Done when: CI publishes a coverage metric or artifact for the test suite.
- [TODO][AUTO] MED-013 Add environment validation for required scheduled-job secrets. Done when: missing worker or follow-up configuration becomes visible before runtime surprises.
- [TODO][AUTO] MED-014 Add admin surfacing for missing or invalid environment configuration. Done when: critical operational config issues are visible from the app.
- [TODO][AUTO] MED-015 Improve tool-not-found and 404 experiences with better recovery CTAs. Done when: missing routes guide users back to software, services, or contact.
- [TODO][AUTO] MED-016 Add a static public catalog snapshot generation option. Done when: product marketing pages can fall back to generated data rather than failing fully when DB access is absent.
- [TODO][AUTO] MED-017 Add better SEO copy on the pricing page for consulting packages and conversion intent. Done when: pricing explains service value and next steps more clearly.
- [TODO][AUTO] MED-018 Normalize location and contact wording across all public pages and docs. Done when: the site no longer sends mixed messages about geography or contact identity.
- [TODO][AUTO] MED-019 Expand the contact page into a real business contact surface. Done when: it shows the best contact path, response expectations, and what to send.
- [TODO][AUTO] MED-020 Separate support, consultation, and sales motions more clearly in the navigation and page copy. Done when: visitors know which path fits their intent.
- [TODO][AUTO] MED-021 Add a founder bio and credibility block. Done when: the site feels more like a consulting business and less like an anonymous platform.
- [TODO][AUTO] MED-022 Add an FAQ covering free tools, paid services, and how quotes are produced. Done when: common objections are answered on-site.
- [TODO][AUTO] MED-023 Add methodology pages or expandable sections for scoring logic. Done when: the tools can explain how deterministic scores and quotes are created.
- [TODO][AUTO] MED-024 Document exact pricing rationale per tool in the repo. Done when: future edits do not lose the logic behind quote tiers and line items.
- [TODO][AUTO] MED-025 Document how to add a new software tool end to end. Done when: a future Codex thread can onboard a new tool with clear steps.
- [TODO][AUTO] MED-026 Document the analytics taxonomy and event definitions. Done when: conversions and funnel metrics have stable names and meanings.
- [TODO][AUTO] MED-027 Document the lead lifecycle and Zoho field mapping. Done when: operators can trace a lead from form submission through follow-up.
- [TODO][AUTO] MED-028 Document email delivery fallback behavior and recovery actions. Done when: ops guidance exists for failed sends and fallback drafts.
- [TODO][AUTO] MED-029 Add CSV export for admin lead views. Done when: operators can export leads without direct database access.
- [TODO][AUTO] MED-030 Add admin filters by tool, date, CRM sync status, email status, and quote tier. Done when: admins can slice operational data efficiently.
- [TODO][AUTO] MED-031 Add service-request filters, notes, and lifecycle management. Done when: service requests can be triaged and tracked cleanly.
- [TODO][AUTO] MED-032 Add internal audit views for purchases, entitlements, and leads. Done when: operators can correlate a customer account with software purchases and lead history.
- [TODO][AUTO] MED-033 Improve empty states across account and admin views. Done when: zero-data states still explain what users or admins can do next.
- [TODO][AUTO] MED-034 Improve mobile UX for all multi-step free-tool forms. Done when: touch targets, step transitions, and copy density work well on mobile.
- [TODO][AUTO] MED-035 Run an accessibility pass on forms, nav menus, and success states. Done when: keyboard flow, labels, alerts, and focus handling are stronger.
- [TODO][AUTO] MED-036 Standardize loading, skeleton, and progress states across public pages and tools. Done when: perceived performance and UX consistency improve.
- [TODO][AUTO] MED-037 Standardize API error copy across diagnostic submission routes. Done when: server errors are consistent, useful, and non-leaky.
- [TODO][AUTO] MED-038 Add a compare-software-vs-services explanation on relevant pages. Done when: visitors understand when to self-serve versus engage consulting help.
- [TODO][AUTO] MED-039 Add a results-summary landing pattern for tools that intentionally keep details off-page. Done when: post-submit states still feel informative without dumping the full report on-screen.
- [TODO][AUTO] MED-040 Add admin visibility for follow-up cadence and CTA click progression. Done when: operators can see whether leads moved from “new” to “email sent” to “CTA clicked” to “call booked.”

## Low

- [TODO][AUTO] LOW-001 Clean unused files and dead dependencies. Done when: the repo no longer carries clearly unused code or packages.
- [TODO][AUTO] LOW-002 Tighten metadata consistency across public pages. Done when: titles, descriptions, canonical URLs, and social previews follow a coherent pattern.
- [TODO][AUTO] LOW-003 Expand sitemap coverage and ensure all public routes are represented intentionally. Done when: sitemap output matches the intended public surface.
- [TODO][AUTO] LOW-004 Review robots behavior and crawl posture. Done when: indexing posture is explicit and aligned with launch intent.
- [TODO][AUTO] LOW-005 Polish the media listing and article detail experience. Done when: media pages contribute to credibility and shareability.
- [TODO][AUTO] LOW-006 Add richer structured data to media/article pages. Done when: article pages expose proper metadata for search and sharing.
- [TODO][AUTO] LOW-007 Create an insights or updates content strategy note in the repo. Done when: future site content has a clearer direction than ad hoc pages.
- [TODO][AUTO] LOW-008 Add a dedicated page comparing software, diagnostics, and consulting engagement options. Done when: visitors can self-segment by need.
- [TODO][AUTO] LOW-009 Add testimonial and logo-wall scaffolding so real proof can be dropped in later. Done when: the site has a place for social proof without fake content.
- [TODO][AUTO] LOW-010 Add a founder FAQ section. Done when: common “why ZoKorp?” questions are answered in one place.
- [TODO][AUTO] LOW-011 Add downloadable sample deliverable placeholders or templates where appropriate. Done when: the services side of the business feels more concrete.
- [TODO][AUTO] LOW-012 Add a reusable case-study template. Done when: future real case studies can be published consistently.
- [TODO][AUTO] LOW-013 Tighten design-token and spacing consistency. Done when: visual rhythm and component spacing feel more systematic.
- [TODO][AUTO] LOW-014 Review button hierarchy and CTA emphasis across all major pages. Done when: the primary next step is visually obvious everywhere.
- [TODO][AUTO] LOW-015 Improve motion timing and reduced-motion behavior. Done when: the site feels polished without being distracting.
- [TODO][AUTO] LOW-016 Add small-screen QA fixes to nav, hero, and card layouts. Done when: mobile pages feel intentional rather than compressed.
- [TODO][AUTO] LOW-017 Improve dashboard and admin card hierarchy. Done when: operational views are easier to scan.
- [TODO][AUTO] LOW-018 Add clearer “what happens next” copy to tool pages and results states. Done when: next steps are explicit.
- [TODO][AUTO] LOW-019 Add collapsible methodology details to tool pages where useful. Done when: power users can inspect scoring logic without cluttering the main flow.
- [TODO][AUTO] LOW-020 Create a changelog or product-updates page scaffold. Done when: future update emails can point somewhere public.
- [TODO][AUTO] LOW-021 Add a product-updates archive page scaffold. Done when: outreach has a destination beyond the inbox.
- [TODO][AUTO] LOW-022 Add an account preferences center UI once the backend flow exists. Done when: users can manage email preferences without support.
- [TODO][AUTO] LOW-023 Add account data-export request flow scaffolding. Done when: privacy operations have a visible path.
- [TODO][AUTO] LOW-024 Add account deletion or data-removal request flow scaffolding. Done when: privacy requests have a documented user-facing entry point.
- [TODO][AUTO] LOW-025 Add a data-retention policy document in the repo. Done when: retention choices for submissions, leads, and audit data are explicit.
- [TODO][AUTO] LOW-026 Add an internal roadmap view generated from the tool registry. Done when: planned software can be surfaced consistently from data instead of hardcoded cards.
- [TODO][AUTO] LOW-027 Add a marketing page for upcoming tools driven by planned registry entries. Done when: future tools can collect interest without custom page work.
- [TODO][AUTO] LOW-028 Add issue templates and PR templates tuned for this repo. Done when: contribution hygiene is a bit stronger.
- [TODO][AUTO] LOW-029 Add a release checklist document for public changes. Done when: deploy-critical steps are easier to follow.
- [TODO][AUTO] LOW-030 Add a dependency maintenance cadence note. Done when: package update posture is explicit.

## Manual / Human-Required

- [TODO][MANUAL] MAN-001 Decide whether free tools should require full account creation before first use or allow result-only verification with later account upgrade. Done when: the business rule is explicit and documented.
- [TODO][MANUAL] MAN-002 Decide the final marketing-consent language and whether product updates should be opt-in or soft opt-in. Done when: the legal/business policy is approved.
- [TODO][MANUAL] MAN-003 Decide the refund policy for paid software and consulting work. Done when: the public policy is explicit.
- [TODO][MANUAL] MAN-004 Decide the support-response posture for software customers and consulting inquiries. Done when: support expectations are explicit.
- [TODO][MANUAL] MAN-005 Decide final public service packages and anchor prices. Done when: the site can publish stable service-package language.
- [TODO][MANUAL] MAN-006 Decide final Stripe live-mode products, prices, and tax posture. Done when: the public billing model is no longer placeholder-only.
- [TODO][MANUAL] MAN-007 Decide whether Zoho remains the long-term CRM or whether a simpler lead store is preferred. Done when: CRM direction is confirmed.
- [TODO][MANUAL] MAN-008 Provide or approve the founder bio, headshot, and final personal positioning copy. Done when: the about and home pages can reflect the real founder brand.
- [TODO][MANUAL] MAN-009 Provide the first real case study, client story, or safely anonymized engagement proof. Done when: the portfolio surface can move beyond placeholder examples.
- [TODO][MANUAL] MAN-010 Decide the final location and contact wording to avoid mixed geography references. Done when: public pages and docs use one canonical answer.
- [TODO][MANUAL] MAN-011 Decide the desired cadence and tone for future lead-nurture emails. Done when: marketing follow-up is intentional rather than implied.
- [TODO][MANUAL] MAN-012 Confirm whether Calendly or another direct booking path should be integrated. Done when: the booking CTA target is settled.
- [TODO][MANUAL] MAN-013 Verify all production secrets and scheduled-job URLs in GitHub and Vercel. Done when: queue drain, follow-ups, Zoho sync, and billing all have confirmed live config.
- [TODO][MANUAL] MAN-014 Decide whether the Architecture Diagram Reviewer should remain fully deterministic or include an optional real client-side model pass. Done when: the product stance is explicit.
- [TODO][MANUAL] MAN-015 Decide what counts as “resume mode” versus “revenue mode” for public positioning if the site needs to emphasize one first. Done when: messaging can optimize for a single primary goal.
