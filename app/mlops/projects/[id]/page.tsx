import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";

import { MlopsShell } from "@/components/mlops/mlops-shell";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
};

export const dynamic = "force-dynamic";

export default async function MlopsProjectDetailPage({ params, searchParams }: PageProps) {
  const [routeParams, query] = await Promise.all([params, searchParams]);

  const context = await getMlopsWorkspaceForPage({
    organizationSlug: query.org,
  });

  const project = await db.mlopsProject.findFirst({
    where: {
      id: routeParams.id,
      organizationId: context.organization.id,
    },
    include: {
      jobs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 25,
      },
      runs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 25,
      },
      models: {
        include: {
          versions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      deployments: {
        include: {
          modelVersion: {
            include: {
              model: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      artifacts: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <MlopsShell
      activeHref="/mlops/projects"
      title={project.name}
      description={project.description ?? "Project overview, runs, models, deployments, and artifacts."}
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
      actions={
        <Link
          href={`/mlops/projects?org=${context.organization.slug}`}
          className="focus-ring rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
        >
          Back to projects
        </Link>
      }
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Jobs</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{project.jobs.length}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Runs</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{project.runs.length}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Models</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{project.models.length}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Deployments</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{project.deployments.length}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Recent Jobs</h2>
          <div className="mt-3 space-y-2">
            {project.jobs.length === 0 ? (
              <p className="text-sm text-slate-600">No jobs yet for this project.</p>
            ) : (
              project.jobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{job.name}</p>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                      {job.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {job.type} · Runner: {job.claimedByRunnerName ?? "Not claimed"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Latest Runs</h2>
          <div className="mt-3 space-y-2">
            {project.runs.length === 0 ? (
              <p className="text-sm text-slate-600">No runs yet.</p>
            ) : (
              project.runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{run.name}</p>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                      {run.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Created {new Date(run.createdAt).toLocaleString("en-US")}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Model Registry</h2>
          <div className="mt-3 space-y-2">
            {project.models.length === 0 ? (
              <p className="text-sm text-slate-600">No models registered in this project.</p>
            ) : (
              project.models.map((model) => (
                <div key={model.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-900">{model.name}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {model.versions[0] ? `${model.versions[0].version} · ${model.versions[0].stage}` : "No version"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Deployment Records</h2>
          <div className="mt-3 space-y-2">
            {project.deployments.length === 0 ? (
              <p className="text-sm text-slate-600">No deployments yet.</p>
            ) : (
              project.deployments.map((deployment) => (
                <div key={deployment.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-900">{deployment.name}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {deployment.environment} · {deployment.status} · {deployment.modelVersion?.model.name ?? "No model"}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Artifacts</h2>
        <div className="mt-3 space-y-2">
          {project.artifacts.length === 0 ? (
            <p className="text-sm text-slate-600">No artifacts recorded yet.</p>
          ) : (
            project.artifacts.map((artifact) => (
              <div key={artifact.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-900">{artifact.displayName}</p>
                <p className="mt-1 break-all text-xs text-slate-600">{artifact.storagePath}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </MlopsShell>
  );
}
