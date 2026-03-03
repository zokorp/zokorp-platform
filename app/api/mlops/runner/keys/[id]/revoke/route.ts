import { OrganizationRole, RunnerKeyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";

const bodySchema = z.object({
  organizationSlug: z.string().trim().min(2),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid revoke input" }, { status: 400 });
    }

    const { id } = await context.params;

    const mlopsContext = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.ADMIN,
    });

    const runnerKey = await db.mlopsRunnerKey.findFirst({
      where: {
        id,
        organizationId: mlopsContext.organization.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!runnerKey) {
      return NextResponse.json({ error: "Runner key not found" }, { status: 404 });
    }

    if (runnerKey.status === RunnerKeyStatus.REVOKED) {
      return NextResponse.json({ ok: true });
    }

    await db.$transaction([
      db.mlopsRunnerKey.update({
        where: {
          id,
        },
        data: {
          status: RunnerKeyStatus.REVOKED,
          revokedAt: new Date(),
        },
      }),
      db.auditLog.create({
        data: {
          userId: mlopsContext.user.id,
          organizationId: mlopsContext.organization.id,
          action: "mlops.runner_key_revoked",
          metadataJson: {
            runnerKeyId: id,
          },
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to revoke runner key" }, { status: 500 });
  }
}
