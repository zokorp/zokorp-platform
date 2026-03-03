import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const context = await requireMlopsContext({
      organizationSlug: searchParams.get("organization") ?? undefined,
      minimumRole: OrganizationRole.ADMIN,
    });

    const logs = await db.auditLog.findMany({
      where: {
        organizationId: context.organization.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 150,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load audit logs" }, { status: 500 });
  }
}
