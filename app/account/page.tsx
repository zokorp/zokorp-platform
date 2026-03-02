import Link from "next/link";
import { redirect } from "next/navigation";
import { CreditTier } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/login?callbackUrl=/account");
  }

  let user = null;

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
        creditBalances: {
          include: {
            product: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
        checkoutFulfillments: {
          include: {
            product: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
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
        <h2 className="font-display text-2xl font-semibold text-slate-900">Credit Wallets</h2>
        <div className="mt-3 space-y-2">
          {user.creditBalances.length === 0 ? (
            <p className="text-sm text-slate-600">No credit wallets found yet.</p>
          ) : (
            user.creditBalances.map((wallet) => (
              <div key={wallet.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">
                  {wallet.product.name} ·{" "}
                  {wallet.tier === CreditTier.SDP_SRP
                    ? "SDP/SRP"
                    : wallet.tier === CreditTier.COMPETENCY
                      ? "Competency"
                      : wallet.tier}
                </p>
                <p className="text-slate-600">Remaining uses: {wallet.remainingUses}</p>
                <p className="text-slate-600">Status: {wallet.status}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Recent Purchases</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {user.checkoutFulfillments.length === 0 ? (
            <li className="text-slate-600">No completed checkouts yet.</li>
          ) : (
            user.checkoutFulfillments.map((purchase) => (
              <li key={purchase.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-slate-700">
                <p className="font-medium text-slate-900">{purchase.product.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Checkout session: <span className="font-mono">{purchase.stripeCheckoutSessionId}</span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {new Date(purchase.createdAt).toLocaleString()}
                  </span>
                  <Link
                    href={`/software/${purchase.product.slug}`}
                    className="text-xs font-semibold text-slate-800 underline-offset-2 hover:underline"
                  >
                    Open tool
                  </Link>
                </div>
              </li>
            ))
          )}
        </ul>
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
