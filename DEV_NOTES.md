# UI Audit Notes

## Current patterns and inconsistencies
- The app already has a strong visual direction, but it is implemented through repeated Tailwind class strings instead of a reusable component system.
- `app/globals.css` mixes semantic intent with page-specific effects. Surfaces, chips, shadows, hero treatments, and focus handling are partly centralized and partly duplicated inline.
- Buttons, inputs, selects, alerts, badges, and cards each have multiple visual variants that are visually similar but implemented independently.
- Marketing pages, tool pages, account pages, and admin pages all use slightly different spacing, border, shadow, and CTA rules.
- Header navigation is crowded on desktop and has no dedicated mobile menu pattern. Footer content is solid but not aligned to a shared card/layout system.
- The tool workflows are functionally mature, but each one carries its own step indicators, radio-card treatment, progress UI, alert styling, and success-state structure.

## Duplicated component patterns
- Primary and secondary buttons are duplicated across header auth actions, auth forms, tool flows, checkout/portal buttons, service requests, and admin screens.
- Form controls are repeated across auth forms, service request form, validator, architecture reviewer, forecasting workspace, and admin pages.
- Alert states are repeated for success, warning, info, and error messaging with inconsistent padding and contrast choices.
- Card shells repeat in `surface`, `glass-surface`, `surface-muted`, and many inline border/background combinations.
- Step chips, status pills, entitlement notices, pricing cards, and request timeline rows all use one-off styling instead of shared primitives.

## Highest priority pages
1. `app/page.tsx`
   - Highest first-impression impact and the best place to establish spacing, hierarchy, and CTA consistency.
2. `app/software/page.tsx`
   - Core catalog surface with obvious opportunity for filtering, stronger card hierarchy, and more consistent pricing presentation.
3. `app/software/[slug]/page.tsx`
   - Main product-entry surface where entitlement messaging, pricing, and tool execution need one consistent shell.
4. Tool workflow components
   - `components/validator/ValidatorForm.tsx`
   - `components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm.tsx`
   - `components/mlops/ForecastingWorkspace.tsx`
   - Note: `landing-zone-readiness` and `cloud-cost-leak-finder` tools have been retired — the component directories have been removed and the product records are deactivated in `prisma/seed.js`.
5. `app/account/page.tsx`
   - Strong candidate for tabs and a clearer request/activity presentation.
6. `app/admin/products/page.tsx`, `app/admin/prices/page.tsx`, `app/admin/service-requests/page.tsx`
   - Secondary priority, but currently the least aligned with the rest of the product UX.
