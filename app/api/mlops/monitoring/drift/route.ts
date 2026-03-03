import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { simpleDistributionDrift } from "@/lib/mlops";
import { requireMlopsContext } from "@/lib/mlops-auth";

const createSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  projectId: z.string().trim().min(1),
  deploymentId: z.string().trim().min(1).optional(),
  featureName: z.string().trim().min(1).max(80),
  baseline: z.array(z.number().finite()).min(3).max(2000),
  current: z.array(z.number().finite()).min(3).max(2000),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const context = await requireMlopsContext({
      organizationSlug: searchParams.get("organization") ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const snapshots = await db.mlopsDriftSnapshot.findMany({
      where: {
        organizationId: context.organization.id,
        projectId: searchParams.get("projectId") ?? undefined,
        deploymentId: searchParams.get("deploymentId") ?? undefined,
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: 120,
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load drift snapshots" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid drift payload" }, { status: 400 });
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
      select: {
        id: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (parsed.data.deploymentId) {
      const deployment = await db.mlopsDeployment.findFirst({
        where: {
          id: parsed.data.deploymentId,
          organizationId: context.organization.id,
          projectId: project.id,
        },
        select: {
          id: true,
        },
      });

      if (!deployment) {
        return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
      }
    }

    const driftScore = simpleDistributionDrift({
      baseline: parsed.data.baseline,
      current: parsed.data.current,
    });

    const created = await db.mlopsDriftSnapshot.create({
      data: {
        organizationId: context.organization.id,
        projectId: project.id,
        deploymentId: parsed.data.deploymentId,
        featureName: parsed.data.featureName,
        baselineJson: parsed.data.baseline,
        currentJson: parsed.data.current,
        driftScore,
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
    return NextResponse.json({ error: "Unable to create drift snapshot" }, { status: 500 });
  }
}
