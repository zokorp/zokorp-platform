# ZoKorp Security Notes (MLOps + Platform)

_Last updated: 2026-03-03_

## Scope
This document covers baseline security controls for the ZoKorp web platform and the new SMB MLOps module.

## Architecture trust boundaries
1. Browser client (untrusted input boundary)
2. ZoKorp control plane (Next.js APIs + server components)
3. Database (Supabase Postgres via Prisma)
4. Stripe billing services
5. Supabase Storage for artifacts
6. Customer-owned execution plane (ZoKorp Runner)

## Threat model notes (multi-tenancy)

### Assets
- Tenant project/job/model metadata
- Billing/account metadata
- Runner API keys
- Artifact pointers and signed upload URLs
- Audit logs

### Primary abuse paths
- Cross-tenant data access through missing organization scoping
- Privilege escalation through role mis-checks
- Runner key theft and unauthorized job polling
- Webhook forgery to grant subscriptions or usage events
- File upload abuse (oversized or malicious content)

### Mitigations in this phase
- Every MLOps table is keyed by `organizationId`.
- Server-side `requireMlopsContext` checks membership and minimum role before data access.
- Runner API keys are hashed at rest and compared using constant-time checks.
- Stripe webhook signature verification is enforced.
- Upload flow uses signed direct-to-storage URLs; control plane avoids large payload relays.
- AuditLog captures organization-level sensitive actions.

## OWASP checklist (implementation reminder)

### A01 Broken Access Control
- Enforce org scope in every query.
- Use explicit role checks (`OWNER/ADMIN/MEMBER/VIEWER`).
- Never trust client-provided org IDs without membership verification.

### A02 Cryptographic Failures
- Store only hashed runner keys.
- Secrets only from environment variables.
- No secret values in repository or frontend bundles.

### A03 Injection
- Use Prisma query builder and parameterized SQL only.
- Validate all request payloads with `zod`.

### A04 Insecure Design
- Fail closed: unauthorized users receive 401/403.
- Do not execute arbitrary shell commands from web requests.
- Keep long-running compute outside Vercel functions.

### A05 Security Misconfiguration
- Explicit env var validation in `lib/env.ts`.
- Keep auth/billing/admin routes server-side only.
- Restrict CORS exposure to platform domain usage.

### A06 Vulnerable Components
- Nightly dependency audit workflow included.
- Dependency refresh PRs are automated but still human-reviewed.

### A07 Identification and Authentication Failures
- Magic-link auth with database sessions.
- Admin and org role checks required for privileged operations.

### A08 Software and Data Integrity Failures
- Verify Stripe webhook signatures before processing.
- Keep migration scripts in source control.

### A09 Security Logging and Monitoring Failures
- Write audit events for organization, runner key, job, and billing actions.
- Retain enough event metadata for incident review.

### A10 SSRF / request abuse / unsafe upload handling
- Signed upload URL pattern for artifact path isolation.
- Control upload metadata through validated API inputs.
- Keep runner execution constrained to customer infra, not ZoKorp web runtime.

## Pre-production hardening checklist
- Rotate runner key pepper and Stripe/API secrets before live launch.
- Enable DB backups and point-in-time recovery in Supabase.
- Add WAF/rate-limiting policy at edge and API level.
- Add explicit incident response runbook and backup restoration test.
- Add SAST/secret scanning in CI.
