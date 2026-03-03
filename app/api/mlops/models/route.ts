import { MlopsModelStage, OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

const createModelSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1200).optional(),
  initialVersion: z.string().trim().min(1).max(40),
  stage: z.nativeEnum(MlopsModelStage).default(MlopsModelStage.DEV),
  notes: z.string().trim().max(1500).optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function reserveModelSlug(organizationId: string, projectId: string, base: string) {
  const normalized = slugify(base) || "model";

  for (let index = 0; index < 40; index += 1) {
    const slug = index === 0 ? normalized : `${normalized}-${index + 1}`;
    const existing = await db.mlopsModel.findUnique({
      where: {
        organizationId_projectId_slug: {
          organizationId,
          projectId,
          slug,
        },
      },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  return `${normalized}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const context = await requireMlopsContext({
      organizationSlug: searchParams.get("organization") ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const projectId = searchParams.get("projectId") ?? undefined;

    const models = await db.mlopsModel.findMany({
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
            name: true,
            slug: true,
          },
        },
        versions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        },
      },
    });

    return NextResponse.json({ models });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load models" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createModelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid model payload" }, { status: 400 });
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

    const slug = await reserveModelSlug(context.organization.id, parsed.data.projectId, parsed.data.name);

    const created = await db.$transaction(async (tx) => {
      const model = await tx.mlopsModel.create({
        data: {
          organizationId: context.organization.id,
          projectId: parsed.data.projectId,
          createdByUserId: context.user.id,
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
        },
      });

      const version = await tx.mlopsModelVersion.create({
        data: {
          organizationId: context.organization.id,
          modelId: model.id,
          createdByUserId: context.user.id,
          version: parsed.data.initialVersion,
          stage: parsed.data.stage,
          notes: parsed.data.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: context.user.id,
          organizationId: context.organization.id,
          action: "mlops.model_created",
          metadataJson: {
            modelId: model.id,
            versionId: version.id,
          },
        },
      });

      return { model, version };
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
    return NextResponse.json({ error: "Unable to create model" }, { status: 500 });
  }
}
