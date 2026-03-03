import { db } from "@/lib/db";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";
import { MLOPS_MODEL_STAGE_LABEL } from "@/lib/mlops";

import { CreateModelForm } from "@/components/mlops/mlops-actions";
import { MlopsShell } from "@/components/mlops/mlops-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

export default async function MlopsModelsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const context = await getMlopsWorkspaceForPage({
    organizationSlug: params.org,
  });

  const [projects, models] = await Promise.all([
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
    db.mlopsModel.findMany({
      where: {
        organizationId: context.organization.id,
      },
      include: {
        project: {
          select: {
            name: true,
          },
        },
        versions: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return (
    <MlopsShell
      activeHref="/mlops/models"
      title="Model Registry"
      description="Store versioned models with explicit lifecycle stage promotion so release decisions remain auditable and repeatable."
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <CreateModelForm organizationSlug={context.organization.slug} projects={projects} />

        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Registry Entries</h2>
          <div className="mt-3 space-y-3">
            {models.length === 0 ? (
              <p className="text-sm text-slate-600">No models have been registered.</p>
            ) : (
              models.map((model) => (
                <article key={model.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <h3 className="font-semibold text-slate-900">{model.name}</h3>
                  <p className="mt-1 text-xs text-slate-600">Project: {model.project.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {model.versions.length === 0 ? (
                      <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
                        No versions
                      </span>
                    ) : (
                      model.versions.slice(0, 5).map((version) => (
                        <span
                          key={version.id}
                          className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700"
                        >
                          {version.version} · {MLOPS_MODEL_STAGE_LABEL[version.stage]}
                        </span>
                      ))
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </MlopsShell>
  );
}
