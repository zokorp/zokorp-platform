# How To Operate (MVP)

## 1) Add or update products
- Open `/admin/products` as an admin user.
- Create products with a slug and access model (`FREE`, `ONE_TIME_CREDIT`, `SUBSCRIPTION`, `METERED`).
- Product slug is used for entitlement checks and software page routes.

## 2) Add or update Stripe prices
- Open `/admin/prices` as an admin user.
- Attach Stripe `price_...` IDs to products.
- Set `kind` and `amount` in cents.
- For one-time credit packs, set `creditsGranted`.

## 3) Stripe receipts and invoice behavior
- In Stripe Dashboard (test first, then live), enable customer email receipts and invoice settings.
- App behavior:
  - Stores user email and Stripe customer id.
  - Sends users to Stripe Customer Portal from `/account/billing`.
  - Relies on Stripe for invoices/receipts and subscription self-service.

## 4) Stripe webhooks
- Configure Stripe webhook endpoint:
  - `/api/stripe/webhook`
- Subscribe at minimum to:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Set `STRIPE_WEBHOOK_SECRET` from Stripe endpoint signing secret.

## 5) Entitlement operations
- One-time credit products:
  - Credits granted on checkout completion.
  - Tool execution decrements credits atomically.
- Subscription products:
  - Entitlement state follows Stripe subscription lifecycle events.

## 6) Key rotation
- Rotate these keys in provider dashboards, then update env vars in Vercel/local:
  - `NEXTAUTH_SECRET`
  - SMTP credentials
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- After rotation, verify:
  - auth login flow
  - checkout flow
  - webhook delivery status

## 7) Subdomain readiness (`app.zokorp.com`)
- Keep Squarespace site live on apex/www until app is validated.
- In Vercel project settings, add `app.zokorp.com` (already done for `zokorp-web`).
- Add only required DNS record in Squarespace DNS:
  - `A` host `app` -> `76.76.21.21`
- Verify SSL and routing before announcing availability.
- Keep `@` and `www` untouched in this phase.

## 8) Validator knowledge library (non-LLM rule source)
- Source workbook:
  - `/Users/zohaibkhawaja/Downloads/AWS Specialization Owners, Regional Leads, Resources copy.xlsx`
- Generator script:
  - `scripts/build_validator_library.py`
- Output folder:
  - `data/validator/library`
- Regenerate command:
  - `. .venv/bin/activate && python scripts/build_validator_library.py --clear-output`
- Generated tracks:
  - `data/validator/library/ftr`
  - `data/validator/library/sdp`
  - `data/validator/library/srp`
  - `data/validator/library/competency`
- Each specialization folder includes:
  - `metadata.json`
  - `resources/checklist-link.txt`
  - `resources/calibration-guide-link.txt` (or `NOT_AVAILABLE`)
- Context extraction:
  - `data/validator/library/context/raw_sheets/*.json` contains full row-level metadata for owners, aliases, regional context, and related operational data.
- Important:
  - This is deterministic workbook extraction (no LLM scoring dependency).
  - Most links require AWS Partner Central access.

## 9) Checklist-targeted rulepacks (current behavior)
- The validator now builds a deterministic rulepack per run using:
  - selected profile (`FTR`, `SDP_SRP`, `COMPETENCY`)
  - selected checklist target (from the generated library)
  - track-specific controls (`ftr`, `sdp`, `srp`, `competency`)
  - cross-cutting evidence/traceability checks
- Reports now include:
  - `rulepack.id`
  - `rulepack.version`
  - check severity/weight
  - matched keyword + pattern signals
- This gives profile + checklist-targeted scoring without LLM cost.

## 10) Sensitive-data protection in validator output
- Before scoring/output, extracted text is sanitized to redact:
  - email addresses
  - phone numbers
  - SSN-like values
  - long account/card-like numeric strings
- Redaction events are noted in the report processing notes and API metadata.
- Recommendation:
  - do not upload bank statements or unrelated sensitive documents.

## 11) Control-by-control calibration + reviewed Excel download
- For `.xlsx/.xls` checklist uploads, validator now performs row-level control calibration:
  - detects control/requirement/response rows
  - evaluates each row (`PASS`, `PARTIAL`, `MISSING`)
  - provides row-level recommendation + suggested edit
  - attempts to fetch selected checklist/calibration material (when URL is reachable) and uses extracted terms for alignment checks
- Download output:
  - `Download Reviewed Excel` button returns a reviewed workbook with:
    - new columns per sheet:
      - `ZoKorp Auto Status`
      - `ZoKorp Auto Recommendation`
      - `ZoKorp Suggested Edit (No New Facts)`
    - `ZoKorp Review` tab with full control summary
- Download note:
  - very large workbooks may skip inline download in API response size-constrained environments.
- Safety rule:
  - Suggested edits are deterministic and do not invent claims; they only normalize existing text and add placeholders for missing factual evidence.
  - This does not guarantee “pass”; it highlights missing evidence quality signals so a human can complete factual details.
