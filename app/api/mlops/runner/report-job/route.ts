import { MlopsJobStatus, MlopsRunStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { authenticateRunnerApiKey } from "@/lib/mlops-runner-keys";
import { recordMlopsUsage } from "@/lib/mlops-usage";

const reportSchema = z.object({
  jobId: z.string().trim().min(1),
  status: z.enum(["SUCCEEDED", "FAILED", "CANCELED"]),
  logs: z.array(z.string().trim().min(1).max(2000)).max(200).optional(),
  outputs: z.record(z.string(), z.unknown()).optional(),
  metrics: z.record(z.string(), z.number()).optional(),
  errorMessage: z.string().trim().max(1000).optional(),
});

function toRunStatus(status: "SUCCEEDED" | "FAILED" | "CANCELED"): MlopsRunStatus {
  switch (status) {
    case "SUCCEEDED":
      return MlopsRunStatus.SUCCEEDED;
    case "FAILED":
      return MlopsRunStatus.FAILED;
    case "CANCELED":
      return MlopsRunStatus.CANCELED;
  }
}

export async function POST(request: Request) {
  try {
    const runnerKey = request.headers.get("x-zokorp-runner-key") ?? "";
    const authenticated = await authenticateRunnerApiKey(runnerKey);

    if (!authenticated) {
      return NextResponse.json({ error: "Invalid runner API key" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = reportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid job report payload" }, { status: 400 });
    }

    const job = await db.mlopsJob.findFirst({
      where: {
        id: parsed.data.jobId,
        organizationId: authenticated.organizationId,
      },
      select: {
        id: true,
        projectId: true,
        createdByUserId: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const completedAt = new Date();

    await db.$transaction(async (tx) => {
      const latestLog = await tx.mlopsJobLog.findFirst({
        where: {
          jobId: parsed.data.jobId,
        },
        orderBy: {
          sequence: "desc",
        },
        select: {
          sequence: true,
        },
      });

      let sequence = latestLog?.sequence ?? 0;

      const logRows = (parsed.data.logs ?? []).map((message) => {
        sequence += 1;
        return {
          organizationId: authenticated.organizationId,
          jobId: parsed.data.jobId,
          sequence,
          level: parsed.data.status === "FAILED" ? "ERROR" : "INFO",
          message,
        };
      });

      sequence += 1;
      logRows.push({
        organizationId: authenticated.organizationId,
        jobId: parsed.data.jobId,
        sequence,
        level: parsed.data.status === "FAILED" ? "ERROR" : "INFO",
        message: `Runner reported ${parsed.data.status.toLowerCase()} status.`,
      });

      await tx.mlopsJob.update({
        where: {
          id: parsed.data.jobId,
        },
        data: {
          status: parsed.data.status as MlopsJobStatus,
          completedAt,
          outputsJson: parsed.data.outputs as Prisma.InputJsonValue | undefined,
          errorMessage: parsed.data.errorMessage,
        },
      });

      await tx.mlopsRun.updateMany({
        where: {
          jobId: parsed.data.jobId,
        },
        data: {
          status: toRunStatus(parsed.data.status),
          completedAt,
          metricsJson: parsed.data.metrics,
        },
      });

      await tx.mlopsJobLog.createMany({
        data: logRows,
      });

      await tx.auditLog.create({
        data: {
          userId: job.createdByUserId,
          organizationId: authenticated.organizationId,
          action: "mlops.job_runner_reported",
          metadataJson: {
            jobId: parsed.data.jobId,
            status: parsed.data.status,
            logCount: logRows.length,
          },
        },
      });
    });

    if (parsed.data.status === "SUCCEEDED") {
      await recordMlopsUsage({
        organizationId: authenticated.organizationId,
        projectId: job.projectId,
        jobId: job.id,
        createdByUserId: job.createdByUserId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to record job report" }, { status: 500 });
  }
}
