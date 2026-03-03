import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { calculateP50, calculateP95 } from "@/lib/mlops";
import { requireMlopsContext } from "@/lib/mlops-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const context = await requireMlopsContext({
      organizationSlug: searchParams.get("organization") ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const [projectCount, jobCount, runningJobs, modelCount, deploymentCount, recentMetrics, usageTotal] =
      await Promise.all([
        db.mlopsProject.count({ where: { organizationId: context.organization.id } }),
        db.mlopsJob.count({ where: { organizationId: context.organization.id } }),
        db.mlopsJob.count({ where: { organizationId: context.organization.id, status: "RUNNING" } }),
        db.mlopsModel.count({ where: { organizationId: context.organization.id } }),
        db.mlopsDeployment.count({ where: { organizationId: context.organization.id } }),
        db.mlopsMonitoringEvent.findMany({
          where: {
            organizationId: context.organization.id,
            metricName: {
              in: ["latency_ms", "request_count", "error_count"],
            },
          },
          orderBy: {
            recordedAt: "desc",
          },
          take: 200,
        }),
        db.mlopsUsageLedger.aggregate({
          where: {
            organizationId: context.organization.id,
            kind: "JOB_UNITS",
          },
          _sum: {
            quantity: true,
          },
        }),
      ]);

    const latencyValues = recentMetrics
      .filter((event) => event.metricName === "latency_ms")
      .map((event) => event.metricValue);

    const requestCount = recentMetrics
      .filter((event) => event.metricName === "request_count")
      .reduce((sum, event) => sum + event.metricValue, 0);

    const errorCount = recentMetrics
      .filter((event) => event.metricName === "error_count")
      .reduce((sum, event) => sum + event.metricValue, 0);

    return NextResponse.json({
      organization: {
        id: context.organization.id,
        slug: context.organization.slug,
        name: context.organization.name,
        role: context.membership.role,
        persona: context.membership.workspacePersona,
        onboardingMode: context.organization.onboardingMode,
        billingPlan: context.organization.billingPlan,
      },
      metrics: {
        projectCount,
        jobCount,
        runningJobs,
        modelCount,
        deploymentCount,
        usageJobUnits: usageTotal._sum.quantity ?? 0,
        latencyP50Ms: Number(calculateP50(latencyValues).toFixed(2)),
        latencyP95Ms: Number(calculateP95(latencyValues).toFixed(2)),
        requestCount,
        errorCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load MLOps overview" }, { status: 500 });
  }
}
