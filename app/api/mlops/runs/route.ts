import { MlopsRunStatus, OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationSlug = searchParams.get("organization");
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status") as MlopsRunStatus | null;

    const context = await requireMlopsContext({
      organizationSlug: organizationSlug ?? undefined,
      minimumRole: OrganizationRole.VIEWER,
    });

    const runs = await db.mlopsRun.findMany({
      where: {
        organizationId: context.organization.id,
        projectId: projectId ?? undefined,
        status: status ?? undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
      include: {
        project: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        job: {
          select: {
            id: true,
            type: true,
            status: true,
            claimedByRunnerName: true,
          },
        },
      },
    });

    return NextResponse.json({ runs });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load runs" }, { status: 500 });
  }
}
