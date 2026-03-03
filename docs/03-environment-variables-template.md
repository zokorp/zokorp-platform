# Environment variables template

**Important:** do not commit real secrets.

## Required
- NEXT_PUBLIC_SITE_URL=__PLACEHOLDER__
- NEXTAUTH_URL=__PLACEHOLDER__
- NEXTAUTH_SECRET=__PLACEHOLDER__
- NEXT_PUBLIC_SUPABASE_URL=__PLACEHOLDER__
- NEXT_PUBLIC_SUPABASE_ANON_KEY=__PLACEHOLDER__
- SUPABASE_URL=__PLACEHOLDER__
- SUPABASE_SERVICE_ROLE_KEY=__PLACEHOLDER__
- DATABASE_URL=__PLACEHOLDER__
- EMAIL_SERVER_HOST=__PLACEHOLDER__
- EMAIL_SERVER_PORT=__PLACEHOLDER__
- EMAIL_SERVER_USER=__PLACEHOLDER__
- EMAIL_SERVER_PASSWORD=__PLACEHOLDER__
- EMAIL_FROM=__PLACEHOLDER__
- STRIPE_SECRET_KEY=__PLACEHOLDER__
- STRIPE_WEBHOOK_SECRET=__PLACEHOLDER__
- STRIPE_PRICE_ID_FTR_SINGLE=__PLACEHOLDER__
- STRIPE_PRICE_ID_SDP_SRP_SINGLE=__PLACEHOLDER__
- STRIPE_PRICE_ID_COMPETENCY_REVIEW=__PLACEHOLDER__
- STRIPE_PRICE_ID_PLATFORM_MONTHLY=__PLACEHOLDER__
- STRIPE_PRICE_ID_PLATFORM_ANNUAL=__PLACEHOLDER__
- STRIPE_PRICE_ID_MLOPS_STARTER_MONTHLY=__PLACEHOLDER__
- STRIPE_PRICE_ID_MLOPS_STARTER_ANNUAL=__PLACEHOLDER__
- STRIPE_METER_EVENT_NAME_JOB_UNITS=job_units
- MLOPS_ARTIFACT_BUCKET=mlops-artifacts
- MLOPS_RUNNER_KEY_PEPPER=__PLACEHOLDER__
- ZOKORP_ADMIN_EMAILS=__PLACEHOLDER__
- UPLOAD_MAX_MB=10

## Planned values (non-secret mapping)
- `NEXT_PUBLIC_SITE_URL`
  - Preview: Vercel preview URL (per deployment)
  - Production: `https://www.zokorp.com`
- `STRIPE_PRICE_ID_FTR_SINGLE` -> `price_1T6Ok95wcnm215lAmfzvDgov`
- `STRIPE_PRICE_ID_SDP_SRP_SINGLE` -> `price_...` (new price for SDP/SRP at $150)
- `STRIPE_PRICE_ID_COMPETENCY_REVIEW` -> `price_1T6OkZ5wcnm215lAu28bpxYD`
- `STRIPE_PRICE_ID_PLATFORM_MONTHLY` -> `price_1T6Ol35wcnm215lAyWsfGR6q`
- `STRIPE_PRICE_ID_PLATFORM_ANNUAL` -> `price_1T6Oln5wcnm215lAUXJ9gNQt`
- `STRIPE_PRICE_ID_MLOPS_STARTER_MONTHLY` -> `price_...` (new MLOps starter monthly)
- `STRIPE_PRICE_ID_MLOPS_STARTER_ANNUAL` -> `price_...` (new MLOps starter annual)
- `STRIPE_METER_EVENT_NAME_JOB_UNITS` -> `job_units`
- `MLOPS_ARTIFACT_BUCKET` -> `mlops-artifacts`

## Notes
- Keep secrets in Vercel/Supabase/Stripe dashboards or an encrypted secret manager.
- Use dashboard values only after authentication and copy-paste verification.
- Never commit real secret values to GitHub, even in a private repo.
- Check callback URLs for auth and Stripe webhook endpoints once routes are defined.
