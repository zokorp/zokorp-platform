import { describe, expect, it, vi } from "vitest";

import { buildCloudCostLeakFinderEmailContent } from "@/lib/cloud-cost-leak-finder/email";
import { buildCloudCostLeakFinderReport } from "@/lib/cloud-cost-leak-finder/engine";
import { cloudCostLeakFinderAnswersSchema } from "@/lib/cloud-cost-leak-finder/types";

describe("cloud cost leak finder email", () => {
  it("builds the advisory email payload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-07T17:00:00.000Z"));

    const answers = cloudCostLeakFinderAnswersSchema.parse({
      email: "owner@acmecloud.com",
      fullName: "Jordan Rivera",
      companyName: "Acme Cloud",
      roleTitle: "CTO",
      website: "acmecloud.com",
      primaryCloud: "aws",
      secondaryCloud: undefined,
      narrativeInput:
        "We run a SaaS app on AWS with EC2, RDS, and non-prod environments that likely stay up too long. Leadership wants savings without breaking production.",
      billingSummaryInput: "EC2 $4200\nRDS $2100\nS3 $400",
      adaptiveAnswers: {
        monthlySpendBand: "15k_to_50k",
        workloadScope: "a_few_systems",
        ownershipClarity: "partial",
        budgetsAlerts: "partial",
        customerCriticality: "customer_facing",
        nonProdRuntime: "always_on",
        rightsizingCadence: "rare",
      },
    });

    const report = buildCloudCostLeakFinderReport(answers);
    const email = buildCloudCostLeakFinderEmailContent({ answers, report });

    expect(email.subject).toContain("Acme Cloud");
    expect(email.text).toContain(report.verdictHeadline);
    expect(email.text).toContain(report.savingsEstimate.estimatedMonthlySavingsRange);
    expect(email.text).toContain(report.quote.engagementType);
    expect(email.text).toContain("Quote breakdown:");
    expect(email.text).toContain(report.quote.lineItems[0].label);
    expect(email.html).toContain("Cloud Cost Leak Finder");
    expect(email.html).toContain("Quote breakdown");
    expect(email.html).toContain("Book a consultation");
  });
});
