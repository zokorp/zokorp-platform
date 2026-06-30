# 09 — Manual Verification Needed

Items that could not be safely confirmed under the read-only / no-prod / no-network constraints.
Each lists the **exact check** to run. Ordered by how much it changes a finding's severity.

## A. Changes a finding's severity — do these first

1. **ARCH-Q01 real-world magnitude (does the uncapped quote actually produce four/five-figure numbers?)**
   - Why: confirms whether ARCH-Q01 is a latent edge case or a routine wrong-quote.
   - Check (hermetic, safe locally): write a Vitest harness that runs the deterministic engine + `buildArchitectureEstimateSnapshot` on a representative 60–89-score submission with several `remediation-estimate` rules (e.g. `infrastructure_as_code_indicated` 8–60h, `aws-launch-v1-catalog.ts:70`) and print `snapshot.totalUsd`. Compare against the documented $650–$2,800 band.
   - Command: `npx vitest run <new-harness>.test.ts` (unit tests are hermetic — db/nodemailer/fetch are mocked).

2. **SWP-01 trigger condition (does the Zoho consent-filter bypass ever execute?)**
   - Check: in the live DB, confirm whether `LeadLog.allowCrmFollowUp` always exists. `psql "$DATABASE_URL" -c '\d "LeadLog"'`. If the column always exists, the legacy fallback path is dead and SWP-01 drops to Info.

3. **PRIV-02 / SEC-01 — is the literal/secret-fallback path live in prod?**
   - Check (Vercel → Project → Settings → Environment Variables): confirm `ARCHIVE_ENCRYPTION_SECRET` and `NEXTAUTH_SECRET` are set to strong values in production. If both are set, the hardcoded-literal encryption path and the undefined-secret boot path are not reached in prod (severity stays as defense-in-depth).

4. **SEC-02 — is `ARCH_REVIEW_FOLLOWUP_SECRET` set distinctly in prod?**
   - Check (Vercel env): confirm `ARCH_REVIEW_FOLLOWUP_SECRET` is set and ≠ `ZOHO_SYNC_SECRET`. If it falls back, the follow-up endpoint shares an unrelated secret.

5. **COST-02 — current email auth (SPF/DKIM/DMARC) for the sending domain**
   - Check (DNS, no app calls): `dig TXT zokorp.com` (SPF), `dig TXT <selector>._domainkey.zokorp.com` (DKIM for the ZeptoMail/Resend selector), `dig TXT _dmarc.zokorp.com` (policy). Confirm SPF/DKIM alignment and the DMARC `p=` value.

## B. Confirms a finding without changing its rating

6. **CITE-04 — AWS `rel_fault_isolation_select_location.html` body**
   - The HTTP resource is live (200) but the fetcher couldn't extract its body. Open it in a browser and confirm the fault-isolation/location-selection content still supports the 2 AWS rules that cite it (`aws-launch-v1-catalog.ts:46,60`).

7. **ARCH-02 — does prod use the DB-backed rate-limit path?**
   - Check: confirm `RateLimitBucket` (migration 0009) is the live limiter in prod (vs an in-memory fallback). Determines whether the "burned domain slot" persists across instances.

8. **ARCH-04 — deployed `maxDuration` vs SMTP 120s socket timeout**
   - Check: the route's configured `maxDuration` on Vercel vs the nodemailer socket timeout — confirms whether the inline pipeline can be killed mid-send (feeds the REL-01 double-send window).

9. **REL-01 — observe a real duplicate send** (static analysis is already conclusive)
   - Only if desired: inject a throw immediately after the send in `jobs.ts:1003` in a local/test env and observe a second outbox row + send on re-drain. **Do not run against any real mail provider.**

10. **SEC-CI-01 — default `GITHUB_TOKEN` scope for the 6 unscoped workflows**
    - Check: GitHub repo → Settings → Actions → General → Workflow permissions. If the default is "read and write", the missing `permissions:` blocks are a real over-grant.

11. **VAL-01 redirect reachability** — point a curated validator target at an allowlisted host that issues a 30x redirect to a sentinel and confirm the fetcher follows it. (Requires a controlled test target.)

12. **VAL-03 CSV injection** — open a generated edit-guide CSV containing a cell like `=HYPERLINK("http://x","y")` in Excel/Sheets to confirm formula execution behavior.

## C. Out of scope this pass (explicitly not run)

13. **`npm run build`** — deferred (not on the allowed static list; potential Sentry source-map upload / env side effects). Run locally to confirm the production build is green: `npm run build`.

14. **Full unit test suite green + coverage %** — not run this pass. Safe to run locally: `npx vitest run` (hermetic). Do **not** run `tests/e2e/` without a provisioned DB + running app (`E2E_MUTATION_MODE` defaults to readonly, but it needs live infra).

15. **Dependency post-fix audit delta** — after the Tier-1/2 bumps, re-run `npm audit` on a throwaway branch to confirm the 23→residual count and that nodemailer 9.x + uuid override don't break installs. (Requires an install — out of read-only scope.)

16. **Live CSP/HSTS header emission on preview vs prod** — confirmed in source only (SEC-07). Inspect response headers on a deployed preview URL vs prod to confirm the `NODE_ENV` gate behaves as intended.
