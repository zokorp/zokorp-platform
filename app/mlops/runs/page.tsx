import { MlopsRunStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";

import { MlopsShell } from "@/components/mlops/mlops-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string; status?: MlopsRunStatus }>;
};

export default async function MlopsRunsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const context = await getMlopsWorkspaceForPage({
    organizationSlug: params.org,
  });

  const runs = await db.mlopsRun.findMany({
    where: {
      organizationId: context.organization.id,
      status: params.status,
    },
    include: {
      project: {
        select: {
          name: true,
          slug: true,
        },
      },
      job: {
        select: {
          id: true,
          status: true,
          type: true,
          claimedByRunnerName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 150,
  });

  return (
    <MlopsShell
      activeHref="/mlops/runs"
      title="Run Tracking"
      description="Review every training or scoring run with status, runner attribution, and captured metrics for auditability."
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
    >
      <section className="surface rounded-2xl p-5">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Recent Runs</h2>
        <div className="mt-3 space-y-2">
          {runs.length === 0 ? (
            <p className="text-sm text-slate-600">No runs yet.</p>
          ) : (
            runs.map((run) => (
              <article key={run.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{run.name}</p>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                    {run.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {run.project.name} · {run.job?.type ?? "No job type"} · {run.job?.status ?? "Unknown job"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Runner: {run.job?.claimedByRunnerName ?? "Unclaimed"} · Created {new Date(run.createdAt).toLocaleString("en-US")}
                </p>
                {run.metricsJson ? (
                  <details className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-700">Metrics JSON</summary>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-slate-700">
                      {JSON.stringify(run.metricsJson, null, 2)}
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
