import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/login?callbackUrl=/account");
  }

  let user:
    | {
        email: string | null;
        entitlements: Array<{
          id: string;
          status: string;
          remainingUses: number;
          validUntil: Date | null;
          product: { name: string };
        }>;
        auditLogs: Array<{ id: string; action: string; createdAt: Date }>;
      }
    | null = null;

  try {
    user = await db.user.findUnique({
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
  } catch {
    user = null;
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <section className="surface rounded-2xl p-6">
          <h1 className="font-display text-3xl font-semibold text-slate-900">Account</h1>
          <p className="mt-3 text-sm text-slate-600">
            We could not load your account data yet. This usually means database settings are still
            being finalized in the deployment environment.
          </p>
          <div className="mt-5">
            <Link
              href="/software"
              className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Return to Software
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface rounded-2xl p-6">
        <h1 className="font-display text-4xl font-semibold text-slate-900">Account</h1>
        <p className="mt-2 text-sm text-slate-600">Signed in as {user.email}</p>
        <div className="mt-4">
          <Link
            href="/account/billing"
            className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Billing and Invoices
          </Link>
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Entitlements</h2>
        <div className="mt-3 space-y-2">
          {user.entitlements.length === 0 ? (
            <p className="text-sm text-slate-600">No active purchases yet.</p>
          ) : (
            user.entitlements.map((entitlement) => (
              <div key={entitlement.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">{entitlement.product.name}</p>
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

      <section className="surface rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Recent Activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {user.auditLogs.length === 0 ? (
            <li className="text-slate-600">No activity logged yet.</li>
          ) : (
            user.auditLogs.map((log) => (
              <li key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
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
