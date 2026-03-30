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

import { ValidatorForm } from "@/components/validator-form";

describe("ValidatorForm", () => {
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

  it("renders tabbed validator results after a successful submission", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: "RAW VALIDATOR OUTPUT",
        remainingUses: 3,
        report: {
          profile: "FTR",
          profileLabel: "Foundational Technical Review (FTR)",
          overview: "Foundational readiness review for scope, controls, and execution evidence.",
          score: 68,
          counts: {
            PASS: 4,
            PARTIAL: 2,
            MISSING: 1,
          },
          summary: "Several control and approval gaps need attention before submission.",
          topGaps: ["Clarify approval ownership", "Add evidence for testing outcomes"],
          target: {
            id: "target-1",
            label: "AWS FTR Checklist",
            track: "ftr",
          },
          rulepack: {
            id: "ftr-core",
            version: "2026.03.02",
            ruleCount: 7,
          },
          processingNotes: ["Workbook parsed successfully."],
          controlCalibration: {
            totalControls: 2,
            counts: {
              PASS: 1,
              PARTIAL: 0,
              MISSING: 1,
            },
            controls: [
              {
                sheetName: "Checklist",
                rowNumber: 12,
                responseCell: "H12",
                controlId: "CTRL-001",
                requirement: "Document approval ownership.",
                response: "",
                status: "MISSING",
                confidence: "HIGH",
                missingSignals: ["owner", "approval date"],
                recommendation: "Add the approver and date.",
                suggestedEdit: "Approved by platform owner on 2026-03-01.",
              },
              {
                sheetName: "Checklist",
                rowNumber: 15,
                responseCell: "H15",
                controlId: "CTRL-002",
                requirement: "Show test evidence.",
                response: "Testing completed",
                status: "PASS",
                confidence: "MEDIUM",
                missingSignals: [],
                recommendation: "No change needed.",
                suggestedEdit: "Testing completed with linked evidence.",
              },
            ],
          },
          documentMetrics: {
            sourceType: "spreadsheet",
            filename: "checklist.xlsx",
            sheets: 1,
            wordCount: 1240,
            characterCount: 8120,
          },
          checks: [
            {
              id: "approval",
              title: "Approval trail exists",
              description: "Reviewers, dates, and approvals should be discoverable.",
              status: "MISSING",
              severity: "IMPORTANT",
              weight: 1,
              hitKeywords: [],
              hitPatterns: [],
              evidence: null,
              guidance: "Add sign-off section with reviewer names and date.",
            },
            {
              id: "testing",
              title: "Testing evidence is present",
              description: "Testing plan/results should show validation coverage and outcomes.",
              status: "PARTIAL",
              severity: "IMPORTANT",
              weight: 1.2,
              hitKeywords: ["testing"],
              hitPatterns: [],
              evidence: "Testing completed",
              guidance: "Add explicit test cases and pass/fail criteria.",
            },
            {
              id: "scope",
              title: "Scope and objectives are defined",
              description: "Document should clearly state purpose and scope boundaries.",
              status: "PASS",
              severity: "CRITICAL",
              weight: 1.2,
              hitKeywords: ["scope"],
              hitPatterns: [],
              evidence: "Scope section present",
              guidance: "No action needed.",
            },
          ],
        },
      }),
    });

    render(
      <ValidatorForm
        validationTargets={[
          {
            id: "target-1",
            profile: "FTR",
            track: "ftr",
            sourceRow: 1,
            label: "AWS FTR Checklist",
          },
        ]}
        profileCredits={{ FTR: 1, SDP: 0, SRP: 0, COMPETENCY: 0 }}
      />,
    );

    const fileInput = screen.getByLabelText(/upload checklist/i);
    const file = new File(["sample"], "checklist.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    Object.defineProperty(fileInput, "files", {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process file/i }).hasAttribute("disabled")).toBe(false);
    });

    const form = screen.getByRole("button", { name: /process file/i }).closest("form");
    if (!form) {
      throw new Error("Expected validator form.");
    }

    fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /recommendations/i })).toBeTruthy();
    });

    expect(screen.getByText(/what to fix first/i)).toBeTruthy();
    expect(screen.getByText(/clarify approval ownership/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /calibration/i }));

    await waitFor(() => {
      expect(screen.getByText(/CTRL-001/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("tab", { name: /raw/i }));

    await waitFor(() => {
      expect(screen.getByText(/RAW VALIDATOR OUTPUT/i)).toBeTruthy();
    });
  });

  it("allows an admin test run with zero purchased credits", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output: "",
        adminBypass: true,
      }),
    });

    render(
      <ValidatorForm
        adminBypass
        validationTargets={[
          {
            id: "target-1",
            profile: "FTR",
            track: "ftr",
            sourceRow: 1,
            label: "AWS FTR Checklist",
          },
        ]}
        profileCredits={{ FTR: 0, SDP: 0, SRP: 0, COMPETENCY: 0 }}
      />,
    );

    expect(screen.getByText(/admin test bypass active/i)).toBeTruthy();
    expect(screen.queryByText(/no credits available/i)).toBeNull();

    const fileInput = screen.getByLabelText(/upload checklist/i);
    const file = new File(["sample"], "checklist.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    Object.defineProperty(fileInput, "files", {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /process file/i }).hasAttribute("disabled")).toBe(false);
    });

    const form = screen.getByRole("button", { name: /process file/i }).closest("form");
    if (!form) {
      throw new Error("Expected validator form.");
    }

    fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps public launch posture limited to FTR", () => {
    render(
      <ValidatorForm
        validationTargets={[
          {
            id: "target-ftr",
            profile: "FTR",
            track: "ftr",
            sourceRow: 1,
            label: "AWS FTR Checklist",
          },
          {
            id: "target-sdp",
            profile: "SDP",
            track: "sdp",
            sourceRow: 2,
            label: "AWS SDP Checklist",
          },
        ]}
        profileCredits={{ FTR: 1, SDP: 1, SRP: 1, COMPETENCY: 1 }}
      />,
    );

    expect(screen.getByText(/FTR is the public launch track/i)).toBeTruthy();
    expect(screen.getByRole("option", { name: /Foundational Technical Review/i })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Service Delivery Program/i })).toBeNull();
    expect(screen.queryByText(/^SDP 1$/)).toBeNull();
  });
});
