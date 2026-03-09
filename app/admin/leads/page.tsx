import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  buildLeadDirectoryQueryString,
  getLeadDirectory,
  LEAD_ACCOUNT_FILTERS,
  LEAD_AUDIENCE_FILTERS,
  LEAD_OPS_FILTERS,
  LEAD_SIGNAL_LABELS,
  LEAD_SORTS,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  LEAD_VERIFIED_FILTERS,
  type LeadCrmState,
  type LeadDeliveryState,
  type LeadDirectoryEntry,
  type LeadDirectoryFilters,
} from "@/lib/admin-leads";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function deliveryBadgeVariant(state: LeadDeliveryState) {
  if (state === "failed") {
    return "danger" as const;
  }

  if (state === "pending") {
    return "warning" as const;
  }

  if (state === "sent") {
    return "success" as const;
  }

  return "secondary" as const;
}

function crmBadgeVariant(state: LeadCrmState) {
  if (state === "failed") {
    return "danger" as const;
  }

  if (state === "pending") {
    return "warning" as const;
  }

  if (state === "synced") {
    return "success" as const;
  }

  if (state === "not_configured") {
    return "info" as const;
  }

  return "secondary" as const;
}

function deliveryLabel(state: LeadDeliveryState) {
  if (state === "sent") {
    return "Email sent";
  }

  if (state === "pending") {
    return "Email pending";
  }

  if (state === "failed") {
    return "Email failed";
  }

  return "Email unknown";
}

function crmLabel(state: LeadCrmState) {
  if (state === "synced") {
    return "CRM synced";
  }

  if (state === "pending") {
    return "CRM pending";
  }

  if (state === "failed") {
    return "CRM failed";
  }

  if (state === "not_configured") {
    return "CRM not configured";
  }

  return "CRM unknown";
}

function exportHref(filters: LeadDirectoryFilters) {
  const queryString = buildLeadDirectoryQueryString(filters);
  return queryString ? `/admin/leads/export?${queryString}` : "/admin/leads/export";
}

function sourceSummary(entry: LeadDirectoryEntry) {
  return entry.sources.map((source) => LEAD_SOURCE_LABELS[source]).join(" · ");
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<Partial<Record<keyof LeadDirectoryFilters | "q", string | undefined>>>;
}) {
  const query = (await searchParams) ?? {};

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/login?callbackUrl=/admin/leads");
    }

    return (
      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader>
          <h1 className="font-display text-3xl font-semibold text-slate-900">Admin access required</h1>
        </CardHeader>
        <CardContent>
          <Alert tone="warning">
            <AlertTitle>Restricted page</AlertTitle>
            <AlertDescription>
              This page is restricted to ZoKorp admin accounts listed in <span className="font-mono">ZOKORP_ADMIN_EMAILS</span>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const directory = await getLeadDirectory(query);

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Lead Directory</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Likely human contacts are shown by default. QA, bot, and placeholder leads stay preserved in the data but are
              hidden until you explicitly filter for them.
            </p>
          </div>
          <AdminNav current="leads" />
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-5">
        {[
          { label: "Displayed", value: directory.stats.displayedContacts },
          { label: "Total contacts", value: directory.stats.totalContacts },
          { label: "Likely human", value: directory.stats.likelyHumanContacts },
          { label: "Flagged QA/test", value: directory.stats.flaggedContacts },
          { label: "Needs attention", value: directory.stats.opsAttention },
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

      <Alert tone="info">
        <AlertTitle>Human-first default</AlertTitle>
        <AlertDescription>
          The page now defaults to likely human contacts. Use the audience filter to review flagged QA/test or automation traffic without deleting it.
        </AlertDescription>
      </Alert>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader className="gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Filters and export</h2>
            <p className="text-sm text-slate-600">Search, suppress QA noise, focus on ops issues, or export the filtered view.</p>
          </div>
          <form className="grid gap-3 lg:grid-cols-[2fr_repeat(5,minmax(0,1fr))_auto_auto]">
            <Input name="q" defaultValue={directory.filters.q} placeholder="Search by email, company, source, or next action" />

            <Select name="audience" defaultValue={directory.filters.audience}>
              {LEAD_AUDIENCE_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === "human" ? "Likely humans" : value === "flagged" ? "Flagged QA/test" : "All audiences"}
                </option>
              ))}
            </Select>

            <Select name="source" defaultValue={directory.filters.source}>
              <option value="all">All sources</option>
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {LEAD_SOURCE_LABELS[source]}
                </option>
              ))}
            </Select>

            <Select name="account" defaultValue={directory.filters.account}>
              {LEAD_ACCOUNT_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All account states" : value === "linked" ? "Account-linked" : "Lead only"}
                </option>
              ))}
            </Select>

            <Select name="verified" defaultValue={directory.filters.verified}>
              {LEAD_VERIFIED_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All verification" : value === "verified" ? "Verified only" : "Unverified only"}
                </option>
              ))}
            </Select>

            <Select name="ops" defaultValue={directory.filters.ops}>
              {LEAD_OPS_FILTERS.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "All ops states" : value === "needs-attention" ? "Needs attention" : "Healthy only"}
                </option>
              ))}
            </Select>

            <Select name="sort" defaultValue={directory.filters.sort}>
              {LEAD_SORTS.map((value) => (
                <option key={value} value={value}>
                  {value === "latest" ? "Latest activity" : value === "oldest" ? "Oldest first" : "Most submissions"}
                </option>
              ))}
            </Select>

            <button type="submit" className={buttonVariants()}>
              Apply
            </button>
            <Link href={exportHref(directory.filters)} className={buttonVariants({ variant: "secondary" })}>
              Export CSV
            </Link>
          </form>
        </CardHeader>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Known contacts</h2>
          <p className="text-sm text-slate-600">
            Showing {directory.stats.displayedContacts} of {directory.stats.totalContacts} contacts across accounts and diagnostic tools.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {directory.entries.length === 0 ? (
            <Alert tone="info">
              <AlertTitle>No contacts found</AlertTitle>
              <AlertDescription>Broaden the filters or switch the audience filter to include flagged QA/test records.</AlertDescription>
            </Alert>
          ) : (
            directory.entries.map((entry) => (
              <div key={entry.email} className="rounded-3xl border border-border bg-white/90 p-4 shadow-[var(--shadow-soft)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{entry.email}</p>
                      <Badge variant={entry.isLikelyHuman ? "success" : "warning"}>
                        {entry.isLikelyHuman ? "Likely human" : "Flagged QA/test"}
                      </Badge>
                      {entry.emailVerified ? <Badge variant="success">Verified</Badge> : <Badge variant="secondary">Unverified</Badge>}
                      {entry.hasAccount ? <Badge variant="secondary">Account</Badge> : <Badge variant="outline">Lead only</Badge>}
                      {entry.isInternal ? <Badge variant="info">Internal</Badge> : null}
                      {entry.isAdmin ? <Badge variant="brand">Admin</Badge> : null}
                    </div>

                    <p className="text-sm text-slate-600">
                      {[entry.name, entry.companyName].filter(Boolean).join(" · ") || "No name/company captured yet"}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {entry.sources.map((source) => (
                        <Badge key={source} variant="outline">
                          {LEAD_SOURCE_LABELS[source]}
                        </Badge>
                      ))}
                    </div>

                    {entry.signals.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {entry.signals.map((signal) => (
                          <Badge key={signal} variant={signal === "internal-domain" || signal === "admin-account" ? "info" : "warning"}>
                            {LEAD_SIGNAL_LABELS[signal]}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Badge variant={deliveryBadgeVariant(entry.emailDeliveryState)}>{deliveryLabel(entry.emailDeliveryState)}</Badge>
                      <Badge variant={crmBadgeVariant(entry.crmSyncState)}>{crmLabel(entry.crmSyncState)}</Badge>
                      {entry.recommendedEngagement ? <Badge variant="brand">{entry.recommendedEngagement}</Badge> : null}
                      {entry.leadStage ? <Badge variant="secondary">{entry.leadStage}</Badge> : null}
                    </div>

                    <div className="rounded-2xl border border-border bg-background-elevated px-4 py-3 text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Next action:</span> {entry.nextAction}
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2 xl:min-w-[360px]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Sources</p>
                      <p>{sourceSummary(entry)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Latest source</p>
                      <p>{LEAD_SOURCE_LABELS[entry.latestSource]}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">First seen</p>
                      <p>{formatDate(entry.firstSeenAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Latest activity</p>
                      <p>{formatDate(entry.latestAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Tool submissions</p>
                      <p>{entry.submissionCount}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Account state</p>
                      <p>{entry.hasAccount ? (entry.emailVerified ? "Verified account" : "Account not verified") : "Lead only"}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
