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

import { ArchitectureDiagramReviewerForm } from "@/components/architecture-diagram-reviewer/ArchitectureDiagramReviewerForm";
import * as architectureReviewClient from "@/lib/architecture-review/client";

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

  it("enforces PNG/SVG-only uploads", async () => {
    render(<ArchitectureDiagramReviewerForm />);

    const fileInput = screen.getByLabelText(/diagram file/i);
    const descriptionInput = screen.getByLabelText(/architecture description/i);
    const submitButton = screen.getByRole("button", { name: /run review/i });
    const form = submitButton.closest("form");
    expect(fileInput.getAttribute("accept")).toBe("image/png,image/svg+xml,.png,.svg");

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
    await waitFor(() => expect(screen.getByText(/file name must end with \.png or \.svg/i)).toBeTruthy());
  });

  it("shows email fallback actions without rendering findings", async () => {
    vi.spyOn(architectureReviewClient, "isStrictDiagramFile").mockResolvedValue({
      ok: true,
      format: "png",
      mimeType: "image/png",
    });

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const requestUrl = String(input);

      if (requestUrl.includes("/api/submit-architecture-review")) {
        return {
          ok: true,
          status: 202,
          json: async () => ({
            status: "queued",
            jobId: "job-001",
            deliveryMode: null,
            phase: "upload-validate",
            progressPct: 0,
            etaSeconds: 1,
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          jobId: "job-001",
          status: "fallback",
          phase: "completed",
          progressPct: 100,
          etaSeconds: 0,
          deliveryMode: "fallback",
          fallback: {
            mailtoUrl: "mailto:test@example.com?subject=Architecture%20Review",
            emlDownloadToken: "signed.token",
            reason: "EMAIL_FAILED",
          },
        }),
      } as Response;
    });

    render(<ArchitectureDiagramReviewerForm />);

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pngFile = new File([pngBytes], "diagram.png", { type: "image/png" });

    const fileInput = screen.getByLabelText(/diagram file/i);
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
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/automated delivery was unavailable/i)).toBeTruthy();
    });

    expect(screen.getByText(/open email draft/i)).toBeTruthy();
    expect(screen.getByText(/download \.eml/i)).toBeTruthy();
    expect(screen.queryByText(/pointsDeducted=/i)).toBeNull();
    expect(screen.queryByText(/PILLAR-SECURITY/i)).toBeNull();
  });

  it("shows server-side validation errors returned by the API", async () => {
    vi.spyOn(architectureReviewClient, "isStrictDiagramFile").mockResolvedValue({
      ok: true,
      format: "png",
      mimeType: "image/png",
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        error:
          "Uploaded diagram appears to be non-architecture content. No review email was sent. Upload a real architecture diagram.",
      }),
    });

    render(<ArchitectureDiagramReviewerForm />);

    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pngFile = new File([pngBytes], "diagram.png", { type: "image/png" });

    const fileInput = screen.getByLabelText(/diagram file/i);
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
      expect(screen.getByText(/appears to be non-architecture content/i)).toBeTruthy();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
