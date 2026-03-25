import Link from "next/link";
import { notFound } from "next/navigation";

import {
  publishArchitectureRuleCatalogAction,
  saveArchitectureRuleCatalogDraftAction,
} from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getArchitectureRuleCatalogDetail } from "@/lib/architecture-review/rule-catalog";
import { requireAdminPageAccess } from "@/lib/admin-page-access";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
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

function revisionStatusVariant(status: "UNREVIEWED" | "DRAFT" | "PUBLISHED" | "STALE") {
  if (status === "PUBLISHED") {
    return "success" as const;
  }

  if (status === "STALE") {
    return "warning" as const;
  }

  if (status === "DRAFT") {
    return "info" as const;
  }

  return "secondary" as const;
}

export default async function AdminArchitectureCatalogDetailPage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const { ruleId } = await params;
  await requireAdminPageAccess(`/admin/architecture-catalog/${ruleId}`);

  const detail = await getArchitectureRuleCatalogDetail(ruleId);
  if (!detail) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl font-semibold text-slate-900">{detail.ruleId}</h1>
              <Badge variant={liveStateVariant(detail.catalog.liveState)}>{liveStateLabel(detail.catalog.liveState)}</Badge>
              <Badge variant="secondary">{detail.codeEntry.category}</Badge>
              {detail.catalog.hasDraftPending ? <Badge variant="info">Published live</Badge> : null}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Review the code-backed rule, draft private pricing or copy updates, and publish only when the live estimate output should change.
            </p>
          </div>
          <AdminNav current="architecture-catalog" />
        </CardHeader>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/architecture-catalog" className={buttonVariants({ variant: "secondary" })}>
          Back to catalog
        </Link>
        <Badge variant={detail.effectiveRuntime.source === "published" ? "success" : "warning"}>
          Runtime source: {detail.effectiveRuntime.source}
        </Badge>
        {!detail.catalog.isPresentInCode ? <Badge variant="warning">Not present in code</Badge> : null}
      </div>

      {!detail.catalog.isPresentInCode ? (
        <Alert tone="warning">
          <AlertTitle>Historical rule only</AlertTitle>
          <AlertDescription>
            This rule is no longer present in the code-backed detection engine. The catalog keeps it for history and review, but it is not currently part of the live runtime rule set.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
          <CardHeader>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Code-backed rule details</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Rule ID</p>
                <p className="mt-1 font-mono text-slate-900">{detail.codeEntry.ruleId}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Category</p>
                <p className="mt-1 text-slate-900">{detail.codeEntry.category}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Points summary</p>
                <p className="mt-1 text-slate-900">{detail.codeEntry.pointsSummary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Quote impact</p>
                <p className="mt-1 text-slate-900">{detail.codeEntry.quoteImpact}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Code service line</p>
              <p className="mt-1 text-slate-900">{detail.codeEntry.serviceLine}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trigger summary</p>
              <p className="mt-1 text-slate-900">{detail.codeEntry.triggerSummary}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Code pricing notes</p>
              <p className="mt-1 text-slate-900">{detail.codeEntry.pricingNotes ?? "None"}</p>
            </div>

            <Alert tone="info">
              <AlertTitle>Immutable here by design</AlertTitle>
              <AlertDescription>
                Rule ID, category, scoring behavior, and activation logic stay code-backed. This admin UI only controls private service-line wording, internal notes, and optional pricing overrides.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
          <CardHeader>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Live runtime preview</h2>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-700">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Published version</p>
                <p className="mt-1 text-slate-900">{detail.catalog.publishedVersion ?? "None"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Catalog state</p>
                <p className="mt-1 text-slate-900">{liveStateLabel(detail.catalog.liveState)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Published at</p>
                <p className="mt-1 text-slate-900">{formatDateTime(detail.catalog.publishedAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Last reviewed</p>
                <p className="mt-1 text-slate-900">{formatDateTime(detail.catalog.lastReviewedAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Reviewer</p>
                <p className="mt-1 text-slate-900">{detail.catalog.lastReviewedByEmail ?? "None"}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Live service line</p>
              <p className="mt-1 text-slate-900">{detail.effectiveRuntime.serviceLineLabel}</p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Live public fix summary</p>
              <p className="mt-1 text-slate-900">{detail.effectiveRuntime.publicFixSummary}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pricing mode</p>
                <p className="mt-1 text-slate-900">{detail.effectiveRuntime.pricingMode}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Override range</p>
                <p className="mt-1 text-slate-900">
                  {detail.effectiveRuntime.overrideMinPriceUsd !== null || detail.effectiveRuntime.overrideMaxPriceUsd !== null
                    ? `${detail.effectiveRuntime.overrideMinPriceUsd ?? "?"} - ${detail.effectiveRuntime.overrideMaxPriceUsd ?? "?"}`
                    : "Derived from code"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Draft and publish</h2>
        </CardHeader>
        <CardContent className="space-y-4">
            <Alert tone="info">
              <AlertTitle>Drafts stay private</AlertTitle>
              <AlertDescription>
              Saving a draft records your working copy and keeps the current live estimate behavior unchanged. Publishing writes a new live revision for this rule.
              </AlertDescription>
            </Alert>

          <form className="space-y-4">
            <input type="hidden" name="ruleId" value={detail.ruleId} />

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Service line label</span>
                <Input name="serviceLineLabel" defaultValue={detail.formDefaults.serviceLineLabel} />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pricing mode</span>
                <Select name="pricingMode" defaultValue={detail.formDefaults.pricingMode}>
                  <option value="DERIVED">DERIVED</option>
                  <option value="OVERRIDE">OVERRIDE</option>
                </Select>
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Public fix summary</span>
              <Textarea
                name="publicFixSummary"
                rows={4}
                defaultValue={detail.formDefaults.publicFixSummary}
                placeholder="What will the customer understand this line item covers?"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Internal research notes</span>
              <Textarea
                name="internalResearchNotes"
                rows={6}
                defaultValue={detail.formDefaults.internalResearchNotes}
                placeholder="Founder-only notes, pricing rationale, research links, edge cases, or confidence concerns."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Override min price (USD)</span>
                <Input name="overrideMinPriceUsd" type="number" min={0} defaultValue={detail.formDefaults.overrideMinPriceUsd} />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Override max price (USD)</span>
                <Input name="overrideMaxPriceUsd" type="number" min={0} defaultValue={detail.formDefaults.overrideMaxPriceUsd} />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Next review date</span>
                <Input name="nextReviewAt" type="date" defaultValue={detail.formDefaults.nextReviewAt} />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Change summary</span>
              <Textarea
                name="changeSummary"
                rows={3}
                placeholder="What changed and why?"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button type="submit" formAction={saveArchitectureRuleCatalogDraftAction} className={buttonVariants({ variant: "secondary" })}>
                Save draft
              </button>
              <button type="submit" formAction={publishArchitectureRuleCatalogAction} className={buttonVariants()}>
                Publish live revision
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Revision history</h2>
        </CardHeader>
        <CardContent>
          {detail.revisions.length === 0 ? (
            <p className="text-sm text-slate-600">No revisions yet. The runtime is still using the code-backed fallback for this rule.</p>
          ) : (
            <div className="space-y-3">
              {detail.revisions.map((revision) => (
                <article
                  key={revision.id}
                  className="rounded-3xl border border-border bg-background-elevated/85 px-4 py-4 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={revisionStatusVariant(revision.status)}>{revision.status}</Badge>
                    <Badge variant="secondary">v{revision.version}</Badge>
                    <Badge variant="info">{revision.pricingMode}</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">{revision.serviceLineLabel}</p>
                    <p>{revision.publicFixSummary}</p>
                    <p className="text-slate-600">{revision.internalResearchNotes || "No internal notes saved on this revision."}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span>Created: {formatDateTime(revision.createdAt)}</span>
                      <span>Published: {formatDateTime(revision.publishedAt)}</span>
                      <span>Effective: {formatDateTime(revision.effectiveAt)}</span>
                      <span>Changed by: {revision.changedByEmail ?? "unknown"}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Override range: {revision.overrideMinPriceUsd ?? "derived"} - {revision.overrideMaxPriceUsd ?? "derived"}
                    </p>
                    {revision.changeSummary ? <p className="text-xs text-slate-500">Change summary: {revision.changeSummary}</p> : null}
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
