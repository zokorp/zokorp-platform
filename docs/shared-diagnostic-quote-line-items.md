# Shared Diagnostic Quote Line Items

This document defines the typed line-item contract used by the Architecture Diagram Reviewer and any future deterministic estimate-first diagnostics.

## Canonical contract

Source of truth:
- `lib/quote-line-items.ts`

Each line item includes:
- `code`: stable internal identifier for deterministic grouping and deduplication
- `label`: customer-facing service line
- `amountLow`: low-end scope driver in USD
- `amountHigh`: high-end scope driver in USD
- `reason`: short explanation for why the line is present

Shared helpers now provide:
- USD and USD-range formatting
- deterministic line-item text rendering for emails
- shared HTML list rendering for emails
- deduplication by stable `code`
- proportional scaling so itemized lines can sum exactly to a tool’s final quote range

## Current usage

- `Architecture Diagram Reviewer`
  - retains the existing top-level `consultationQuoteUSD` and `quoteTier` fields for compatibility
  - now also includes `consultationQuote` with shared line items and rationale so storage and email packaging remain deterministic

## Guardrails

- Line items are deterministic scope drivers, not fake invoice precision.
- Totals must add up exactly to the stored quote range or fixed quote amount.
- Low-confidence or custom-scope flows should not pretend the free submission approved a larger delivery scope.
- If a tool needs to condense more than a readable number of scope drivers, it should aggregate the smallest remaining lines into one explicit overflow item rather than silently dropping them.
