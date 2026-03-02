# Environment variables template

**Important:** do not commit real secrets.

## Required
- NEXT_PUBLIC_SITE_URL=
- NEXT_PUBLIC_SUPABASE_URL=
- NEXT_PUBLIC_SUPABASE_ANON_KEY=
- SUPABASE_SERVICE_ROLE_KEY=
- DATABASE_URL=
- STRIPE_SECRET_KEY=
- STRIPE_WEBHOOK_SECRET=
- STRIPE_PRICE_ID_FTR_SINGLE=
- STRIPE_PRICE_ID_COMPETENCY_REVIEW=
- STRIPE_PRICE_ID_PLATFORM_MONTHLY=
- STRIPE_PRICE_ID_PLATFORM_ANNUAL=

## Notes
- Keep secrets in Vercel/Supabase/Stripe dashboards or encrypted secret managers.
- Check callback URLs for auth and Stripe webhook endpoints once routes are defined.
