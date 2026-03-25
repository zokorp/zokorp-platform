# AGENTS.md

## Project overview
ZoKorp Platform is a Next.js App Router application with Prisma/Postgres, NextAuth credentials auth with business-email verification, and Stripe billing.

## Local setup
1. Install dependencies:
   - `npm install`
2. Copy environment template:
   - `cp .env.example .env.local`
3. Configure `.env.local` values.
4. Generate Prisma client:
   - `npm run prisma:generate`
5. Run migrations (after DB is reachable):
   - `npm run prisma:migrate`
6. Seed baseline products/prices:
   - `npm run prisma:seed`

## Development commands
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm test`

## Coding conventions
- Use TypeScript with strict typing.
- Keep all secret operations server-side (route handlers or server actions).
- Never expose secret keys in client bundles.
- Validate all untrusted input with `zod`.
- Enforce authorization server-side for account/admin/payment/tool routes.
- Use Prisma transactions for any credit decrement or entitlement mutation.

## Security checklist (OWASP reminder)
- Broken access control: all paid and admin actions enforce user + role + entitlement checks server-side.
- Cryptographic failures: secrets only from env vars; no secrets in source.
- Injection: use Prisma parameterized queries; validate input schemas.
- Insecure design: fail closed on entitlement checks.
- Security misconfiguration: keep env vars explicit and minimum role defaults.
- Vulnerable components: update dependencies regularly and review `npm audit` output.
- Identification/auth failures: password credentials auth, business-email verification, and session checks for protected routes.
- Software/data integrity: verify Stripe webhook signatures.
- Logging/monitoring: record billing/tool actions in `AuditLog`.
- SSRF/file upload: strict file type/size checks, in-memory processing, no direct path writes.
