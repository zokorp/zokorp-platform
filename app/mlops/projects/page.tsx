import Link from "next/link";

import { db } from "@/lib/db";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";

import { CreateProjectForm, QueueJobForm } from "@/components/mlops/mlops-actions";
import { MlopsShell } from "@/components/mlops/mlops-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

export default async function MlopsProjectsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const context = await getMlopsWorkspaceForPage({
    organizationSlug: params.org,
  });

  const projects = await db.mlopsProject.findMany({
    where: {
      organizationId: context.organization.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          jobs: true,
          runs: true,
          models: true,
          deployments: true,
        },
      },
    },
  });

  return (
    <MlopsShell
      activeHref="/mlops/projects"
      title="Project Workspace"
      description="Create isolated projects per customer or product line, then run jobs and track deployment lifecycles without cross-tenant bleed."
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <CreateProjectForm organizationSlug={context.organization.slug} />
        <QueueJobForm
          organizationSlug={context.organization.slug}
          projects={projects.map((project) => ({ id: project.id, name: project.name, slug: project.slug }))}
        />
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Projects</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {projects.length === 0 ? (
            <p className="text-sm text-slate-600">No projects yet.</p>
          ) : (
            projects.map((project) => (
              <article key={project.id} className="lift-card rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-semibold text-slate-900">{project.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">Slug: {project.slug}</p>
                  </div>
                  <Link
                    href={`/mlops/projects/${project.id}?org=${context.organization.slug}`}
                    className="focus-ring rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Open
                  </Link>
                </div>
                {project.description ? <p className="mt-2 text-sm text-slate-700">{project.description}</p> : null}
                <p className="mt-3 text-xs text-slate-600">
                  Jobs: {project._count.jobs} · Runs: {project._count.runs} · Models: {project._count.models} · Deployments: {project._count.deployments}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </MlopsShell>
  );
}
