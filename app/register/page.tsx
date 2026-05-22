import Link from "next/link";

import { PasswordRegisterForm } from "@/components/password-register-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { sanitizeCallbackUrl } from "@/lib/callback-url";
import { buildAppPageMetadata } from "@/lib/site";

export const metadata = buildAppPageMetadata({
  title: "Create Account",
  description: "Create and verify a ZoKorp Platform account with your business email.",
  path: "/register",
});

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(params.callbackUrl);
  const passwordAuthEnabled = isPasswordAuthEnabled();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card
        tone="plain"
        className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_18px_36px_rgba(8,31,61,0.08)]"
      >
        <p className="enterprise-kicker text-[rgb(var(--z-ink-label))]">Account Access</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Create account</h1>
        <p className="enterprise-copy mt-3 text-sm md:text-base">
          Register with a business email and strong password. Email verification is required before sign-in.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Personal accounts (Gmail, Outlook, Yahoo, iCloud, ProtonMail, Tutanota, and similar) and disposable mailboxes
          are not accepted.
        </p>

        {passwordAuthEnabled ? (
          <PasswordRegisterForm callbackUrl={callbackUrl} />
        ) : (
          <Alert tone="warning" className="mt-6">
            Password account registration is currently unavailable. Please try again later.
          </Alert>
        )}
      </Card>

      <Card tone="plain" lift className="rounded-2xl border border-slate-200 bg-slate-50/95 p-6 shadow-none">
        <p className="text-sm text-slate-700">
          Already have an account?{" "}
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={buttonVariants({ variant: "link", size: "sm" })}>
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-sm text-slate-700">
          Need a new verification link?{" "}
          <Link href="/register/verify-email" className={buttonVariants({ variant: "link", size: "sm" })}>
            Verify your email
          </Link>
        </p>
      </Card>
    </div>
  );
}
