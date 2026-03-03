import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

const createSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  projectId: z.string().trim().min(1),
  deploymentId: z.string().trim().min(1).optional(),
  metricName: z.string().trim().min(2).max(80),
  metricValue: z.number().finite(),
  dimensionJson: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  recordedAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const context = await requireMlopsContext({
      organizationSlug: searchParams.get("organization") ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const projectId = searchParams.get("projectId") ?? undefined;
    const deploymentId = searchParams.get("deploymentId") ?? undefined;

    const events = await db.mlopsMonitoringEvent.findMany({
      where: {
        organizationId: context.organization.id,
        projectId,
        deploymentId,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 500,
    });

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load monitoring events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid monitoring event payload" }, { status: 400 });
    }

    const context = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.MEMBER,
    });

    const project = await db.mlopsProject.findFirst({
      where: {
        id: parsed.data.projectId,
        organizationId: context.organization.id,
      },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (parsed.data.deploymentId) {
      const deployment = await db.mlopsDeployment.findFirst({
        where: {
          id: parsed.data.deploymentId,
          organizationId: context.organization.id,
          projectId: parsed.data.projectId,
        },
        select: { id: true },
      });

      if (!deployment) {
        return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
      }
    }

    const created = await db.mlopsMonitoringEvent.create({
      data: {
        organizationId: context.organization.id,
        projectId: parsed.data.projectId,
        deploymentId: parsed.data.deploymentId,
        metricName: parsed.data.metricName,
        metricValue: parsed.data.metricValue,
        dimensionJson: parsed.data.dimensionJson,
        recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : undefined,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to create monitoring event" }, { status: 500 });
  }
}
