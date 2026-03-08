import Link from "next/link";

import { PasswordResetForm } from "@/components/password-reset-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { isPasswordAuthEnabled } from "@/lib/auth-config";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  const passwordAuthEnabled = isPasswordAuthEnabled();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Password Reset</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Set a new password</h1>

        {!passwordAuthEnabled ? (
          <Alert tone="warning" className="mt-3">
            Password reset is currently unavailable. Please try again later.
          </Alert>
        ) : token ? (
          <PasswordResetForm token={token} />
        ) : (
          <Alert tone="danger" className="mt-3">Missing or invalid reset token. Request a new reset link.</Alert>
        )}
      </Card>

      <Card tone="muted" lift className="rounded-2xl p-6">
        <p className="text-sm text-slate-700">
          <Link href="/login/forgot-password" className={buttonVariants({ variant: "link", size: "sm" })}>
            Request another reset link
          </Link>
        </p>
      </Card>
    </div>
  );
}
