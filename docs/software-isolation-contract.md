# Software product isolation contract

Each software product on ZoKorp is implemented as a self-contained module.
Changes to one product must not force changes in another. This document is
the contract auditors (and future maintainers) can point to.

## Products in scope

| Product | Component surface | Server / lib surface |
|---------|-------------------|----------------------|
| Architecture Diagram Reviewer | `components/architecture-diagram-reviewer/` | `lib/architecture-review/`, `app/api/submit-architecture-review/`, `app/api/architecture-review/**` |
| ZoKorpValidator | `components/validator/` | `lib/validator*.ts`, `lib/validator-*`, `app/api/tools/zokorp-validator/`, `data/validator/` |
| ZoKorp Forecasting Beta | `components/mlops/` | `app/api/tools/mlops-forecast/` |

## Rules

1. **No cross-product imports.** A file under one product's folder must not
   import from another product's folder. Validator code cannot import from
   `components/architecture-diagram-reviewer/` or `lib/architecture-review/`,
   and vice versa. CI would fail fast if it did because none of these files
   are re-exported from a common barrel.

2. **Shared surface is two layers only.**
   - `components/ui/*` — design system primitives (Button, Card, Badge,
     Alert, Progress, etc.).
   - `components/software/*` — software-platform primitives shared by every
     tool (e.g. `ToolResultDeliveryBanner`, `tool-engagement-guide`).

   Adding a new shared primitive is a deliberate change, not a quick
   coupling. Everything else must live inside a single product's tree.

3. **Marketing content stays out of product code.** Copy, CTAs, and
   positioning live in `lib/marketing-*.ts` and `app/(marketing pages)`.
   Product components render product UI only.

4. **Data isolation at the API layer.** Each product has its own
   `app/api/...` route handler, its own Prisma queries, and its own Zod
   schemas. No product leaks another product's data shapes through shared
   types.

5. **Privacy defaults.** Verified business email gating lives in
   `FreeToolAccessGate` and the entitlement/credit tables. Each product
   enforces its own access posture; revocation of one product's access must
   not affect another.

## Verified audit — 2026-04-21

```
# Cross-product import check
$ grep -rE "@/components/(mlops|validator|architecture-diagram)" \
    components/architecture-diagram-reviewer/ \
    components/mlops/ \
    components/validator/
# → no matches

# Shared primitives actually come from the design system
$ grep -rE "from \"@/components/" components/architecture-diagram-reviewer/ \
    components/mlops/ components/validator/ | grep -v "@/components/ui/"
# → no matches
```

As of this date, the three product trees share zero code outside of
`components/ui/*`. Keep it that way.

## How to add a new product

1. Create `components/<product-name>/` and put all React UI inside.
2. Put business logic in `lib/<product-name>/` (or `lib/<product-name>-*.ts`
   if the footprint is small).
3. Route handlers go in `app/api/tools/<product-name>/` or
   `app/api/<product-name>/` — never colocated with another product.
4. Expose the product through `lib/tool-registry.ts` so the public catalog
   can render it without the marketing code knowing about internals.
5. Add an entry to the table above and re-run the cross-import grep.

## Why this matters for customers

This structure is what lets ZoKorp make a credible privacy promise:
- A change to one tool cannot silently alter behavior in another.
- Each tool's data path is traceable from UI to API to storage without
  weaving through unrelated code.
- Audits can verify isolation by inspection, not by trust.
