import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserEmailPreferencesByToken } from "@/lib/email-preferences";
import { buildPageMetadata } from "@/lib/site";

import { saveEmailPreferencesByTokenAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "Email Preferences",
  description: "Manage ZoKorp operational-result and future follow-up email preferences.",
  path: "/email-preferences",
});

export default async function EmailPreferencesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const query = (await searchParams) ?? {};
  const token = query.token ?? null;
  const status = query.status ?? null;
  const updated = query.updated === "1";
  const resolved = await getUserEmailPreferencesByToken(token);

  if (!resolved) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Card tone="glass" className="rounded-2xl p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email Preferences</p>
          <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Preference link unavailable</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
            This preference link is missing or expired. Open your latest ZoKorp email again, or sign in to your account to manage preferences directly.
          </p>
        </Card>

        <Card className="rounded-2xl p-6">
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              {status === "invalid"
                ? "The last update request could not be verified."
                : "Use a fresh email link or go through your signed-in account."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/account" className={buttonVariants()}>
                Open account
              </Link>
              <Link href="/support" className={buttonVariants({ variant: "secondary" })}>
                Contact support
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card tone="glass" className="rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email Preferences</p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-slate-900">Manage delivery and follow-up email settings</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
          Result emails are tied to requested tool runs and account operations. Marketing follow-up stays off by default unless you explicitly turn it on.
        </p>
        <p className="mt-3 text-sm text-slate-500">Preference link for {resolved.subject.email}</p>
      </Card>

      {updated ? (
        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 text-sm text-emerald-900">
          Your email preferences were updated successfully.
        </Card>
      ) : null}

      <Card className="rounded-2xl p-6">
        <form action={saveEmailPreferencesByTokenAction} className="space-y-5">
          <input type="hidden" name="token" value={token ?? ""} />

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              name="operationalResultEmails"
              defaultChecked={resolved.preferences.operationalResultEmails}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-slate-900">Operational result emails</span>
              <span className="block text-sm leading-6 text-slate-600">
                Tool-result delivery, billing-critical notices, and account-linked workflow updates.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <input
              type="checkbox"
              name="marketingFollowUpEmails"
              defaultChecked={resolved.preferences.marketingFollowUpEmails}
              className="mt-1 h-4 w-4 rounded border-slate-300"
            />
            <span className="space-y-1">
              <span className="block text-sm font-semibold text-slate-900">Future marketing follow-up</span>
              <span className="block text-sm leading-6 text-slate-600">
                Optional product updates, launch notices, and follow-up outreach that is not required to operate your account.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={buttonVariants()}>
              Save preferences
            </button>
            <Link href="/support" className={buttonVariants({ variant: "secondary" })}>
              Contact support
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
