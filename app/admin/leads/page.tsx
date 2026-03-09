import { Role } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/admin-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type LeadDirectoryEntry = {
  email: string;
  name: string | null;
  companyName: string | null;
  hasAccount: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  firstSeenAt: Date;
  latestAt: Date;
  sources: Set<string>;
  submissionCount: number;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function upsertLeadEntry(
  map: Map<string, LeadDirectoryEntry>,
  input: {
    email: string;
    source: string;
    createdAt: Date;
    name?: string | null;
    companyName?: string | null;
    hasAccount?: boolean;
    emailVerified?: boolean;
    isAdmin?: boolean;
  },
) {
  const email = input.email.trim().toLowerCase();

  if (!email) {
    return;
  }

  const existing = map.get(email);

  if (!existing) {
    map.set(email, {
      email,
      name: input.name?.trim() || null,
      companyName: input.companyName?.trim() || null,
      hasAccount: Boolean(input.hasAccount),
      emailVerified: Boolean(input.emailVerified),
      isAdmin: Boolean(input.isAdmin),
      firstSeenAt: input.createdAt,
      latestAt: input.createdAt,
      sources: new Set([input.source]),
      submissionCount: input.source === "account" ? 0 : 1,
    });
    return;
  }

  existing.sources.add(input.source);
  existing.hasAccount ||= Boolean(input.hasAccount);
  existing.emailVerified ||= Boolean(input.emailVerified);
  existing.isAdmin ||= Boolean(input.isAdmin);
  existing.firstSeenAt = existing.firstSeenAt < input.createdAt ? existing.firstSeenAt : input.createdAt;
  existing.latestAt = existing.latestAt > input.createdAt ? existing.latestAt : input.createdAt;

  if (!existing.name && input.name?.trim()) {
    existing.name = input.name.trim();
  }

  if (!existing.companyName && input.companyName?.trim()) {
    existing.companyName = input.companyName.trim();
  }

  if (input.source !== "account") {
    existing.submissionCount += 1;
  }
}

async function getLeadDirectory(searchQuery?: string) {
  const [users, architectureLeads, landingZoneSubmissions, cloudCostSubmissions, aiDeciderSubmissions] =
    await Promise.all([
      db.user.findMany({
        select: {
          email: true,
          name: true,
          emailVerified: true,
          role: true,
          createdAt: true,
        },
      }),
      db.leadLog.findMany({
        select: {
          userEmail: true,
          userName: true,
          createdAt: true,
        },
      }),
      db.landingZoneReadinessSubmission.findMany({
        select: {
          email: true,
          fullName: true,
          companyName: true,
          createdAt: true,
        },
      }),
      db.cloudCostLeakFinderSubmission.findMany({
        select: {
          email: true,
          fullName: true,
          companyName: true,
          createdAt: true,
        },
      }),
      db.aiDeciderSubmission.findMany({
        select: {
          email: true,
          fullName: true,
          companyName: true,
          createdAt: true,
        },
      }),
    ]);

  const entries = new Map<string, LeadDirectoryEntry>();

  for (const user of users) {
    if (!user.email) {
      continue;
    }

    upsertLeadEntry(entries, {
      email: user.email,
      source: "account",
      createdAt: user.createdAt,
      name: user.name,
      hasAccount: true,
      emailVerified: Boolean(user.emailVerified),
      isAdmin: user.role === Role.ADMIN,
    });
  }

  for (const lead of architectureLeads) {
    upsertLeadEntry(entries, {
      email: lead.userEmail,
      source: "architecture-review",
      createdAt: lead.createdAt,
      name: lead.userName,
    });
  }

  for (const submission of landingZoneSubmissions) {
    upsertLeadEntry(entries, {
      email: submission.email,
      source: "landing-zone",
      createdAt: submission.createdAt,
      name: submission.fullName,
      companyName: submission.companyName,
    });
  }

  for (const submission of cloudCostSubmissions) {
    upsertLeadEntry(entries, {
      email: submission.email,
      source: "cloud-cost",
      createdAt: submission.createdAt,
      name: submission.fullName,
      companyName: submission.companyName,
    });
  }

  for (const submission of aiDeciderSubmissions) {
    upsertLeadEntry(entries, {
      email: submission.email,
      source: "ai-decider",
      createdAt: submission.createdAt,
      name: submission.fullName,
      companyName: submission.companyName,
    });
  }

  const normalizedQuery = searchQuery?.trim().toLowerCase() ?? "";
  const allEntries = [...entries.values()]
    .filter((entry) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        entry.email,
        entry.name ?? "",
        entry.companyName ?? "",
        ...entry.sources,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => right.latestAt.getTime() - left.latestAt.getTime());

  return {
    entries: allEntries,
    stats: {
      uniqueContacts: allEntries.length,
      accountHolders: allEntries.filter((entry) => entry.hasAccount).length,
      verifiedAccounts: allEntries.filter((entry) => entry.emailVerified).length,
      diagnosticLeads: allEntries.filter((entry) => [...entry.sources].some((source) => source !== "account")).length,
    },
  };
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const query = await searchParams;

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

  const directory = await getLeadDirectory(query?.q);

  return (
    <div className="space-y-6">
      <Card tone="glass" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin Workspace</p>
            <h1 className="font-display text-4xl font-semibold text-slate-900">Lead Directory</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Review unique account and tool-submission emails across the platform without direct database access.
            </p>
          </div>
          <AdminNav current="leads" />
        </CardHeader>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Unique contacts", value: directory.stats.uniqueContacts },
          { label: "Account holders", value: directory.stats.accountHolders },
          { label: "Verified accounts", value: directory.stats.verifiedAccounts },
          { label: "Diagnostic leads", value: directory.stats.diagnosticLeads },
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

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader className="gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Directory search</h2>
            <p className="text-sm text-slate-600">Filter by email, company, contact name, or lead source.</p>
          </div>
          <form className="flex flex-col gap-3 md:flex-row">
            <Input name="q" defaultValue={query?.q ?? ""} placeholder="Search by email, company, or source" />
            <button type="submit" className={buttonVariants()}>
              Search
            </button>
            <Link href="/admin/leads" className={buttonVariants({ variant: "secondary" })}>
              Clear
            </Link>
          </form>
        </CardHeader>
      </Card>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
        <CardHeader>
          <h2 className="font-display text-2xl font-semibold text-slate-900">Known contacts</h2>
          <p className="text-sm text-slate-600">
            Each row collapses repeated submissions into one email-level contact record.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {directory.entries.length === 0 ? (
            <Alert tone="info">
              <AlertTitle>No contacts found</AlertTitle>
              <AlertDescription>Try a broader search or wait for the next lead to arrive.</AlertDescription>
            </Alert>
          ) : (
            directory.entries.map((entry) => (
              <div key={entry.email} className="rounded-3xl border border-border bg-white/90 p-4 shadow-[var(--shadow-soft)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{entry.email}</p>
                      {entry.emailVerified ? <Badge variant="success">Verified</Badge> : null}
                      {entry.hasAccount ? <Badge variant="secondary">Account</Badge> : null}
                      {entry.isAdmin ? <Badge variant="brand">Admin</Badge> : null}
                    </div>
                    <p className="text-sm text-slate-600">
                      {[entry.name, entry.companyName].filter(Boolean).join(" · ") || "No name/company captured yet"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[...entry.sources].sort().map((source) => (
                        <Badge key={source} variant="outline">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
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
