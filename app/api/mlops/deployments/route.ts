import { MlopsDeploymentStatus, OrganizationRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

const createDeploymentSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  projectId: z.string().trim().min(1),
  modelVersionId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(100),
  environment: z.string().trim().min(2).max(60),
  endpointUrl: z.string().trim().url().optional(),
  configJson: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const context = await requireMlopsContext({
      organizationSlug: searchParams.get("organization") ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const projectId = searchParams.get("projectId") ?? undefined;

    const deployments = await db.mlopsDeployment.findMany({
      where: {
        organizationId: context.organization.id,
        projectId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        project: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        modelVersion: {
          include: {
            model: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({ deployments });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load deployments" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createDeploymentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid deployment payload" }, { status: 400 });
    }

    const context = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.MEMBER,
    });

    const modelVersion = await db.mlopsModelVersion.findFirst({
      where: {
        id: parsed.data.modelVersionId,
        organizationId: context.organization.id,
      },
      select: {
        id: true,
      },
    });

    if (!modelVersion) {
      return NextResponse.json({ error: "Model version not found" }, { status: 404 });
    }

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

    const created = await db.mlopsDeployment.create({
      data: {
        organizationId: context.organization.id,
        projectId: project.id,
        createdByUserId: context.user.id,
        modelVersionId: parsed.data.modelVersionId,
        name: parsed.data.name,
        environment: parsed.data.environment,
        endpointUrl: parsed.data.endpointUrl,
        configJson: parsed.data.configJson as Prisma.InputJsonValue | undefined,
        status: MlopsDeploymentStatus.DRAFT,
      },
    });

    await db.auditLog.create({
      data: {
        userId: context.user.id,
        organizationId: context.organization.id,
        action: "mlops.deployment_created",
        metadataJson: {
          deploymentId: created.id,
          projectId: project.id,
          environment: created.environment,
        },
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
    return NextResponse.json({ error: "Unable to create deployment" }, { status: 500 });
  }
}
