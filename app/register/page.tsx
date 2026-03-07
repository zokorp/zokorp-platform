import Link from "next/link";

import { PasswordRegisterForm } from "@/components/password-register-form";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

function sanitizeCallbackUrl(raw: string | undefined) {
  if (!raw) {
    return "/account";
  }

  return raw.startsWith("/") ? raw : "/account";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = sanitizeCallbackUrl(params.callbackUrl);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account Access</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Create account</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
          Register with a business email and strong password. Email verification is required before sign-in.
        </p>

        <PasswordRegisterForm callbackUrl={callbackUrl} />
      </Card>

      <Card tone="muted" lift className="rounded-2xl p-6">
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
