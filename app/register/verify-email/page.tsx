import Link from "next/link";

import { EmailVerificationResendForm } from "@/components/email-verification-resend-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

function getStatusMessage(status: string | undefined) {
  if (status === "expired") {
    return {
      tone: "warning" as const,
      title: "Verification link expired",
      detail: "Request a new verification email below and use the latest link.",
    };
  }

  if (status === "invalid") {
    return {
      tone: "danger" as const,
      title: "Verification link is invalid",
      detail: "The link may have been copied incorrectly or already used.",
    };
  }

  return {
    tone: "info" as const,
    title: "Verify your email",
    detail: "Use the link from your inbox to activate your account, or request a fresh email below.",
  };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const params = await searchParams;
  const message = getStatusMessage(params.status);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account Access</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">{message.title}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">{message.detail}</p>

        <Alert tone={message.tone} className="mt-6">
          Verification is required before sign-in, purchases, or admin access are enabled.
        </Alert>

        <div className="mt-6">
          <EmailVerificationResendForm defaultEmail={params.email ?? ""} />
        </div>
      </Card>

      <Card tone="muted" lift className="rounded-2xl p-6">
        <p className="text-sm text-slate-700">
          Already verified?{" "}
          <Link href="/login" className={buttonVariants({ variant: "link", size: "sm" })}>
            Return to login
          </Link>
        </p>
      </Card>
    </div>
  );
}
