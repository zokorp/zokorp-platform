import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createArchitectureReviewJob: vi.fn(),
  processArchitectureReviewJob: vi.fn(),
  requireVerifiedFreeToolAccess: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRequestFingerprint: vi.fn(),
  readIdempotencyEntry: vi.fn(),
  writeIdempotencyEntry: vi.fn(),
  normalizeIdempotencyKey: vi.fn(),
  architectureReviewJobCount: vi.fn(),
  isSchemaDriftError: vi.fn(),
  archiveArchitectureDiagramToWorkDrive: vi.fn(),
}));

vi.mock("@/lib/architecture-review/jobs", () => ({
  createArchitectureReviewJob: mocks.createArchitectureReviewJob,
  processArchitectureReviewJob: mocks.processArchitectureReviewJob,
  serializeArchitectureReviewJobStatus: (job: { id: string; status: string; deliveryMode?: string | null }) => ({
    jobId: job.id,
    status: job.status,
    phase: job.status === "queued" ? "upload-validate" : "completed",
    progressPct: job.status === "queued" ? 0 : 100,
    etaSeconds: 0,
    deliveryMode: job.deliveryMode ?? null,
    error: job.status === "failed" ? "Processing failed." : null,
    reason: job.status === "rejected" ? "Rejected." : null,
    fallback:
      job.status === "fallback"
        ? {
            mailtoUrl: "mailto:test@example.com",
            emlDownloadToken: "token",
            reason: "fallback",
          }
        : null,
  }),
}));

vi.mock("@/lib/free-tool-access", () => ({
  requireVerifiedFreeToolAccess: mocks.requireVerifiedFreeToolAccess,
  isFreeToolAccessError: (error: unknown) => error instanceof Error && error.name === "FreeToolAccessError",
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRequestFingerprint: mocks.getRequestFingerprint,
}));

vi.mock("@/lib/idempotency-cache", () => ({
  readIdempotencyEntry: mocks.readIdempotencyEntry,
  writeIdempotencyEntry: mocks.writeIdempotencyEntry,
  normalizeIdempotencyKey: mocks.normalizeIdempotencyKey,
}));

vi.mock("@/lib/db", () => ({
  db: {
    architectureReviewJob: {
      count: mocks.architectureReviewJobCount,
    },
  },
}));

vi.mock("@/lib/db-errors", () => ({
  isSchemaDriftError: mocks.isSchemaDriftError,
}));

vi.mock("@/lib/zoho-workdrive", () => ({
  archiveArchitectureDiagramToWorkDrive: mocks.archiveArchitectureDiagramToWorkDrive,
  formatWorkDriveArchiveStatus: ({ status, error }: { status: string; error: string | null }) =>
    error ? `${status}:${error}` : status,
}));

import { POST } from "@/app/api/submit-architecture-review/route";

function makePngFile() {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  return new File([pngBytes], "diagram.png", { type: "image/png" });
}

function makeMultipartRequest() {
  return makeMultipartRequestWithMetadata({
    provider: "aws",
    paragraphInput: "Users enter through an edge layer, app services process requests, and data persists to a managed store.",
    diagramFormat: "png",
    clientPngOcrText: "edge app service data store",
  });
}

function makeMultipartRequestWithMetadata(metadata: Record<string, unknown>, file?: File) {
  const formData = new FormData();
  formData.append("metadata", JSON.stringify(metadata));
  formData.append("diagram", file ?? makePngFile());

  return new Request("http://localhost/api/submit-architecture-review", {
    method: "POST",
    headers: {
      origin: "http://localhost",
    },
    body: formData,
  });
}

describe("submit architecture review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createArchitectureReviewJob.mockResolvedValue({ id: "job_123" });
    mocks.processArchitectureReviewJob.mockResolvedValue({ id: "job_123", status: "queued" });
    mocks.requireVerifiedFreeToolAccess.mockResolvedValue({
      user: { id: "user_123", email: "owner@acmecloud.com", emailVerified: new Date() },
      email: "owner@acmecloud.com",
    });
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 7,
      retryAfterSeconds: 3600,
    });
    mocks.getRequestFingerprint.mockReturnValue("203.0.113.20");
    mocks.readIdempotencyEntry.mockReturnValue(null);
    mocks.normalizeIdempotencyKey.mockReturnValue(null);
    mocks.architectureReviewJobCount.mockResolvedValue(0);
    mocks.isSchemaDriftError.mockReturnValue(false);
    mocks.archiveArchitectureDiagramToWorkDrive.mockResolvedValue({
      status: "uploaded",
      fileId: "wd-diagram-123",
      error: null,
    });
  });

  it("rejects unverified or unsigned access before queueing a job", async () => {
    const error = Object.assign(
      new Error("Sign in with your verified business email to run Architecture Diagram Reviewer."),
      {
        name: "FreeToolAccessError",
        status: 401,
      },
    );
    mocks.requireVerifiedFreeToolAccess.mockRejectedValueOnce(error);

    const response = await POST(makeMultipartRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Sign in with your verified business email to run Architecture Diagram Reviewer.",
    });
    expect(mocks.createArchitectureReviewJob).not.toHaveBeenCalled();
    expect(mocks.processArchitectureReviewJob).not.toHaveBeenCalled();
  });

  it("rejects non-multipart payloads", async () => {
    const response = await POST(
      new Request("http://localhost/api/submit-architecture-review", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ provider: "aws" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid review payload.",
    });
    expect(mocks.createArchitectureReviewJob).not.toHaveBeenCalled();
  });

  it("rejects cross-site uploads before auth or queue work", async () => {
    const formData = new FormData();
    formData.append(
      "metadata",
      JSON.stringify({
        provider: "aws",
        paragraphInput: "Users enter through an edge layer, app services process requests, and data persists to a managed store.",
        diagramFormat: "png",
        clientPngOcrText: "edge app service data store",
      }),
    );
    formData.append("diagram", makePngFile());

    const response = await POST(
      new Request("http://localhost/api/submit-architecture-review", {
        method: "POST",
        headers: {
          origin: "https://evil.example",
        },
        body: formData,
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Cross-site requests are not allowed.",
    });
    expect(mocks.requireVerifiedFreeToolAccess).not.toHaveBeenCalled();
    expect(mocks.createArchitectureReviewJob).not.toHaveBeenCalled();
  });

  it("queues a valid verified PNG submission and locks delivery to the verified account email", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();
    const jobInput = mocks.createArchitectureReviewJob.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(response.status).toBe(202);
    expect(body.status).toBe("queued");
    expect(body.jobId).toBe("job_123");
    expect(mocks.createArchitectureReviewJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        userEmail: "owner@acmecloud.com",
        diagramFileName: "diagram.png",
        diagramMimeType: "image/png",
        workdriveUploadStatus: "not_requested",
        metadata: expect.objectContaining({
          provider: "aws",
          paragraphInput: expect.stringContaining("Users enter through an edge layer"),
        }),
      }),
    );
    expect(jobInput).not.toHaveProperty("diagramBytes");
    expect(mocks.archiveArchitectureDiagramToWorkDrive).not.toHaveBeenCalled();
    expect(mocks.processArchitectureReviewJob).toHaveBeenCalledWith("job_123");
  });

  it("archives the original diagram immediately when follow-up archival is requested", async () => {
    const response = await POST(
      makeMultipartRequestWithMetadata({
        provider: "aws",
        paragraphInput: "Users enter through an edge layer, app services process requests, and data persists to a managed store.",
        diagramFormat: "png",
        clientPngOcrText: "edge app service data store",
        saveForFollowUp: true,
        archiveForFollowup: true,
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.archiveArchitectureDiagramToWorkDrive).toHaveBeenCalledWith(
      expect.objectContaining({
        diagramFileName: "diagram.png",
        diagramMimeType: "image/png",
      }),
    );
    expect(mocks.createArchitectureReviewJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workdriveDiagramFileId: "wd-diagram-123",
        workdriveUploadStatus: "diagram_uploaded",
      }),
    );
  });

  it("returns the final sent status when inline processing completes successfully", async () => {
    mocks.processArchitectureReviewJob.mockResolvedValueOnce({
      id: "job_123",
      status: "sent",
      deliveryMode: "sent",
    });

    const response = await POST(makeMultipartRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "sent",
      jobId: "job_123",
      deliveryMode: "sent",
    });
  });

  it("rejects SVG uploads that do not include browser-extracted text evidence", async () => {
    const svgFile = new File(['<svg xmlns="http://www.w3.org/2000/svg"><text>edge</text></svg>'], "diagram.svg", {
      type: "image/svg+xml",
    });

    const response = await POST(
      makeMultipartRequestWithMetadata(
        {
          provider: "aws",
          paragraphInput: "Users enter through the edge and requests reach the API.",
          diagramFormat: "svg",
        },
        svgFile,
      ),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "Missing browser-extracted diagram evidence. Re-upload the file and retry.",
    });
    expect(mocks.createArchitectureReviewJob).not.toHaveBeenCalled();
  });
});
