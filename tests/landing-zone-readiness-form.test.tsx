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

import { LandingZoneReadinessCheckerForm } from "@/components/landing-zone-readiness/LandingZoneReadinessCheckerForm";

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

describe("LandingZoneReadinessCheckerForm", () => {
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

  it("shows validation feedback when required inputs are missing", async () => {
    render(<LandingZoneReadinessCheckerForm />);

    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent?.length).toBeGreaterThan(0);
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits successfully and shows only the concise success state", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "sent",
        overallScore: 88,
        maturityBand: "Usable but Gapped",
        quoteTier: "Foundation Fix Sprint",
      }),
    });

    render(<LandingZoneReadinessCheckerForm />);

    fireEvent.change(screen.getByLabelText(/business email/i), { target: { value: "owner@acmecloud.com" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Jordan Rivera" } });
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: "Acme Cloud" } });
    fireEvent.change(screen.getByLabelText(/role or title/i), { target: { value: "CTO" } });
    fireEvent.change(screen.getByLabelText(/company website or domain/i), { target: { value: "acmecloud.com" } });
    fireEvent.change(screen.getByLabelText(/primary cloud/i), { target: { value: "aws" } });
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    fireEvent.change(screen.getByLabelText(/how many environments do you actively use/i), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText(/how many regions are in scope/i), { target: { value: "2_3" } });
    fireEvent.change(screen.getByLabelText(/approximate employee count/i), { target: { value: "26_100" } });
    fireEvent.change(screen.getByLabelText(/engineering team size/i), { target: { value: "6_20" } });
    choose("handlesSensitiveData", "no");
    choose("clearEnvironmentSeparation", "yes");
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    [
      "hasSso",
      "enforcesMfa",
      "centralizedIdentity",
      "breakGlassProcess",
      "documentedRbac",
      "serviceAccountHygiene",
      "usesOrgHierarchy",
      "separateCloudAccounts",
      "sharedServicesModel",
      "guardrailsPolicy",
    ].forEach((name) => choose(name, "yes"));
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    [
      "standardNetworkArchitecture",
      "productionIsolation",
      "ingressEgressControls",
      "privateConnectivity",
      "documentedDnsStrategy",
      "networkCleanup",
      "secretsManagement",
      "keyManagement",
      "baselineSecurityLogging",
      "vulnerabilityScanning",
      "privilegeReviews",
      "patchingOwnership",
    ].forEach((name) => choose(name, "yes"));
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    [
      "centralizedLogs",
      "metricsDashboards",
      "alertingCoverage",
      "runbooks",
      "onCallOwnership",
      "incidentResponseProcess",
      "backupCoverage",
      "restoreTesting",
      "definedRecoveryTargets",
      "crossRegionResilience",
      "drDocumentation",
    ].forEach((name) => choose(name, "yes"));
    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    [
      "infrastructureAsCode",
      "changesViaCiCd",
      "codeReviewRequired",
      "driftDetection",
      "taggingStandard",
      "budgetAlerts",
      "resourceOwnership",
      "lifecycleCleanup",
      "nonProdShutdown",
    ].forEach((name) => choose(name, "yes"));
    choose("manualProductionChanges", "blocked");
    fireEvent.change(screen.getByLabelText(/what is the biggest cloud challenge/i), {
      target: { value: "Keeping standards consistent while the team is growing." },
    });

    fireEvent.click(screen.getByRole("button", { name: /email my results/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/your results have been emailed/i)).toBeTruthy();
    });

    expect(screen.getByText(/88\/100/i)).toBeTruthy();
    expect(screen.getByText(/check your email/i)).toBeTruthy();
    expect(screen.queryByText(/top findings/i)).toBeNull();
  });
});
