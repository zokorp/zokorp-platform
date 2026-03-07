import Link from "next/link";

import { EmailVerificationResendForm } from "@/components/email-verification-resend-form";
import { PasswordSignInForm } from "@/components/password-signin-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { isPasswordAuthEnabled } from "@/lib/auth-config";

function sanitizeCallbackUrl(raw: string | undefined) {
  if (!raw) {
    return "/account";
  }

  return raw.startsWith("/") ? raw : "/account";
}

function getErrorMessage(error: string | undefined) {
  if (!error) {
    return null;
  }

  if (error === "CredentialsSignin") {
    return "Invalid credentials or account temporarily locked.";
  }

  return "Sign-in failed. Please try again.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; verified?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(params.callbackUrl);
  const passwordAuthEnabled = isPasswordAuthEnabled();
  const errorMessage = getErrorMessage(params.error);
  const verificationSuccess = params.verified === "1";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account Access</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
          Sign in with your business email and password.
        </p>

        {errorMessage ? <Alert tone="danger" className="mt-6">{errorMessage}</Alert> : null}

        {verificationSuccess ? <Alert tone="success" className="mt-6">Email verified. You can sign in now.</Alert> : null}

        {passwordAuthEnabled ? (
          <PasswordSignInForm callbackUrl={callbackUrl} />
        ) : (
          <Alert tone="warning" className="mt-6">
            Password auth is disabled. Set `AUTH_PASSWORD_ENABLED=true`.
          </Alert>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={buttonVariants({ variant: "link", size: "sm" })}>
            Create account
          </Link>
          <Link href="/login/forgot-password" className={buttonVariants({ variant: "link", size: "sm" })}>
            Forgot password?
          </Link>
        </div>
      </Card>

      <Card tone="muted" lift className="rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Requirements</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>Business email domains only</li>
          <li>Email verification required before first sign-in</li>
          <li>Strong password required</li>
          <li>Password reset link expires after 30 minutes</li>
        </ul>
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-slate-900">Need a new verification email?</p>
          <EmailVerificationResendForm submitLabel="Resend verification email" />
        </div>
        <p className="mt-4 text-sm">
          <Link href="/" className={buttonVariants({ variant: "link", size: "sm" })}>
            Back to home
          </Link>
        </p>
      </Card>
    </div>
  );
}
