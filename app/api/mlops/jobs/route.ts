import { MlopsJobStatus, MlopsJobType, OrganizationRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

const createJobSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(3).max(120),
  type: z.nativeEnum(MlopsJobType),
  containerImage: z.string().trim().min(3).max(240),
  command: z.array(z.string().trim().min(1)).max(32).optional(),
  env: z.record(z.string(), z.string()).optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationSlug = searchParams.get("organization");
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status") as MlopsJobStatus | null;

    const { organization } = await requireMlopsContext({
      organizationSlug: organizationSlug ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const jobs = await db.mlopsJob.findMany({
      where: {
        organizationId: organization.id,
        projectId: projectId ?? undefined,
        status: status ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return NextResponse.json({
      jobs,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load jobs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid job input." }, { status: 400 });
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
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found in organization." }, { status: 404 });
    }

    const created = await db.$transaction(async (tx) => {
      const job = await tx.mlopsJob.create({
        data: {
          organizationId: context.organization.id,
          projectId: project.id,
          createdByUserId: context.user.id,
          name: parsed.data.name,
          type: parsed.data.type,
          containerImage: parsed.data.containerImage,
          commandJson: parsed.data.command,
          envJson: parsed.data.env as Prisma.InputJsonValue | undefined,
          inputsJson: parsed.data.inputs as Prisma.InputJsonValue | undefined,
          status: MlopsJobStatus.QUEUED,
        },
      });

      const run = await tx.mlopsRun.create({
        data: {
          organizationId: context.organization.id,
          projectId: project.id,
          createdByUserId: context.user.id,
          jobId: job.id,
          name: `${parsed.data.name} run`,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: context.user.id,
          organizationId: context.organization.id,
          action: "mlops.job_queued",
          metadataJson: {
            jobId: job.id,
            runId: run.id,
            projectId: project.id,
            type: job.type,
          },
        },
      });

      return { job, run };
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
    return NextResponse.json({ error: "Unable to queue job" }, { status: 500 });
  }
}
