// GATE-01: local overrides for the business-email gate. The bulk disposable list comes from the
// vendored `disposable-email-domains` dataset (refreshed by .github/workflows/refresh-disposable-
// domains.yml, which opens a PR when it changes). This file is hand-maintained for the long tail:
//   - ADDITIONS: registrable domains (eTLD+1) seen abusing the free tools that the dataset hasn't
//     caught yet.
//   - ALLOWLIST: dataset false-positives we explicitly want to treat as business email.
// Keep entries lowercase, one registrable domain per line.
export const DISPOSABLE_EMAIL_DOMAIN_ADDITIONS: string[] = [];

export const DISPOSABLE_EMAIL_DOMAIN_ALLOWLIST: string[] = [];
