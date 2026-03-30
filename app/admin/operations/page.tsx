import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TimelineCard } from "@/components/ui/timeline-card";
import { getAdminOperationsSnapshot } from "@/lib/admin-operations";
import { requireAdminPageAccess } from "@/lib/admin-page-access";

export const dynamic = "force-dynamic";

export default async function AdminOperationsPage() {
  await requireAdminPageAccess("/admin/operations");
  const snapshot = await getAdminOperationsSnapshot();

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Operations</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Review email delivery, CRM sync, quote-companion, and recent tool-run signals without dropping into raw provider logs.
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
        {[
          {
            title: "Architecture email delivery",
            description: "Pending or failed delivery attempts for Architecture Diagram Reviewer emails.",
            entries: snapshot.architectureEmailIssues,
          },
          {
            title: "CRM sync attention",
            description: "Architecture-review lead syncs that are pending or failed against Zoho.",
            entries: snapshot.crmSyncIssues,
          },
          {
            title: "Estimate companion attention",
            description: "Recent formal estimates that failed or were not configured on the external provider.",
            entries: snapshot.estimateCompanionIssues,
          },
          {
            title: "Recent tool-run signals",
            description: "Recent validator and forecasting runs with delivery, estimate, or confidence signals.",
            entries: snapshot.toolRunSignals,
          },
        ].map((section) => (
          <Card key={section.title} className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
            <CardHeader className="gap-2">
              <h2 className="font-display text-2xl font-semibold text-slate-900">{section.title}</h2>
              <p className="text-sm leading-6 text-slate-600">{section.description}</p>
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
                      entry.href ? (
                        <Link href={entry.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                          Open related workspace
                        </Link>
                      ) : undefined
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
