import { db } from "@/lib/db";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";

import { CreateDeploymentForm } from "@/components/mlops/mlops-actions";
import { MlopsShell } from "@/components/mlops/mlops-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

export default async function MlopsDeploymentsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const context = await getMlopsWorkspaceForPage({ organizationSlug: params.org });

  const [projects, versions, deployments] = await Promise.all([
    db.mlopsProject.findMany({
      where: {
        organizationId: context.organization.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
      },
    }),
    db.mlopsModelVersion.findMany({
      where: {
        organizationId: context.organization.id,
      },
      include: {
        model: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
    db.mlopsDeployment.findMany({
      where: {
        organizationId: context.organization.id,
      },
      include: {
        project: {
          select: {
            name: true,
          },
        },
        modelVersion: {
          include: {
            model: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),
  ]);

  return (
    <MlopsShell
      activeHref="/mlops/deployments"
      title="Deployment Records"
      description="Track every deployment target, environment, and model version assignment while execution remains in customer-owned infrastructure."
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <CreateDeploymentForm
          organizationSlug={context.organization.slug}
          projects={projects}
          modelVersions={versions.map((version) => ({
            id: version.id,
            label: `${version.model.name} ${version.version} (${version.stage})`,
          }))}
        />

        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Deployment Timeline</h2>
          <div className="mt-3 space-y-2">
            {deployments.length === 0 ? (
              <p className="text-sm text-slate-600">No deployment records yet.</p>
            ) : (
              deployments.map((deployment) => (
                <article key={deployment.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{deployment.name}</p>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                      {deployment.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {deployment.project.name} · {deployment.environment} · {deployment.modelVersion?.model.name ?? "No model"} {deployment.modelVersion?.version ?? ""}
                  </p>
                  {deployment.endpointUrl ? (
                    <p className="mt-1 break-all text-xs text-slate-600">Endpoint: {deployment.endpointUrl}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </MlopsShell>
  );
}
