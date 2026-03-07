import Link from "next/link";
import {
  CreditTier,
  EntitlementStatus,
  ServiceRequestStatus,
  type ServiceRequest,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelineCard } from "@/components/ui/timeline-card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import {
  SERVICE_REQUEST_STATUS_LABEL,
  SERVICE_REQUEST_STATUS_STYLE,
  SERVICE_REQUEST_TYPE_LABEL,
} from "@/lib/service-requests";

export const dynamic = "force-dynamic";

function isServiceRequestOpen(status: ServiceRequestStatus) {
  return status !== ServiceRequestStatus.DELIVERED && status !== ServiceRequestStatus.CLOSED;
}

function formatTierLabel(tier: CreditTier) {
  if (tier === CreditTier.SDP_SRP) {
    return "SDP/SRP";
  }

  if (tier === CreditTier.COMPETENCY) {
    return "Competency";
  }

  return tier;
}

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    redirect("/login?callbackUrl=/account");
  }

  let user = null;
  let serviceRequests: ServiceRequest[] = [];

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

    if (user) {
      try {
        serviceRequests = await db.serviceRequest.findMany({
          where: {
            userId: user.id,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 25,
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }
      }
    }
  } catch {
    user = null;
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <h1 className="font-display text-3xl font-semibold text-slate-900">Account</h1>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              We could not load your account data yet. This usually means database settings are still
              being finalized in the deployment environment.
            </p>
            <Link href="/software" className={buttonVariants()}>
              Return to Software
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeSubscriptions = user.entitlements.filter(
    (entitlement) =>
      (entitlement.product.accessModel === "SUBSCRIPTION" || entitlement.product.accessModel === "METERED") &&
      entitlement.status === EntitlementStatus.ACTIVE,
  );
  const activeCredits = user.creditBalances.filter((wallet) => wallet.status === EntitlementStatus.ACTIVE);
  const openServiceRequests = serviceRequests.filter((request) => isServiceRequestOpen(request.status));

  return (
    <div className="space-y-6">
      <Card tone="glass" className="animate-fade-up rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account Hub</p>
              <h1 className="font-display mt-1 text-4xl font-semibold text-slate-900">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-600">Signed in as {user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{openServiceRequests.length} open requests</Badge>
              <Badge variant="secondary">{activeSubscriptions.length} active subscriptions</Badge>
              <Badge variant="secondary">{activeCredits.length} active credit wallets</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/account/billing" className={buttonVariants()}>
              Billing and Invoices
            </Link>
            <Link href="/services#service-request" className={buttonVariants({ variant: "secondary" })}>
              New Service Request
            </Link>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Open Requests", value: openServiceRequests.length },
          { label: "Active Subscriptions", value: activeSubscriptions.length },
          { label: "Credit Wallets", value: activeCredits.length },
          { label: "Recent Purchases", value: user.checkoutFulfillments.length },
        ].map((item) => (
          <Card key={item.label} lift className="rounded-3xl p-4">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-semibold text-slate-900">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">Account activity and access</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Service delivery stays first, with credits, entitlements, purchases, and activity close behind in one account view.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="service-requests" className="space-y-5">
            <TabsList className="w-full justify-start" aria-label="Account sections">
              <TabsTrigger value="service-requests">Service Requests</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
              <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="service-requests" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Track customer-visible request status, delivery notes, and preferred timing in one timeline.
                </p>
                <Link href="/services#service-request" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Submit another request
                </Link>
              </div>

              {serviceRequests.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No service requests yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {serviceRequests.map((request) => (
                    <TimelineCard
                      key={request.id}
                      title={request.title}
                      meta={`${request.trackingCode} · ${SERVICE_REQUEST_TYPE_LABEL[request.type]} · Submitted ${new Date(request.createdAt).toLocaleDateString("en-US")}`}
                      badge={
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SERVICE_REQUEST_STATUS_STYLE[request.status]}`}
                        >
                          {SERVICE_REQUEST_STATUS_LABEL[request.status]}
                        </span>
                      }
                      summary={request.summary}
                      details={
                        <>
                          {request.preferredStart ? (
                            <span>Preferred start: {new Date(request.preferredStart).toLocaleDateString("en-US")}</span>
                          ) : null}
                          {request.budgetRange ? <span>Budget: {request.budgetRange}</span> : null}
                        </>
                      }
                      footer={
                        request.latestNote ? (
                          <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-slate-700">
                            Latest update: {request.latestNote}
                          </div>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="credits" className="space-y-4">
              {user.creditBalances.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No credit wallets found yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {user.creditBalances.map((wallet) => (
                    <Card key={wallet.id} className="rounded-3xl p-5">
                      <CardHeader>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Credit wallet</p>
                        <h3 className="font-display text-2xl font-semibold text-slate-900">
                          {wallet.product.name} · {formatTierLabel(wallet.tier)}
                        </h3>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-600">
                        <p>Remaining uses: {wallet.remainingUses}</p>
                        <p>Status: {wallet.status}</p>
                        <p>Last updated: {wallet.updatedAt.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="entitlements" className="space-y-4">
              {user.entitlements.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No active entitlements yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {user.entitlements.map((entitlement) => (
                    <Card key={entitlement.id} className="rounded-3xl p-5">
                      <CardHeader>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Entitlement</p>
                        <h3 className="font-display text-2xl font-semibold text-slate-900">{entitlement.product.name}</h3>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-600">
                        <p>Status: {entitlement.status}</p>
                        <p>Remaining uses: {entitlement.remainingUses}</p>
                        {entitlement.validUntil ? (
                          <p>Valid until: {entitlement.validUntil.toLocaleDateString("en-US")}</p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="purchases" className="space-y-4">
              {user.checkoutFulfillments.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No completed checkouts yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {user.checkoutFulfillments.map((purchase) => (
                    <TimelineCard
                      key={purchase.id}
                      title={purchase.product.name}
                      meta={new Date(purchase.createdAt).toLocaleString()}
                      badge={<Badge variant="secondary">Fulfilled</Badge>}
                      summary={
                        <>
                          Checkout session: <span className="font-mono">{purchase.stripeCheckoutSessionId}</span>
                        </>
                      }
                      footer={
                        <Link href={`/software/${purchase.product.slug}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                          Open tool
                        </Link>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              {user.auditLogs.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No activity logged yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {user.auditLogs.map((log) => (
                    <TimelineCard
                      key={log.id}
                      title={log.action}
                      meta={new Date(log.createdAt).toLocaleString()}
                      badge={<Badge variant="outline">Audit</Badge>}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
