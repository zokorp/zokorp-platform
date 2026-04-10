import Link from "next/link";

import {
  retryArchitectureReviewEmailOutboxAction,
  triggerEstimateCompanionSyncNowAction,
  triggerServiceRequestZohoSyncNowAction,
  triggerZohoLeadSyncNowAction,
} from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineCard } from "@/components/ui/timeline-card";
import { getAdminOperationsSnapshot } from "@/lib/admin-operations";
import { requireAdminPageAccess } from "@/lib/admin-page-access";

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
  await requireAdminPageAccess("/admin/operations");
  const snapshot = await getAdminOperationsSnapshot();
  const sections = [
    {
      key: "architecture-email",
      title: "Architecture email delivery",
      description: "Pending or failed delivery attempts for Architecture Diagram Reviewer emails.",
      entries: snapshot.architectureEmailIssues,
    },
    {
      key: "crm-sync",
      title: "CRM sync attention",
      description: "Architecture-review lead syncs and service-request CRM updates that are pending or failed against Zoho.",
      entries: snapshot.crmSyncIssues,
    },
    {
      key: "estimate-sync",
      title: "Estimate companion attention",
      description: "Recent formal estimates that failed or were not configured on the external provider.",
      entries: snapshot.estimateCompanionIssues,
    },
    {
      key: "booked-calls",
      title: "Booked-call signals",
      description: "Recent booked follow-ups, including bookings linked back into customer records, bookings flagged for qualification review, and sync configuration problems that need operator action.",
      entries: snapshot.bookedCallSignals,
    },
    {
      key: "automation-health",
      title: "Automation health",
      description: "Freshness and failure signals for the queue worker, follow-ups, retention sweep, and scheduled sync jobs.",
      entries: snapshot.automationHealthSignals,
    },
    {
      key: "internal-failures",
      title: "Recent internal failures",
      description: "Caught runtime and route failures that were persisted for operator review instead of staying in platform logs only.",
      entries: snapshot.internalFailureSignals,
    },
    {
      key: "security-signals",
      title: "Security signals",
      description: "Recent CSP violations and CSP-ingestion failures that may indicate broken embeds, third-party drift, or policy regressions.",
      entries: snapshot.securitySignals,
    },
    {
      key: "follow-up",
      title: "Follow-up attention",
      description: "Estimates and service requests that still need an operator response path.",
      entries: snapshot.followUpAttentionIssues,
    },
    {
      key: "tool-runs",
      title: "Recent tool-run signals",
      description: "Recent reviewer, validator, and forecasting runs with delivery, estimate, or confidence signals.",
      entries: snapshot.toolRunSignals,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Operations</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Review email delivery, CRM sync, quote-companion, and recent software-run signals without dropping into raw provider logs. Dedicated Stripe and credit-ledger exceptions live in the billing workspace.
            </p>
          </div>
          <AdminNav current="operations" />
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Architecture email pending", value: snapshot.stats.pendingArchitectureEmail },
          { label: "Architecture email failed", value: snapshot.stats.failedArchitectureEmail },
          { label: "CRM attention", value: snapshot.stats.crmNeedsAttention },
          { label: "Quote issues", value: snapshot.stats.failedQuoteCompanions },
          { label: "Booked calls", value: snapshot.stats.recentBookedCalls },
          { label: "Automation attention", value: snapshot.stats.automationAttention },
          { label: "Internal failures", value: snapshot.stats.internalFailures },
          { label: "Security signals", value: snapshot.stats.securitySignals },
          { label: "Follow-up attention", value: snapshot.stats.followUpAttention },
          { label: "Reviewer runs", value: snapshot.stats.recentArchitectureRuns },
          { label: "Validator runs", value: snapshot.stats.recentValidatorRuns },
          { label: "MLOps runs", value: snapshot.stats.recentMlopsRuns },
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

      <section className="grid gap-6 xl:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
            <CardHeader className="gap-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-semibold text-slate-900">{section.title}</h2>
                  <p className="text-sm leading-6 text-slate-600">{section.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {section.key === "estimate-sync" ? (
                    <Link href="/admin/billing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Open billing workspace
                    </Link>
                  ) : null}
                  {section.key === "crm-sync" ? (
                    <>
                      <form action={triggerZohoLeadSyncNowAction}>
                        <Button type="submit" variant="secondary" size="sm">
                          Run lead sync now
                        </Button>
                      </form>
                      <form action={triggerServiceRequestZohoSyncNowAction}>
                        <Button type="submit" variant="secondary" size="sm">
                          Run service-request sync
                        </Button>
                      </form>
                    </>
                  ) : null}
                  {section.key === "estimate-sync" ? (
                    <form action={triggerEstimateCompanionSyncNowAction}>
                      <Button type="submit" variant="secondary" size="sm">
                        Run estimate sync now
                      </Button>
                    </form>
                  ) : null}
                  {section.key === "booked-calls" ? (
                    <Link href="/admin/service-requests" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Review booked-call state
                    </Link>
                  ) : null}
                  {section.key === "automation-health" ? (
                    <Link href="/admin/readiness" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Open readiness
                    </Link>
                  ) : null}
                  {section.key === "internal-failures" ? (
                    <Link href="/admin/readiness" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Review runtime posture
                    </Link>
                  ) : null}
                  {section.key === "security-signals" ? (
                    <Link href="/admin/readiness" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Review security posture
                    </Link>
                  ) : null}
                  {section.key === "follow-up" ? (
                    <Link href="/admin/service-requests" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Review quote follow-up
                    </Link>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.entries.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-4">
                  <CardContent>
                    <p className="text-sm text-slate-600">No issues in this queue right now.</p>
                  </CardContent>
                </Card>
              ) : (
                section.entries.map((entry) => (
                  <TimelineCard
                    key={entry.id}
                    title={entry.title}
                    meta={new Date(entry.createdAt).toLocaleString()}
                    badge={<Badge variant={entry.statusTone}>{entry.statusLabel}</Badge>}
                    summary={entry.summary}
                    details={
                      entry.details.length > 0 ? (
                        <>
                          {entry.details.map((detail) => (
                            <span key={detail}>{detail}</span>
                          ))}
                        </>
                      ) : undefined
                    }
                    footer={
                      <div className="flex flex-wrap gap-2">
                        {section.key === "architecture-email" ? (
                          <form action={retryArchitectureReviewEmailOutboxAction}>
                            <input type="hidden" name="outboxId" value={entry.id} />
                            <Button type="submit" variant="secondary" size="sm">
                              Retry email send
                            </Button>
                          </form>
                        ) : null}
                        {entry.href ? (
                          <Link href={entry.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                            Open related workspace
                          </Link>
                        ) : null}
                      </div>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
