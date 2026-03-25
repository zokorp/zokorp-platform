# Target Stack and Accounts

## Current stack
- Primary app: Next.js 16 App Router on Vercel project `zokorp-web`
- Backend data: Prisma + Postgres
- Auth: NextAuth credentials auth with business-email verification
- Billing: Stripe Checkout, webhook fulfillment, and Customer Portal
- Lead ops: Zoho CRM sync (opt-in only)
- Optional archival: Zoho WorkDrive hooks for architecture-review follow-up archives
- Booking: external Calendly booking URL + GitHub Actions poller for booked-call ingestion
- Scheduler model:
  - Vercel cron: daily retention sweep only
  - GitHub Actions: architecture worker drain, Calendly sync, Zoho sync, follow-up jobs

## Canonical live surfaces
- Public marketing domain today: `https://www.zokorp.com`
- Apex redirect today: `https://zokorp.com` -> `https://www.zokorp.com/`
- Platform app: `https://app.zokorp.com`
- Vercel default domain: `https://zokorp-web.vercel.app`

## Accounts and identifiers
- GitHub repo: `https://github.com/leggoboyo/zokorp-platform`
- GitHub owner: `leggoboyo`
- Vercel team/account: `leggoboyos-projects`
- Vercel project: `zokorp-web`
- Calendly booking URL in production:
  - `https://calendly.com/zkhawaja-zokorp/zokorp-architecture-review-follow-up`

## Verified production state (2026-03-25 CDT)
- Production Vercel alias `app.zokorp.com` is live and serving the current platform build.
- `zokorp.com` / `www.zokorp.com` still serve the legacy Squarespace marketing site, not the Vercel app.
- Password registration, email verification, password login, password reset, and verified-business-email gating are live.
- Free tools are live and delivering results by email.
- Architecture review is live as a booking-first free flow with implementation estimates by email.
- GitHub Actions scheduler jobs are active for:
  - `Drain Architecture Review Queue`
  - `Sync Calendly Booked Calls`
  - `Sync Leads To Zoho`
  - `Send Architecture Review Follow-ups`
- Vercel cron is active only for:
  - `/api/internal/cron/retention-sweep`

## Manual-provider realities still in force
- WorkDrive archival is code-ready but currently blocked by provider/account limits when archival is requested.
- Stripe live-mode commercial posture, refund policy, tax/legal review, and dashboard-owned settings remain human-owned.
- The public marketing domain handoff from Squarespace to the Vercel app is still a manual/DNS/platform decision.

## Launch-shaping implications
- `app.zokorp.com` is the source of truth for product readiness.
- `www.zokorp.com` is currently the biggest public-facing mismatch because it does not reflect the current platform positioning or services flow.
- Any “ready to market” decision should treat domain unification, WorkDrive archival expectations, and live billing proof as explicit gates rather than assumptions.
