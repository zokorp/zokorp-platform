/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiDeciderForm } from "@/components/ai-decider/AiDeciderForm";

function choose(name: string, value: string) {
  const element = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`);
  if (!element) {
    throw new Error(`Missing choice ${name}:${value}`);
  }

  fireEvent.click(element);
}

describe("AiDeciderForm", () => {
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

  it("blocks personal email domains before follow-up questions", async () => {
    render(<AiDeciderForm />);

    fireEvent.change(screen.getByLabelText(/business email/i), { target: { value: "someone@gmail.com" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jordan Rivera" } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Acme Ops" } });
    fireEvent.change(screen.getByLabelText(/role or title/i), { target: { value: "COO" } });
    fireEvent.change(screen.getByLabelText(/business narrative/i), {
      target: {
        value:
          "Our support team answers the same questions repeatedly across email and Slack. The best answers are spread across SharePoint and old docs, and we want faster responses.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Use your business email");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits successfully and only shows the emailed confirmation with a verdict line", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "sent",
        verdictLine: "A grounded retrieval layer is a better first AI move than a free-form chatbot.",
        recommendation: "SEARCH_RAG",
      }),
    });

    render(<AiDeciderForm />);

    fireEvent.change(screen.getByLabelText(/business email/i), { target: { value: "owner@acmeops.com" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jordan Rivera" } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Acme Ops" } });
    fireEvent.change(screen.getByLabelText(/role or title/i), { target: { value: "COO" } });
    fireEvent.change(screen.getByLabelText(/business narrative/i), {
      target: {
        value:
          "Our support team answers the same questions repeatedly across email and Slack. The best answers are spread across SharePoint, old docs, and a few senior reps. We want faster response times and more consistent answers for customers.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/i picked/i)).toBeTruthy();
    });

    choose("task_frequency", "daily");
    choose("process_variability", "mostly_standard");
    choose("data_state", "mixed_needs_cleanup");
    choose("impact_window", "major");
    choose("error_tolerance", "human_reviewed");
    choose("systems_count", "three_four");
    choose("knowledge_source", "many_conflicting");
    choose("decision_logic", "rules_plus_judgment");

    fireEvent.click(screen.getByRole("button", { name: /email my analysis/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/your analysis has been emailed/i)).toBeTruthy();
    });

    expect(
      screen.getByText(/a grounded retrieval layer is a better first ai move than a free-form chatbot/i),
    ).toBeTruthy();
    expect(screen.queryByText(/score snapshot/i)).toBeNull();
    expect(screen.queryByText(/findings/i)).toBeNull();
  });
});
