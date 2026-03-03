import { OrganizationRole } from "@prisma/client";

import { db } from "@/lib/db";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";

import { CreateRunnerKeyForm, UpdateMemberRoleForm } from "@/components/mlops/mlops-actions";
import { MlopsShell } from "@/components/mlops/mlops-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

export default async function MlopsOrganizationSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const context = await getMlopsWorkspaceForPage({
    organizationSlug: params.org,
    minimumRole: OrganizationRole.ADMIN,
  });

  const [members, runnerKeys, auditLogs] = await Promise.all([
    db.organizationMember.findMany({
      where: {
        organizationId: context.organization.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    db.mlopsRunnerKey.findMany({
      where: {
        organizationId: context.organization.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.auditLog.findMany({
      where: {
        organizationId: context.organization.id,
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 80,
    }),
  ]);

  return (
    <MlopsShell
      activeHref="/mlops/settings/organization"
      title="Organization Security"
      description="Manage member roles, persona preferences, runner credentials, and organization audit trails."
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <CreateRunnerKeyForm organizationSlug={context.organization.slug} />

        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Runner Keys</h2>
          <div className="mt-3 space-y-2">
            {runnerKeys.length === 0 ? (
              <p className="text-sm text-slate-600">No runner keys created yet.</p>
            ) : (
              runnerKeys.map((runnerKey) => (
                <article key={runnerKey.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{runnerKey.name}</p>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                      {runnerKey.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Prefix: {runnerKey.keyPrefix}</p>
                  <p className="text-xs text-slate-600">
                    Last used: {runnerKey.lastUsedAt ? new Date(runnerKey.lastUsedAt).toLocaleString("en-US") : "Never"}
                  </p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Members and Roles</h2>
        <div className="mt-3 space-y-2">
          {members.map((member) => (
            <article key={member.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{member.user.name ?? member.user.email ?? member.userId}</p>
                  <p className="text-xs text-slate-600">{member.user.email ?? "No email"}</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                  Joined {new Date(member.createdAt).toLocaleDateString("en-US")}
                </span>
              </div>
              <div className="mt-3 max-w-sm">
                <UpdateMemberRoleForm
                  organizationSlug={context.organization.slug}
                  membershipId={member.id}
                  currentRole={member.role}
                  currentPersona={member.workspacePersona}
                  isCurrentUser={member.userId === context.user.id}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Audit Log</h2>
        <div className="mt-3 space-y-2">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-600">No organization audit events yet.</p>
          ) : (
            auditLogs.map((log) => (
              <article key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{log.action}</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                    {new Date(log.createdAt).toLocaleString("en-US")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">Actor: {log.user?.email ?? "system"}</p>
                {log.metadataJson ? (
                  <details className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-700">Metadata</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-700">
                      {JSON.stringify(log.metadataJson, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>
    </MlopsShell>
  );
}
