import Link from "next/link";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function VerifyRequestPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card tone="glass" className="animate-fade-up rounded-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account Access</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Sign in with password</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
          Use your business email and password on the login page.
        </p>
      </Card>

      <Card tone="muted" lift className="rounded-2xl p-6">
        <div className="mt-1 flex flex-wrap gap-2">
          <Link href="/login" className={buttonVariants()}>
            Back to login
          </Link>
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            Back to home
          </Link>
        </div>
      </Card>
    </div>
  );
}
