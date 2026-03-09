import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const {
  userFindManyMock,
  leadLogFindManyMock,
  landingZoneFindManyMock,
  cloudCostFindManyMock,
  aiDeciderFindManyMock,
} = vi.hoisted(() => ({
  userFindManyMock: vi.fn(),
  leadLogFindManyMock: vi.fn(),
  landingZoneFindManyMock: vi.fn(),
  cloudCostFindManyMock: vi.fn(),
  aiDeciderFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: userFindManyMock },
    leadLog: { findMany: leadLogFindManyMock },
    landingZoneReadinessSubmission: { findMany: landingZoneFindManyMock },
    cloudCostLeakFinderSubmission: { findMany: cloudCostFindManyMock },
    aiDeciderSubmission: { findMany: aiDeciderFindManyMock },
  },
}));

import { getLeadDirectory, renderLeadDirectoryCsv } from "@/lib/admin-leads";

describe("admin leads helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    userFindManyMock.mockResolvedValue([
      {
        email: "zkhawaja@zokorp.com",
        name: "Zohaib Khawaja",
        emailVerified: new Date("2026-03-09T00:00:00.000Z"),
        role: Role.ADMIN,
        createdAt: new Date("2026-03-09T00:00:00.000Z"),
      },
    ]);

    leadLogFindManyMock.mockResolvedValue([
      {
        userEmail: "architecture@human-company.com",
        userName: "Jordan Rivera",
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
        quoteTier: "remediation-sprint",
        leadStage: "New Review",
        emailDeliveryMode: "email",
        emailSentAt: new Date("2026-03-10T01:00:00.000Z"),
        syncedToZohoAt: null,
        zohoSyncNeedsUpdate: true,
        zohoSyncError: null,
      },
    ]);

    landingZoneFindManyMock.mockResolvedValue([
      {
        email: "qa-bot@acme-enterprise-test.com",
        fullName: "QA Bot",
        companyName: "Acme Enterprise Test",
        createdAt: new Date("2026-03-11T00:00:00.000Z"),
        quoteJson: { quoteTier: "focused-remediation" },
        crmSyncStatus: "pending",
        emailDeliveryStatus: "failed",
      },
    ]);

    cloudCostFindManyMock.mockResolvedValue([
      {
        email: "jane@human-company.com",
        fullName: "Jane Doe",
        companyName: "Human Company",
        createdAt: new Date("2026-03-12T00:00:00.000Z"),
        quoteJson: { engagementType: "Savings Sprint" },
        crmSyncStatus: "synced",
        emailDeliveryStatus: "sent",
      },
    ]);

    aiDeciderFindManyMock.mockResolvedValue([]);
  });

  it("shows likely human contacts by default and suppresses flagged QA/test entries", async () => {
    const result = await getLeadDirectory();

    expect(result.filters.audience).toBe("human");
    expect(result.entries.map((entry) => entry.email)).toEqual([
      "jane@human-company.com",
      "architecture@human-company.com",
      "zkhawaja@zokorp.com",
    ]);
    expect(result.stats.flaggedContacts).toBe(1);
    expect(result.stats.displayedContacts).toBe(3);
  });

  it("can focus only on flagged QA/test contacts", async () => {
    const result = await getLeadDirectory({ audience: "flagged" });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.email).toBe("qa-bot@acme-enterprise-test.com");
    expect(result.entries[0]?.isLikelyHuman).toBe(false);
    expect(result.entries[0]?.signals).toContain("test-domain");
  });

  it("can filter to leads needing operational attention", async () => {
    const result = await getLeadDirectory({ ops: "needs-attention", audience: "all" });

    expect(result.entries.map((entry) => entry.email)).toEqual([
      "qa-bot@acme-enterprise-test.com",
      "architecture@human-company.com",
    ]);
  });

  it("renders a CSV export with classification and ops columns", () => {
    const csv = renderLeadDirectoryCsv([
      {
        email: "jane@human-company.com",
        name: "Jane Doe",
        companyName: "Human Company",
        hasAccount: true,
        emailVerified: true,
        isAdmin: false,
        isInternal: false,
        firstSeenAt: new Date("2026-03-12T00:00:00.000Z"),
        latestAt: new Date("2026-03-12T00:00:00.000Z"),
        latestSource: "cloud-cost",
        sources: ["account", "cloud-cost"],
        submissionCount: 1,
        emailDeliveryState: "sent",
        crmSyncState: "synced",
        recommendedEngagement: "Savings Sprint",
        leadStage: null,
        nextAction: "Review and follow up if this contact is sales-qualified.",
        signals: [],
        isLikelyHuman: true,
      },
    ]);

    expect(csv).toContain("email,name,company_name");
    expect(csv).toContain("jane@human-company.com");
    expect(csv).toContain("Savings Sprint");
    expect(csv).toContain("Cloud Cost");
  });
});
