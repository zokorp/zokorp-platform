import Link from "next/link";

export default function LoginPage() {
  const emailAuthConfigured =
    Boolean(process.env.EMAIL_SERVER_HOST) &&
    Boolean(process.env.EMAIL_SERVER_PORT) &&
    Boolean(process.env.EMAIL_SERVER_USER) &&
    Boolean(process.env.EMAIL_SERVER_PASSWORD) &&
    Boolean(process.env.EMAIL_FROM);

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        ZoKorp uses email magic-link authentication for MVP. You will receive a secure sign-in link by
        email.
      </p>
      {emailAuthConfigured ? (
        <div className="mt-6">
          <Link
            href="/api/auth/signin"
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Continue to sign-in
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Login will be enabled after email delivery settings are connected.
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        OAuth providers (Google/Microsoft) can be added in a later phase.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        By continuing, you agree to upcoming platform Terms and Privacy policy.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/" className="text-slate-700 underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}
