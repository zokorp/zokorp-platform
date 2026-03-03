import { db } from "@/lib/db";
import { getMlopsWorkspaceForPage } from "@/lib/mlops-data";
import { calculateP50, calculateP95 } from "@/lib/mlops";

import { MlopsShell } from "@/components/mlops/mlops-shell";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ org?: string }>;
};

function aggregateByMetric(events: Array<{ metricName: string; metricValue: number }>) {
  const latency = events.filter((event) => event.metricName === "latency_ms").map((event) => event.metricValue);
  const requestCount = events
    .filter((event) => event.metricName === "request_count")
    .reduce((sum, event) => sum + event.metricValue, 0);
  const errorCount = events
    .filter((event) => event.metricName === "error_count")
    .reduce((sum, event) => sum + event.metricValue, 0);

  return {
    requestCount,
    errorCount,
    latencyP50: Number(calculateP50(latency).toFixed(2)),
    latencyP95: Number(calculateP95(latency).toFixed(2)),
  };
}

export default async function MlopsMonitoringPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const context = await getMlopsWorkspaceForPage({ organizationSlug: params.org });

  const [events, driftSnapshots] = await Promise.all([
    db.mlopsMonitoringEvent.findMany({
      where: {
        organizationId: context.organization.id,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 500,
      include: {
        deployment: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.mlopsDriftSnapshot.findMany({
      where: {
        organizationId: context.organization.id,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 80,
      include: {
        deployment: {
          select: {
            id: true,
            name: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const summary = aggregateByMetric(events);

  return (
    <MlopsShell
      activeHref="/mlops/monitoring"
      title="Monitoring and Drift"
      description="Track core operational signals and lightweight drift checks for batch scoring pipelines."
      organization={context.organization}
      membership={context.membership}
      memberships={context.memberships}
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Request Count</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{summary.requestCount}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Error Count</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{summary.errorCount}</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Latency P50</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{summary.latencyP50} ms</p>
        </article>
        <article className="surface rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Latency P95</p>
          <p className="font-display mt-1 text-3xl font-semibold text-slate-900">{summary.latencyP95} ms</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Recent Monitoring Events</h2>
          <div className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-slate-600">No monitoring events recorded yet.</p>
            ) : (
              events.slice(0, 40).map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{event.metricName}</p>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                      {event.metricValue}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {event.project.name} · {event.deployment?.name ?? "No deployment"} · {new Date(event.recordedAt).toLocaleString("en-US")}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="surface rounded-2xl p-5">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Drift Snapshots</h2>
          <div className="mt-3 space-y-2">
            {driftSnapshots.length === 0 ? (
              <p className="text-sm text-slate-600">No drift snapshots captured yet.</p>
            ) : (
              driftSnapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{snapshot.featureName}</p>
                    <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700">
                      Drift {snapshot.driftScore}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {snapshot.project.name} · {snapshot.deployment?.name ?? "No deployment"} · {new Date(snapshot.recordedAt).toLocaleString("en-US")}
                  </p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </MlopsShell>
  );
}
