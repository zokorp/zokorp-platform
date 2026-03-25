import Link from "next/link";
import { redirect } from "next/navigation";

import { syncArchitectureRuleCatalogAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ARCHITECTURE_RULE_CATALOG_FILTERS,
  getArchitectureRuleCatalogDirectory,
} from "@/lib/architecture-review/rule-catalog";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(value);
}

function liveStateVariant(status: "PUBLISHED" | "DRAFT_PENDING" | "NEEDS_REVIEW" | "STALE") {
  if (status === "PUBLISHED") {
    return "success" as const;
  }

  if (status === "STALE") {
    return "warning" as const;
  }

  if (status === "DRAFT_PENDING") {
    return "info" as const;
  }

  return "secondary" as const;
}

function liveStateLabel(status: "PUBLISHED" | "DRAFT_PENDING" | "NEEDS_REVIEW" | "STALE") {
  if (status === "DRAFT_PENDING") {
    return "Draft Pending";
  }

  if (status === "NEEDS_REVIEW") {
    return "Needs Review";
  }

  return status;
}

function filterLabel(filter: (typeof ARCHITECTURE_RULE_CATALOG_FILTERS)[number]) {
  if (filter === "needs-review") {
    return "Needs review";
  }

  if (filter === "recently-updated") {
    return "Recently updated";
  }

  if (filter === "stale") {
    return "Stale";
  }

  return "All rules";
}

export default async function AdminArchitectureCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<Partial<Record<"filter" | "q", string | undefined>>>;
}) {
  const query = (await searchParams) ?? {};

  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect("/login?callbackUrl=/admin/architecture-catalog");
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

  const directory = await getArchitectureRuleCatalogDirectory({
    filter: query.filter,
    q: query.q,
  });

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Architecture Catalog</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              This is the private rule catalog behind the architecture review estimate email. Detection and scoring stay code-backed. Only published catalog revisions affect live customer-facing service lines and pricing overrides.
            </p>
          </div>
          <AdminNav current="architecture-catalog" />
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Total rules", value: directory.stats.total },
          { label: "Needs review", value: directory.stats.needsReview },
          { label: "Draft pending", value: directory.stats.draftPending },
          { label: "Stale", value: directory.stats.stale },
          { label: "Published", value: directory.stats.published },
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
        <AlertTitle>Publish is the only live switch</AlertTitle>
        <AlertDescription>
          Drafts help you research and refine service lines or override pricing, but the live estimate email only reads published entries. If a code-backed rule changes, the catalog marks it stale so you can review it before trusting the published copy again.
        </AlertDescription>
      </Alert>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader className="gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Filters and sync</h2>
            <p className="text-sm text-slate-600">Search the private catalog, focus on review queues, or sync rule IDs from code.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_auto_auto]">
            <form className="grid gap-3 lg:grid-cols-[2fr_1fr_auto]">
              <Input name="q" defaultValue={directory.q} placeholder="Search by rule, category, service line, or summary" />
              <Select name="filter" defaultValue={directory.filter}>
                {ARCHITECTURE_RULE_CATALOG_FILTERS.map((filter) => (
                  <option key={filter} value={filter}>
                    {filterLabel(filter)}
                  </option>
                ))}
              </Select>
              <button type="submit" className={buttonVariants()}>
                Apply
              </button>
            </form>
            <form action={syncArchitectureRuleCatalogAction}>
              <button type="submit" className={buttonVariants({ variant: "secondary" })}>
                Sync from code
              </button>
            </form>
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Catalog entries</h2>
        </CardHeader>
        <CardContent>
          {directory.entries.length === 0 ? (
            <p className="text-sm text-slate-600">No catalog entries match this filter.</p>
          ) : (
            <div className="space-y-3">
              {directory.entries.map((entry) => (
                <article
                  key={entry.ruleId}
                  className="rounded-3xl border border-border bg-background-elevated/85 px-4 py-4 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">{entry.ruleId}</span>
                        <Badge variant={liveStateVariant(entry.liveState)}>{liveStateLabel(entry.liveState)}</Badge>
                        <Badge variant="secondary">{entry.category}</Badge>
                        <Badge variant="info">{entry.pricingMode}</Badge>
                        {!entry.isPresentInCode ? <Badge variant="warning">Not in code</Badge> : null}
                        {entry.hasDraftPending ? <Badge variant="info">Published live</Badge> : null}
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{entry.serviceLineLabel}</p>
                      <p className="max-w-3xl text-sm leading-6 text-slate-600">{entry.publicFixSummary}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Published version: {entry.publishedVersion ?? "none"}</span>
                        <span>Next review: {formatDate(entry.nextReviewAt)}</span>
                        <span>Updated: {formatDate(entry.updatedAt)}</span>
                        <span>Reviewer: {entry.lastReviewedByEmail ?? "not published yet"}</span>
                      </div>
                    </div>

                    <Link href={`/admin/architecture-catalog/${entry.ruleId}`} className={buttonVariants({ variant: "secondary" })}>
                      Review rule
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
