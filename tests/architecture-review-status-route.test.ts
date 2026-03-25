import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireUserMock,
  getArchitectureReviewJobStatusMock,
  serializeArchitectureReviewJobStatusMock,
  isSchemaDriftErrorMock,
} = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getArchitectureReviewJobStatusMock: vi.fn(),
  serializeArchitectureReviewJobStatusMock: vi.fn(),
  isSchemaDriftErrorMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/architecture-review/jobs", () => ({
  getArchitectureReviewJobStatus: getArchitectureReviewJobStatusMock,
  serializeArchitectureReviewJobStatus: serializeArchitectureReviewJobStatusMock,
}));

vi.mock("@/lib/db-errors", () => ({
  isSchemaDriftError: isSchemaDriftErrorMock,
}));

import { GET } from "@/app/api/architecture-review-status/route";

describe("architecture review status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user_123" });
    getArchitectureReviewJobStatusMock.mockResolvedValue({
      id: "job_123",
      userId: "user_123",
      status: "complete",
    });
    serializeArchitectureReviewJobStatusMock.mockReturnValue({
      id: "job_123",
      status: "complete",
    });
    isSchemaDriftErrorMock.mockReturnValue(false);
  });

  it("marks missing job ids as non-cacheable", async () => {
    const response = await GET(new Request("https://app.zokorp.com/api/architecture-review-status"));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Missing jobId.",
    });
  });

  it("marks unauthorized responses as non-cacheable", async () => {
    requireUserMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(new Request("https://app.zokorp.com/api/architecture-review-status?jobId=job_123"));

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("marks schema drift responses as non-cacheable", async () => {
    const schemaError = new Error("schema drift");
    getArchitectureReviewJobStatusMock.mockRejectedValue(schemaError);
    isSchemaDriftErrorMock.mockImplementation((error: unknown) => error === schemaError);

    const response = await GET(new Request("https://app.zokorp.com/api/architecture-review-status?jobId=job_123"));

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "Architecture review job schema is unavailable.",
    });
  });
});
