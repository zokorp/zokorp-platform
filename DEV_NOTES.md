# UI Audit Notes

> **Updated 2026-05-22.** Most of the UI debt this file used to describe has been worked off. Keep this doc honest about what's still rough vs. what's already shared.

## Where the shared layer lives today

- **Primitive components** (`components/ui/`): `alert`, `badge`, `button`, `card`, `input`, `progress`, `radio-card`, `select`, `skeleton`, `step-indicator`, `tabs`, `textarea`, `timeline-card`, `tool-page-layout`. All authored as typed variants with `class-variance-authority`-style patterns; pages should reach for these rather than reinventing styled divs.
- **Marketing layout primitives** (`components/marketing/`): `about-reveal`, `case-study-card`, `founder-profile-card`, `founder-proof-block`, `learn-more`, `marketing-hero`, `pricing-catalog-shell`, `privacy-stance`, `proof-numbers-strip`, `reveal`, `section-heading`, `service-offer-row`. New marketing surfaces should compose from these rather than build bespoke layouts.
- **Site chrome**: `components/site-header.tsx` + `components/site-header-shell.tsx` provide a fully-built desktop and mobile navigation experience — focus-trapped drawer, ARIA-correct, escape-key + outside-click dismissal, body-scroll lock. `components/site-footer.tsx` mirrors the same shared-card discipline.

## What's still inconsistent

- Tool-form pages still hold their own large local state machines (`ArchitectureDiagramReviewerForm.tsx` ~1985 LOC, `validator/ValidatorForm.tsx` ~957 LOC). Step indicators come from `components/ui/step-indicator`, but the wrapping flow + success-state copy is still per-tool. Cross-tool consolidation would be valuable, not urgent.
- `app/globals.css` still mixes semantic tokens with a handful of page-specific effects. Most of it is now CSS variables, but a few one-off hero treatments and gradient surfaces are inline rather than in the token layer.
- Admin pages (`app/admin/*`) use the primitives but feel less unified than marketing — most pages compose `Card` + raw tables. A shared `AdminTable` or `AdminSection` primitive could pull them into a more consistent shell, but the current state is functional.

## Retired tool references — do not reintroduce

The following tools were retired and their component directories deleted:
- `components/landing-zone-readiness/*`
- `components/cloud-cost-leak-finder/*`

Their product records remain in the DB with `active: false` (see `prisma/seed.js`) so historical purchase/audit references stay valid. Do not reintroduce these surfaces.

## When something feels off

- Reach for an existing primitive first; if the variant you need does not exist, add a variant to the primitive rather than a one-off styled div.
- For marketing copy changes, edit `lib/marketing-content.ts` and `lib/marketing-proof.ts` rather than touching JSX directly so the smoke contract (`scripts/playwright_audit_contract.mjs`) keeps matching reality.
- For pricing-card or product-catalog visuals, look at `components/marketing/pricing-catalog-shell.tsx` and `components/software-catalog-shell.tsx` before editing pages.
