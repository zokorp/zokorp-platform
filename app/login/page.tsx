import Link from "next/link";

export default function LoginPage() {
  const emailAuthConfigured =
    Boolean(process.env.EMAIL_SERVER_HOST) &&
    Boolean(process.env.EMAIL_SERVER_PORT) &&
    Boolean(process.env.EMAIL_SERVER_USER) &&
    Boolean(process.env.EMAIL_SERVER_PASSWORD) &&
    Boolean(process.env.EMAIL_FROM);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <section className="surface rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account Access</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
          ZoKorp uses secure email magic-link authentication for MVP. You will receive a sign-in link
          by email and can then access purchases, subscriptions, and tool history.
        </p>

        {emailAuthConfigured ? (
          <div className="mt-6">
            <Link
              href="/api/auth/signin"
              className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Continue to sign-in
            </Link>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Login will be enabled after email delivery settings are connected.
          </div>
        )}
      </section>

      <section className="surface-muted rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">What happens next?</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Sign in to your account</li>
          <li>Purchase tool access via Stripe checkout</li>
          <li>Use your credits or subscription from the software page</li>
          <li>Manage payment methods and invoices from the billing portal</li>
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          OAuth providers (Google/Microsoft) can be added in a later phase.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
            Back to home
          </Link>
        </p>
      </section>
    </div>
  );
}
