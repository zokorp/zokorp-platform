# Repo Hardening Backlog

Source of truth for repository hardening tasks and run-by-run verification.

## Priority Checklist
- [x] Fix callbackUrl open redirects on login/register.
- [x] Replace request-driven architecture-review processing with a durable worker or queue model.
- [x] Decouple public pages from auth-driven dynamic rendering.
- [x] Make typecheck independent from `.next` artifacts.
- [x] Move CSP to `Content-Security-Policy-Report-Only` first and align GA and Stripe domains while removing `unsafe-inline` and `unsafe-eval` where possible.
- [x] Block placeholder Stripe prices and dead checkout states.
- [ ] Replace in-memory rate limiting with a shared store.
- [ ] Remove silent catalog and account fallbacks that hide failures.
- [ ] Make sitemap deterministic.
- [ ] Split `/software/[slug]` central dispatch into per-tool routes with a manifest-driven catalog.
- [ ] Extract large tool forms into feature-local sections.
- [ ] Add active nav state.
- [ ] Add field-level accessibility and consistent loading and error states.
- [ ] Add request IDs and safe error envelopes to all API routes.
- [ ] Add route tests for auth, billing, service requests, validator, landing-zone, and architecture-review endpoints.
- [ ] Add browser smoke tests for login, software, services, and one tool flow.
- [ ] Wire in central env validation and remove dead env code.
- [ ] Stop reusing `ARCH_REVIEW_EML_SECRET` as the auth secret.
- [ ] Harden Stripe customer creation and webhook idempotency.

## Run Log
### 2026-03-08 (run 8)
- Completed: `block placeholder Stripe prices and dead checkout states`.
- Scope:
  - added shared strict Stripe price ID gate in [`lib/stripe-price-id.ts`](/Users/zohaibkhawaja/Documents/Codex/zokorp-platform/lib/stripe-price-id.ts)
  - blocked placeholder/malformed IDs in checkout API route before session creation
  - blocked invalid Stripe price IDs in admin create-price action
  - replaced fallback catalog IDs from `price_*_placeholder` to `unconfigured-*` to prevent accidental checkout-enable states
  - updated software and admin UI checks to use shared validator
  - added unit coverage in [`tests/stripe-price-id.test.ts`](/Users/zohaibkhawaja/Documents/Codex/zokorp-platform/tests/stripe-price-id.test.ts)
- Preflight:
  - path used: fallback (no `scripts/network-preflight.sh` present)
  - git remote reachability: ❌ `git ls-remote --heads origin` failed (`Could not resolve host: github.com`)
  - npm registry reachability: ❌ `curl -I --max-time 15 https://registry.npmjs.org` failed (`Could not resolve host: registry.npmjs.org`)
  - fetch/sync: ❌ `git fetch origin --prune` failed (`Could not resolve host: github.com`), continued with local refs
- Verification:
  - `npm run lint` ✅
  - `npm run typecheck` ❌ (`lib/utils.ts`: cannot find modules `clsx` and `tailwind-merge`)
  - stopped remaining checks per automation rule after first failure (`npm test`, `npm run build` not run)
- Git/PR status:
  - branch: `codex/block-placeholder-stripe-prices`
  - commit: `308158c`
  - push: ❌ (`Could not resolve host: github.com`)
  - PR update/create: ❌ (`error connecting to api.github.com`)

### 2026-03-08 (run 7)
- Completed: `replace request-driven architecture-review processing with a durable worker or queue model`.
- Verification:
  - `npm run lint` ❌ (`sh: eslint: command not found`)

### 2026-03-08 (run 6)
- Completed: `move CSP to Content-Security-Policy-Report-Only first and align GA and Stripe domains while removing unsafe-inline and unsafe-eval where possible`.
- Verification:
  - `npm run lint` ✅
  - `npm run typecheck` ❌ (`lib/utils.ts`: missing modules `clsx` and `tailwind-merge`)

### 2026-03-07 (run 4)
- Completed: `make typecheck independent from .next artifacts`.
- Verification:
  - `npm run lint` ✅
  - `npm run typecheck` ✅
  - `npm test` ✅
  - `npm run build` ❌ (Google Fonts fetch blocked by restricted network)
