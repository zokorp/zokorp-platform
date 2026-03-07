import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getArchitectureReviewJobStatus, serializeArchitectureReviewJobStatus } from "@/lib/architecture-review/jobs";
import { isSchemaDriftError } from "@/lib/db-errors";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const requestUrl = new URL(request.url);
    const jobId = requestUrl.searchParams.get("jobId")?.trim();

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
    }

    const job = await getArchitectureReviewJobStatus(jobId);
    if (!job || job.userId !== user.id) {
      return NextResponse.json({ error: "Review job not found." }, { status: 404 });
    }

    return NextResponse.json(serializeArchitectureReviewJobStatus(job), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isSchemaDriftError(error)) {
      return NextResponse.json({ error: "Architecture review job schema is unavailable." }, { status: 503 });
    }

    return NextResponse.json({ error: "Unable to load review status." }, { status: 500 });
  }
}
