import { OnboardingMode, WorkspacePersona } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createOrganizationForUser, listOrganizationsForUser } from "@/lib/mlops-auth";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(3).max(80),
  onboardingMode: z.nativeEnum(OnboardingMode).optional(),
  workspacePersona: z.nativeEnum(WorkspacePersona).optional(),
});

export async function GET() {
  try {
    const memberships = await listOrganizationsForUser();

    return NextResponse.json({
      organizations: memberships.map((membership) => ({
        organizationId: membership.organization.id,
        slug: membership.organization.slug,
        name: membership.organization.name,
        role: membership.role,
        persona: membership.workspacePersona,
        onboardingMode: membership.organization.onboardingMode,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error(error);
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = createOrganizationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid organization input." }, { status: 400 });
    }

    const created = await createOrganizationForUser({
      user,
      name: parsed.data.name,
      onboardingMode: parsed.data.onboardingMode,
      workspacePersona: parsed.data.workspacePersona,
    });

    return NextResponse.json(
      {
        organizationId: created.organization.id,
        slug: created.organization.slug,
        name: created.organization.name,
        role: created.role,
        persona: created.workspacePersona,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to create organization" }, { status: 500 });
  }
}
