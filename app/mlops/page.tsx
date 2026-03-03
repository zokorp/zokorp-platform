import Link from "next/link";

import { db } from "@/lib/db";
import { getMlopsDashboardSnapshot, getTopProjectsByActivity } from "@/lib/mlops-data";

import { MlopsShell } from "@/components/mlops/mlops-shell";
import { CreateProjectForm, QueueJobForm } from "@/components/mlops/mlops-actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

export default async function MlopsOverviewPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const snapshot = await getMlopsDashboardSnapshot({
    organizationSlug: params.org,
  });

  const [projects, topProjects, recentJobs] = await Promise.all([
    db.mlopsProject.findMany({
      where: {
        organizationId: snapshot.organization.id,
        archived: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
      take: 100,
    }),
    getTopProjectsByActivity(snapshot.organization.id),
    db.mlopsJob.findMany({
      where: {
        organizationId: snapshot.organization.id,
      },
      include: {
        project: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    }),
  ]);

  return (
    <MlopsShell
      activeHref="/mlops"
      title="SMB MLOps Control Plane"
      description="Operate multi-tenant model workflows with BYO compute runners, tracked runs, model registry, deployment records, and usage-aware billing."
      organization={snapshot.organization}
      membership={snapshot.membership}
      memberships={snapshot.memberships}
      actions={
        <>
          <Link
            href={`/mlops/projects?org=${snapshot.organization.slug}`}
            className="focus-ring rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Manage Projects
          </Link>
          <Link
            href={`/mlops/settings/billing?org=${snapshot.organization.slug}`}
            className="focus-ring rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Billing
          </Link>
        </>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="surface lift-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Projects</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{snapshot.summary.projectCount}</p>
        </article>
        <article className="surface lift-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Jobs</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{snapshot.summary.jobCount}</p>
          <p className="mt-1 text-xs text-slate-600">Running now: {snapshot.summary.runningJobs}</p>
        </article>
        <article className="surface lift-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Registry Models</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{snapshot.summary.modelCount}</p>
        </article>
        <article className="surface lift-card rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Usage Job Units</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{snapshot.summary.usageJobUnits}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Operational Health</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Request Count</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.summary.requestCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Error Count</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.summary.errorCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Latency P50</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.summary.latencyP50Ms}ms</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Latency P95</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{snapshot.summary.latencyP95Ms}ms</p>
            </div>
          </div>
        </article>

        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Top Active Projects</h2>
          <div className="mt-3 space-y-2">
            {topProjects.length === 0 ? (
              <p className="text-sm text-slate-600">No projects yet. Create your first project below.</p>
            ) : (
              topProjects.map((project) => (
                <div key={project.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{project.name}</p>
                    <Link
                      href={`/mlops/projects/${project.id}?org=${snapshot.organization.slug}`}
                      className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Jobs: {project.jobCount} · Runs: {project.runCount} · Deployments: {project.deploymentCount}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CreateProjectForm organizationSlug={snapshot.organization.slug} />
        <QueueJobForm
          organizationSlug={snapshot.organization.slug}
          projects={projects}
        />
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Recent Jobs</h2>
        <div className="mt-3 space-y-2">
          {recentJobs.length === 0 ? (
            <p className="text-sm text-slate-600">No jobs queued yet.</p>
          ) : (
            recentJobs.map((job) => (
              <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{job.name}</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                    {job.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {job.project.name} · {job.type} · Created {new Date(job.createdAt).toLocaleString("en-US")}
                </p>
                <p className="mt-1 text-xs text-slate-500">Image: {job.containerImage}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </MlopsShell>
  );
}
