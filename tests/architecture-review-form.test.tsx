/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("tesseract.js", () => ({
  recognize: vi.fn(async () => ({
    data: {
      text: "api gateway lambda dynamodb cloudwatch vpc load balancer private subnet database monitoring",
      confidence: 92,
    },
  })),
}));

import { ArchitectureDiagramReviewerForm } from "@/components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm";
import * as architectureReviewClient from "@/lib/architecture-review/client";

function createPngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

describe("ArchitectureDiagramReviewerForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("enforces PNG-only uploads", async () => {
    render(<ArchitectureDiagramReviewerForm />);

    const fileInput = screen.getByLabelText(/diagram png/i);
    const descriptionInput = screen.getByLabelText(/architecture description/i);
    const submitButton = screen.getByRole("button", { name: /run review/i });
    const form = submitButton.closest("form");
    expect(fileInput.getAttribute("accept")).toBe("image/png");

    const jpgFile = new File([new Uint8Array([1, 2, 3, 4])], "diagram.jpg", { type: "image/jpeg" });

    Object.defineProperty(fileInput, "files", {
      value: [jpgFile],
      writable: false,
    });
    fireEvent.change(fileInput);
    fireEvent.change(descriptionInput, {
      target: { value: "Client sends request to API then service writes to DB." },
    });
    if (!form) {
      throw new Error("Expected form element.");
    }
    fireEvent.submit(form);

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows email fallback actions without rendering findings", async () => {
    vi.spyOn(architectureReviewClient, "isStrictPngFile").mockResolvedValue({ ok: true });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "fallback",
        mailtoUrl: "mailto:test@example.com?subject=Architecture%20Review",
        emlDownloadToken: "signed.token",
      }),
    });

    render(<ArchitectureDiagramReviewerForm />);

    const pngBytes = createPngHeader(1200, 800);
    const pngFile = new File([pngBytes], "diagram.png", { type: "image/png" });

    const fileInput = screen.getByLabelText(/diagram png/i);
    const submitButton = screen.getByRole("button", { name: /run review/i });
    const form = submitButton.closest("form");

    Object.defineProperty(fileInput, "files", {
      value: [pngFile],
      writable: false,
    });
    fireEvent.change(fileInput);

    fireEvent.change(screen.getByLabelText(/architecture description/i), {
      target: {
        value:
          "Users call API Gateway. Lambda validates requests, writes DynamoDB, and CloudWatch alerts on failures.",
      },
    });

    expect(submitButton.hasAttribute("disabled")).toBe(false);
    if (!form) {
      throw new Error("Expected form element.");
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/automated delivery was unavailable/i)).toBeTruthy();
    });

    expect(screen.getByText(/open email draft/i)).toBeTruthy();
    expect(screen.getByText(/download \.eml/i)).toBeTruthy();
    expect(screen.queryByText(/pointsDeducted=/i)).toBeNull();
    expect(screen.queryByText(/PILLAR-SECURITY/i)).toBeNull();
  });

  it("stops immediately when non-architecture content is detected", async () => {
    vi.spyOn(architectureReviewClient, "isStrictPngFile").mockResolvedValue({ ok: true });
    vi.spyOn(architectureReviewClient, "buildReviewReportFromEvidence").mockReturnValueOnce({
      reportVersion: "1.0",
      provider: "aws",
      overallScore: 20,
      flowNarrative: "Detected non-architecture content.",
      findings: [
        {
          ruleId: "INPUT-NOT-ARCH-DIAGRAM",
          category: "clarity",
          pointsDeducted: 35,
          message: "Upload a system architecture diagram instead of a report screenshot.",
          fix: "Provide a PNG with system components and data/request flows.",
          evidence: "OCR matched non-architecture terms.",
          fixCostUSD: 75,
        },
      ],
      consultationQuoteUSD: 400,
      generatedAtISO: "2026-03-06T00:00:00.000Z",
      userEmail: "test@example.com",
    } as never);

    render(<ArchitectureDiagramReviewerForm />);

    const pngBytes = createPngHeader(1200, 800);
    const pngFile = new File([pngBytes], "diagram.png", { type: "image/png" });

    const fileInput = screen.getByLabelText(/diagram png/i);
    const submitButton = screen.getByRole("button", { name: /run review/i });
    const form = submitButton.closest("form");

    Object.defineProperty(fileInput, "files", {
      value: [pngFile],
      writable: false,
    });
    fireEvent.change(fileInput);

    fireEvent.change(screen.getByLabelText(/architecture description/i), {
      target: {
        value: "Clients call service endpoints and data is persisted to managed storage.",
      },
    });

    if (!form) {
      throw new Error("Expected form element.");
    }

    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/does not appear to be an architecture diagram/i)).toBeTruthy();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
