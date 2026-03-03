import { OrganizationRole, WorkspacePersona } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { hasOrgRole, requireMlopsContext } from "@/lib/mlops-auth";

const updateSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  membershipId: z.string().trim().min(1),
  role: z.nativeEnum(OrganizationRole).optional(),
  workspacePersona: z.nativeEnum(WorkspacePersona).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const context = await requireMlopsContext({
      organizationSlug: searchParams.get("organization") ?? undefined,
      minimumRole: OrganizationRole.ADMIN,
    });

    const members = await db.organizationMember.findMany({
      where: {
        organizationId: context.organization.id,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to load members" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid member update payload" }, { status: 400 });
    }

    const context = await requireMlopsContext({
      organizationSlug: parsed.data.organizationSlug,
      minimumRole: OrganizationRole.ADMIN,
    });

    const membership = await db.organizationMember.findFirst({
      where: {
        id: parsed.data.membershipId,
        organizationId: context.organization.id,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const nextRole = parsed.data.role ?? membership.role;
    if (!hasOrgRole(context.membership.role, nextRole)) {
      return NextResponse.json({ error: "You cannot assign a role above your own role." }, { status: 403 });
    }

    if (membership.role === OrganizationRole.OWNER && nextRole !== OrganizationRole.OWNER) {
      const ownerCount = await db.organizationMember.count({
        where: {
          organizationId: context.organization.id,
          role: OrganizationRole.OWNER,
        },
      });

      if (ownerCount <= 1) {
        return NextResponse.json({ error: "Organization must keep at least one owner." }, { status: 400 });
      }
    }

    const updated = await db.organizationMember.update({
      where: {
        id: membership.id,
      },
      data: {
        role: nextRole,
        workspacePersona: parsed.data.workspacePersona ?? membership.workspacePersona,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });

    await db.auditLog.create({
      data: {
        userId: context.user.id,
        organizationId: context.organization.id,
        action: "mlops.organization_member_updated",
        metadataJson: {
          membershipId: membership.id,
          role: updated.role,
          workspacePersona: updated.workspacePersona,
        },
      },
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to update member" }, { status: 500 });
  }
}
