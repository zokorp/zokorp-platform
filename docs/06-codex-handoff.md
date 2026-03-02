# Codex handoff (ZoKorp platform)

## Product goal
- Public marketing/portfolio site plus authenticated software products
- Monetization: one-time purchases, subscriptions, and future usage-based billing foundation

## Target architecture
- Frontend/deployment: GitHub repo (zokorp-platform) deployed via Vercel
- Backend: Supabase (Postgres + Auth + Storage)
- Payments: Stripe (test mode first)

## Public pages (preserve from current site)
- Home (hero, services, embedded video)
- About Us
- Our Services
- Blog
- Contact Us (CTA button on Home routes here)

## Auth/user accounts
- Supabase Auth (standard email-based auth; finalize exact provider options later)
- Ensure callback URLs are correct for Vercel preview and production

## Software catalog requirements
- Catalog page listing paid products, showing description + price + “Buy”/“Subscribe” CTA

## Access models
- One-time purchase unlocks access to a specific tool/product
- Subscription unlocks platform-level access
- Usage-based billing foundation: meter name `platform_usage_units` (pricing TBD)

## Billing portal requirement
- Use Stripe hosted billing portal for managing payment methods, subscriptions, invoices

## File upload requirement
- Supabase storage buckets planned: `public-media`, `private-uploads` (create once clearly needed)

## Admin/back-office needs
- Basic admin dashboard for managing users, entitlements, downloads/uploads, billing references

## Environment variables expected
See `/docs/03-environment-variables-template.md`

## External services already created
- GitHub: `zokorp-platform` (private) with `/docs` scaffolding
- DNS baseline: Squarespace-managed DNS with Squarespace defaults + Zoho MX/SPF/DKIM/DMARC + verification TXT records

## What Codex needs once available
- Supabase project details: URL, project ref, anon key
- Stripe IDs: product + price IDs, webhook secret
- Canonical domain decision (apex vs www)
- Auth redirect URLs

## Still requires manual business/legal input
- Legal business details for Stripe live mode
- Tax configuration
- Terms/Privacy/Refund policy
