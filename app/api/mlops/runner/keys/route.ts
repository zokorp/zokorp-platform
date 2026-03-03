import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireMlopsContext } from "@/lib/mlops-auth";
import { createRunnerKey } from "@/lib/mlops-runner-keys";

const createSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  name: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get("organization");

    const context = await requireMlopsContext({
      organizationSlug: orgSlug ?? undefined,
      minimumRole: OrganizationRole.ADMIN,
    });

    const keys = await db.mlopsRunnerKey.findMany({
      where: {
        organizationId: context.organization.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load runner keys" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid runner key request" }, { status: 400 });
    }

    const context = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.ADMIN,
    });

    const created = await createRunnerKey({
      organizationId: context.organization.id,
      createdByUserId: context.user.id,
      name: parsed.data.name,
    });

    await db.auditLog.create({
      data: {
        userId: context.user.id,
        organizationId: context.organization.id,
        action: "mlops.runner_key_created",
        metadataJson: {
          runnerKeyId: created.runnerKey.id,
          keyPrefix: created.runnerKey.keyPrefix,
          name: created.runnerKey.name,
        },
      },
    });

    return NextResponse.json(
      {
        id: created.runnerKey.id,
        name: created.runnerKey.name,
        keyPrefix: created.runnerKey.keyPrefix,
        createdAt: created.runnerKey.createdAt,
        apiKey: created.plainKey,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to create runner key" }, { status: 500 });
  }
}
