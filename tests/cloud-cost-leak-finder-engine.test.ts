import { afterEach, describe, expect, it, vi } from "vitest";

import { selectCloudCostLeakFinderFollowUpQuestions } from "@/lib/cloud-cost-leak-finder/adaptive";
import { buildCloudCostLeakFinderReport } from "@/lib/cloud-cost-leak-finder/engine";
import { isAllowedCloudCostBusinessEmail, narrativeValidationMessage } from "@/lib/cloud-cost-leak-finder/input";
import { extractCloudCostSignals } from "@/lib/cloud-cost-leak-finder/signal-extractor";
import { cloudCostLeakFinderAnswersSchema, type CloudCostLeakFinderAnswers } from "@/lib/cloud-cost-leak-finder/types";

function makeAnswers(overrides: Partial<CloudCostLeakFinderAnswers> = {}): CloudCostLeakFinderAnswers {
  return cloudCostLeakFinderAnswersSchema.parse({
    email: "owner@acmecloud.com",
    fullName: "Jordan Rivera",
    companyName: "Acme Cloud",
    roleTitle: "CTO",
    website: "acmecloud.com",
    primaryCloud: "aws",
    secondaryCloud: "gcp",
    narrativeInput:
      "We run a SaaS app on AWS with EKS, EC2, RDS, and dev, test, and prod environments. The bill keeps rising even though usage is mostly flat. Non-prod often runs 24/7, Kubernetes cost feels unclear, cross-region traffic exists, and nobody is fully sure which team owns the most expensive resources.",
    billingSummaryInput: "EC2, 4200\nEKS, 1800\nRDS, 2100\nNAT Gateway, 650\nS3, 400",
    adaptiveAnswers: {
      monthlySpendBand: "15k_to_50k",
      workloadScope: "many_systems",
      ownershipClarity: "unclear",
      budgetsAlerts: "none",
      customerCriticality: "customer_facing",
      nonProdRuntime: "always_on",
      rightsizingCadence: "rare",
      kubernetesUtilization: "unknown",
      storageLifecycle: "partial",
      crossRegionTraffic: "high",
      databaseRightSizing: "unknown",
      commitmentCoverage: "none",
      architectureFlexibility: "some_redesign",
      costVisibility: "weak",
    },
    ...overrides,
  });
}

describe("cloud cost leak finder engine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks common personal email domains", () => {
    expect(isAllowedCloudCostBusinessEmail("architect@zokorp.com")).toBe(true);
    expect(isAllowedCloudCostBusinessEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedCloudCostBusinessEmail("someone@outlook.com")).toBe(false);
  });

  it("rejects low-effort narratives", () => {
    expect(narrativeValidationMessage("help")).toContain("Add more detail");
    expect(narrativeValidationMessage("We need this fixed soon.")).toContain("Add more detail");
    expect(
      narrativeValidationMessage(
        "We run a SaaS product across AWS and GCP, the bill keeps climbing, and we think dev environments plus oversized compute are the main problem.",
      ),
    ).toBeNull();
  });

  it("parses rough billing summaries and finds a dominant spend family", () => {
    const signals = extractCloudCostSignals(makeAnswers());

    expect(signals.spendSignals.parsedAmountCount).toBe(5);
    expect(signals.spendSignals.totalParsedMonthlySpend).toBe(9_150);
    expect(signals.spendSignals.dominantFamily).toBe("compute");
    expect(signals.spendSignals.familyBreakdown.map((entry) => entry.family)).toContain("database");
  });

  it("assigns billing amounts to the matching service on mixed lines", () => {
    const signals = extractCloudCostSignals(
      makeAnswers({
        billingSummaryInput: "EC2 $4,200, RDS $2,100, NAT Gateway $650",
      }),
    );

    expect(signals.spendSignals.totalParsedMonthlySpend).toBe(6_950);
    expect(signals.spendSignals.parsedServices).toEqual([
      expect.objectContaining({ service: "Amazon EC2", amount: 4_200 }),
      expect.objectContaining({ service: "Amazon RDS", amount: 2_100 }),
      expect.objectContaining({ service: "AWS NAT Gateway", amount: 650 }),
    ]);
    expect(signals.spendSignals.familyBreakdown).toEqual([
      expect.objectContaining({ family: "compute", amount: 4_200 }),
      expect.objectContaining({ family: "database", amount: 2_100 }),
      expect.objectContaining({ family: "networking", amount: 650 }),
    ]);
  });

  it("selects adaptive follow-up questions from detected signals", () => {
    const questions = selectCloudCostLeakFinderFollowUpQuestions(extractCloudCostSignals(makeAnswers()));

    expect(questions.map((question) => question.id)).toEqual([
      "monthlySpendBand",
      "workloadScope",
      "ownershipClarity",
      "budgetsAlerts",
      "customerCriticality",
      "nonProdRuntime",
      "kubernetesUtilization",
    ]);
  });

  it("produces deterministic report, savings estimate, verdict, and quote output", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T17:00:00.000Z"));

    const first = buildCloudCostLeakFinderReport(makeAnswers());
    const second = buildCloudCostLeakFinderReport(makeAnswers());

    expect(first).toEqual(second);
    expect(first.scores.wasteRiskScore).toBe(100);
    expect(first.scores.finopsMaturityScore).toBe(0);
    expect(first.scores.savingsConfidenceScore).toBe(99);
    expect(first.scores.implementationComplexityScore).toBe(100);
    expect(first.scores.roiPlausibilityScore).toBe(54);
    expect(first.scores.confidenceScore).toBe(79);
    expect(first.savingsEstimate.estimatedMonthlySavingsRange).toBe("$2,100 - $17,100");
    expect(first.savingsEstimate.estimatedAnnualSavingsRange).toBe("$25,200 - $205,200");
    expect(first.verdictClass).toBe("HIGH_COMPLEXITY_REVIEW_RECOMMENDED");
    expect(first.quote.engagementType).toBe("Custom Scope Required");
    expect(first.quote.quoteLow).toBe(2300);
    expect(first.quote.quoteHigh).toBe(4300);
    expect(first.quote.lineItems.map((item) => item.label)).toEqual([
      "Base custom scoping block",
      "Kubernetes efficiency review",
      "Egress and topology review",
      "Non-prod runtime cleanup",
      "Storage lifecycle cleanup",
      "Multi-system coordination",
      "Multi-cloud coordination",
      "Targeted redesign work",
    ]);
    expect(first.likelyWasteCategories).toEqual([
      "KUBERNETES_INEFFICIENCY",
      "NETWORK_EGRESS_WASTE",
      "IDLE_NON_PROD",
      "STORAGE_LIFECYCLE_GAPS",
      "OVERPROVISIONED_COMPUTE",
      "DATABASE_OVERSPEND",
    ]);
  });

  it("does not pad likely waste categories with zero-evidence fallbacks", () => {
    const report = buildCloudCostLeakFinderReport(
      makeAnswers({
        secondaryCloud: undefined,
        narrativeInput:
          "We run a SaaS application on AWS and leadership wants a cloud cost review before we change anything in production. We need a clearer starting point.",
        billingSummaryInput: "",
        adaptiveAnswers: {},
      }),
    );

    expect(report.likelyWasteCategories).toEqual(["NEEDS_REAL_BILLING_DATA"]);
  });
});
