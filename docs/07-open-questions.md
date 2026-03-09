# Open questions / unresolved items

## Human login and provider access blockers

- GitHub login/MFA is still required to verify repo settings, branch protections, PR automation posture, and any existing project-board workflows.
- Vercel login/MFA is still required to verify production env vars, deployment targets, preview behavior, and custom-domain wiring.
- GitHub `production` environment access is still required to set `PRODUCTION_DATABASE_URL` and manually run the production Prisma migration workflow.
- Stripe login/MFA is still required to verify live-mode products, prices, tax settings, customer portal posture, and webhook configuration.
- Zoho login/MFA is still required to verify CRM fields, refresh-token posture, and WorkDrive destination setup.
- Email-provider and sending-domain access is still required to verify SMTP/Resend configuration plus SPF, DKIM, and DMARC posture.

## Business, legal, and policy decisions

- Final live pricing for subscription and service offers.
- Refund policy and dispute posture.
- Privacy Policy approval.
- Terms of Service approval.
- Support posture and any SLA commitments.
- Tax/legal entity setup for live billing.

## Product and workflow decisions

- Final live-mode launch gating for what is unlocked by free tools, one-time credit packs, and future subscriptions.
- Final booking-link destination for architecture-review and service CTA flows.
- Final outbound nurture cadence for free-tool leads.
- Long-term CRM direction if Zoho remains too heavy for the operator workflow.

## Public positioning and proof inputs

- Final founder bio, headshot, and public-positioning language.
- Real case studies, customer proof, or a decision to keep representative-pattern framing only.
- Canonical contact and location wording for public pages and docs.
