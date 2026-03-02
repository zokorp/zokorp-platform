import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/api/auth/signin?callbackUrl=/account");
  }

  const user = await db.user.findUnique({
    where: { email },
    include: {
      entitlements: {
        include: {
          product: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!user) {
    redirect("/api/auth/signin?callbackUrl=/account");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="mt-2 text-sm text-slate-600">Signed in as {user.email}</p>
        <div className="mt-4">
          <Link
            href="/account/billing"
            className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Billing and Invoices
          </Link>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Entitlements</h2>
        <div className="mt-3 space-y-2">
          {user.entitlements.length === 0 ? (
            <p className="text-sm text-slate-600">No active purchases yet.</p>
          ) : (
            user.entitlements.map((entitlement) => (
              <div key={entitlement.id} className="rounded-md border border-slate-200 px-4 py-3 text-sm">
                <p className="font-medium text-slate-900">{entitlement.product.name}</p>
                <p className="text-slate-600">Status: {entitlement.status}</p>
                <p className="text-slate-600">Remaining uses: {entitlement.remainingUses}</p>
                {entitlement.validUntil ? (
                  <p className="text-slate-600">
                    Valid until: {entitlement.validUntil.toLocaleDateString("en-US")}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {user.auditLogs.length === 0 ? (
            <li className="text-slate-600">No activity logged yet.</li>
          ) : (
            user.auditLogs.map((log) => (
              <li key={log.id} className="rounded-md border border-slate-200 px-3 py-2 text-slate-700">
                <span className="font-medium">{log.action}</span>
                <span className="ml-2 text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
