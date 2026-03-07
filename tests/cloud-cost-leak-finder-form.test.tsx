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

import { CloudCostLeakFinderForm } from "@/components/cloud-cost-leak-finder/CloudCostLeakFinderForm";

function queryInput<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element for selector: ${selector}`);
  }

  return element;
}

function choose(name: string, value: string) {
  fireEvent.click(queryInput<HTMLInputElement>(`input[name="${name}"][value="${value}"]`));
}

function fillCompanyStep() {
  fireEvent.change(screen.getByLabelText(/business email/i), { target: { value: "owner@acmecloud.com" } });
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jordan Rivera" } });
  fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Acme Cloud" } });
  fireEvent.change(screen.getByLabelText(/role or title/i), { target: { value: "CTO" } });
  fireEvent.change(screen.getByLabelText(/company website or domain/i), { target: { value: "acmecloud.com" } });
  fireEvent.change(screen.getByLabelText(/primary cloud provider/i), { target: { value: "aws" } });
}

describe("CloudCostLeakFinderForm", () => {
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

  it("shows plain-English validation feedback when required inputs are missing", async () => {
    render(<CloudCostLeakFinderForm />);

    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Enter your business email.");
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks low-effort narratives before adaptive questions", async () => {
    render(<CloudCostLeakFinderForm />);

    fillCompanyStep();
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    fireEvent.change(
      screen.getByLabelText(
        /describe your cloud environment, what you think is driving cost, what workloads you run, and what is frustrating you most/i,
      ),
      { target: { value: "help" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Add more detail");
    });
  });

  it("shows adaptive follow-up questions and only the concise success state after submit", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "sent",
        verdictHeadline: "Quick savings are likely without a major redesign.",
        savingsRangeLine: "Likely savings range: $2,200 - $8,800 per month",
      }),
    });

    render(<CloudCostLeakFinderForm />);

    fillCompanyStep();
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    fireEvent.change(
      screen.getByLabelText(
        /describe your cloud environment, what you think is driving cost, what workloads you run, and what is frustrating you most/i,
      ),
      {
        target: {
          value:
            "We run a SaaS app on AWS with EKS, EC2, and RDS. Dev, test, and prod all exist, and I think non-prod is left on 24/7. Kubernetes cost is unclear and the bill keeps rising while usage is mostly flat.",
        },
      },
    );
    fireEvent.change(screen.getByLabelText(/optional: paste your top services/i), {
      target: { value: "EC2 $4200\nEKS $1800\nRDS $2100" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    await waitFor(() => {
      expect(screen.getByText(/how often does non-prod stay running/i)).toBeTruthy();
    });
    expect(screen.getByText(/how well do you understand cluster utilization/i)).toBeTruthy();

    choose("monthlySpendBand", "15k_to_50k");
    choose("workloadScope", "many_systems");
    choose("ownershipClarity", "unclear");
    choose("budgetsAlerts", "none");
    choose("customerCriticality", "customer_facing");
    choose("nonProdRuntime", "always_on");
    choose("kubernetesUtilization", "unknown");

    fireEvent.click(screen.getByRole("button", { name: /email my cost review/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/your cost review has been emailed\./i)).toBeTruthy();
    });

    expect(screen.getByText(/quick savings are likely/i)).toBeTruthy();
    expect(screen.getByText(/\$2,200 - \$8,800/i)).toBeTruthy();
    expect(screen.queryByText(/top findings/i)).toBeNull();
  });
});
