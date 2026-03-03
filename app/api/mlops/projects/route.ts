import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

const createProjectSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  name: z.string().trim().min(3).max(100),
  description: z.string().trim().max(1000).optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function reserveProjectSlug(organizationId: string, base: string) {
  const normalized = slugify(base) || "project";
  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? normalized : `${normalized}-${index + 1}`;
    const existing = await db.mlopsProject.findUnique({
      where: {
        organizationId_slug: {
          organizationId,
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
    const organizationSlug = searchParams.get("organization");

    const { organization } = await requireMlopsContext({
      organizationSlug: organizationSlug ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const projects = await db.mlopsProject.findMany({
      where: {
        organizationId: organization.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            jobs: true,
            runs: true,
            models: true,
            deployments: true,
          },
        },
      },
    });

    return NextResponse.json({
      organization: {
        id: organization.id,
        slug: organization.slug,
        name: organization.name,
      },
      projects,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid project input." }, { status: 400 });
    }

    const context = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.MEMBER,
    });

    const slug = await reserveProjectSlug(context.organization.id, parsed.data.name);

    const project = await db.mlopsProject.create({
      data: {
        organizationId: context.organization.id,
        createdByUserId: context.user.id,
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
      },
    });

    await db.auditLog.create({
      data: {
        userId: context.user.id,
        organizationId: context.organization.id,
        action: "mlops.project_created",
        metadataJson: {
          projectId: project.id,
          projectSlug: project.slug,
          name: project.name,
        },
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}
