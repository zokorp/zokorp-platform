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
}));

vi.mock("@/lib/architecture-review/jobs", () => ({
  createArchitectureReviewJob: mocks.createArchitectureReviewJob,
  processArchitectureReviewJob: mocks.processArchitectureReviewJob,
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

import { POST } from "@/app/api/submit-architecture-review/route";

function makePngFile() {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  return new File([pngBytes], "diagram.png", { type: "image/png" });
}

function makeMultipartRequest() {
  const formData = new FormData();
  formData.append(
    "metadata",
    JSON.stringify({
      provider: "aws",
      paragraphInput: "Users enter through an edge layer, app services process requests, and data persists to a managed store.",
      diagramFormat: "png",
    }),
  );
  formData.append("diagram", makePngFile());

  return new Request("http://localhost/api/submit-architecture-review", {
    method: "POST",
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

  it("queues a valid verified PNG submission and locks delivery to the verified account email", async () => {
    const response = await POST(makeMultipartRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.status).toBe("queued");
    expect(body.jobId).toBe("job_123");
    expect(mocks.createArchitectureReviewJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        userEmail: "owner@acmecloud.com",
        diagramFileName: "diagram.png",
        diagramMimeType: "image/png",
        metadata: expect.objectContaining({
          provider: "aws",
          paragraphInput: expect.stringContaining("Users enter through an edge layer"),
        }),
      }),
    );
    expect(mocks.processArchitectureReviewJob).toHaveBeenCalledWith("job_123");
  });
});
