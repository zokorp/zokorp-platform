import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get("organization");
    const { id } = await context.params;

    const { organization } = await requireMlopsContext({
      organizationSlug: orgSlug ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const job = await db.mlopsJob.findFirst({
      where: {
        id,
        organizationId: organization.id,
      },
      include: {
        project: true,
        run: true,
        logs: {
          orderBy: {
            sequence: "asc",
          },
        },
        artifacts: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load job" }, { status: 500 });
  }
}
