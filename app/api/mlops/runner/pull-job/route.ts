import { MlopsJobStatus, MlopsRunStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { authenticateRunnerApiKey } from "@/lib/mlops-runner-keys";

const pullSchema = z.object({
  runnerName: z.string().trim().min(2).max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const runnerKey = request.headers.get("x-zokorp-runner-key") ?? "";
    const authenticated = await authenticateRunnerApiKey(runnerKey);

    if (!authenticated) {
      return NextResponse.json({ error: "Invalid runner API key" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = pullSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid runner request" }, { status: 400 });
    }

    const queued = await db.mlopsJob.findFirst({
      where: {
        organizationId: authenticated.organizationId,
        status: MlopsJobStatus.QUEUED,
      },
      orderBy: {
        queuedAt: "asc",
      },
      include: {
        project: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    if (!queued) {
      return NextResponse.json({ job: null });
    }

    const runnerName = parsed.data.runnerName ?? "runner";
    const claimed = await db.$transaction(async (tx) => {
      const update = await tx.mlopsJob.updateMany({
        where: {
          id: queued.id,
          status: MlopsJobStatus.QUEUED,
        },
        data: {
          status: MlopsJobStatus.RUNNING,
          startedAt: new Date(),
          claimedByRunnerName: runnerName,
        },
      });

      if (update.count === 0) {
        return null;
      }

      await tx.mlopsRun.updateMany({
        where: {
          jobId: queued.id,
        },
        data: {
          status: MlopsRunStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      await tx.mlopsJobLog.create({
        data: {
          organizationId: authenticated.organizationId,
          jobId: queued.id,
          sequence: 1,
          level: "INFO",
          message: `Runner ${runnerName} claimed queued job.`,
        },
      });

      return tx.mlopsJob.findUnique({
        where: { id: queued.id },
        include: {
          project: true,
        },
      });
    });

    if (!claimed) {
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: claimed.id,
        organizationId: claimed.organizationId,
        organizationSlug: authenticated.organization.slug,
        project: {
          id: claimed.project.id,
          slug: claimed.project.slug,
          name: claimed.project.name,
        },
        name: claimed.name,
        type: claimed.type,
        containerImage: claimed.containerImage,
        command: claimed.commandJson,
        env: claimed.envJson,
        inputs: claimed.inputsJson,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to pull job" }, { status: 500 });
  }
}
