import { requireUser } from "@/lib/auth";
import { getArchitectureReviewJobStatus, serializeArchitectureReviewJobStatus } from "@/lib/architecture-review/jobs";
import { isSchemaDriftError } from "@/lib/db-errors";
import { jsonNoStore } from "@/lib/internal-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const requestUrl = new URL(request.url);
    const jobId = requestUrl.searchParams.get("jobId")?.trim();

    if (!jobId) {
      return jsonNoStore({ error: "Missing jobId." }, { status: 400 });
    }

    const job = await getArchitectureReviewJobStatus(jobId);
    if (!job || job.userId !== user.id) {
      return jsonNoStore({ error: "Review job not found." }, { status: 404 });
    }

    return jsonNoStore(serializeArchitectureReviewJobStatus(job));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
    }

    if (isSchemaDriftError(error)) {
      return jsonNoStore({ error: "Architecture review job schema is unavailable." }, { status: 503 });
    }

    return jsonNoStore({ error: "Unable to load review status." }, { status: 500 });
  }
}
