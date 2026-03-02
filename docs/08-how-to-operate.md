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
- In Vercel project settings, add `app.zokorp.com`.
- Add only required DNS records in Squarespace DNS.
- Verify SSL and routing before announcing availability.
