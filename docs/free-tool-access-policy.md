# Free Tool Access Policy

## Current enforced policy

ZoKorp currently enforces verified-business-email delivery for the Architecture Diagram Reviewer.

This policy currently applies to:

- `Architecture Diagram Reviewer`

## What the user must do

1. Create an account with a business email.
2. Verify that email.
3. Sign in.
4. Run the tool while signed in.

The result email is sent only to the verified business email on the signed-in account. The tools do not support entering a different recipient address for the final advisory output.

## Why this is enforced

- Prevents detailed consulting output from being sent to an inbox the platform has not verified.
- Keeps tool history, follow-up, and future account surfaces tied to one owner.
- Makes server-side authorization consistent instead of relying on client-side email fields.
- Reduces ambiguity for support, CRM sync, and future account-history features.

## Implementation notes

- Shared server enforcement lives in `lib/free-tool-access.ts`.
- Shared UI gating lives in `components/free-tool-access-gate.tsx`.
- Generic software routes use the gate for Architecture Review.
- The reviewer displays the signed-in verified email as the fixed delivery address instead of treating it as an anonymous lead field.

## Product caveat

This is the safer default policy for launch readiness. If the owner later wants a lower-friction "submit first, verify later" model, that is a product-policy change and must update:

- server enforcement,
- public tool copy,
- privacy/support/legal copy,
- and regression tests together.
