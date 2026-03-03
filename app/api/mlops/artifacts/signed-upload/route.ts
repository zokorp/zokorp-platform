import path from "node:path";

import { OrganizationRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { requireMlopsContext } from "@/lib/mlops-auth";
import { createSignedArtifactUpload } from "@/lib/supabase-storage";

const signedUploadSchema = z.object({
  organizationSlug: z.string().trim().min(2),
  projectId: z.string().trim().min(1),
  jobId: z.string().trim().min(1).optional(),
  runId: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().positive().max(500 * 1024 * 1024).optional(),
});

function sanitizeFilename(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signedUploadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
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
      select: {
        id: true,
        slug: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (parsed.data.jobId) {
      const jobExists = await db.mlopsJob.findFirst({
        where: {
          id: parsed.data.jobId,
          organizationId: context.organization.id,
          projectId: project.id,
        },
        select: { id: true },
      });

      if (!jobExists) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
    }

    if (parsed.data.runId) {
      const runExists = await db.mlopsRun.findFirst({
        where: {
          id: parsed.data.runId,
          organizationId: context.organization.id,
          projectId: project.id,
        },
        select: { id: true },
      });

      if (!runExists) {
        return NextResponse.json({ error: "Run not found" }, { status: 404 });
      }
    }

    const safeName = sanitizeFilename(parsed.data.fileName);
    const extension = path.extname(safeName);
    const nameWithoutExt = safeName.replace(extension, "");
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = `${context.organization.slug}/${project.slug}/${uniqueSuffix}-${nameWithoutExt}${extension}`;

    const env = getEnv();
    const signedUpload = await createSignedArtifactUpload({
      bucket: env.MLOPS_ARTIFACT_BUCKET,
      path: storagePath,
    });

    const artifact = await db.mlopsArtifact.create({
      data: {
        organizationId: context.organization.id,
        projectId: project.id,
        jobId: parsed.data.jobId,
        runId: parsed.data.runId,
        storagePath,
        displayName: safeName,
        contentType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes,
      },
    });

    return NextResponse.json({
      artifactId: artifact.id,
      bucket: env.MLOPS_ARTIFACT_BUCKET,
      path: storagePath,
      token: signedUpload.token,
      signedUrl: signedUpload.signedUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "SUPABASE_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "Artifact upload storage is not configured yet." },
        { status: 503 },
      );
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to create signed upload" }, { status: 500 });
  }
}
