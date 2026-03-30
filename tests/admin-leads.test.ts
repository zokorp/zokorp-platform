import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const {
  userFindManyMock,
  leadFindManyMock,
  leadLogFindManyMock,
} = vi.hoisted(() => ({
  userFindManyMock: vi.fn(),
  leadFindManyMock: vi.fn(),
  leadLogFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: userFindManyMock },
    lead: { findMany: leadFindManyMock },
    leadLog: { findMany: leadLogFindManyMock },
  },
}));

import { getLeadDirectory, renderLeadDirectoryCsv } from "@/lib/admin-leads";

describe("admin leads helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    userFindManyMock.mockResolvedValue([
      {
        id: "user_admin",
        email: "zkhawaja@zokorp.com",
        name: "Zohaib Khawaja",
        emailVerified: new Date("2026-03-09T00:00:00.000Z"),
        role: Role.ADMIN,
        createdAt: new Date("2026-03-09T00:00:00.000Z"),
      },
    ]);

    leadFindManyMock.mockResolvedValue([
      {
        email: "architecture@human-company.com",
        name: "Jordan Rivera",
        companyName: "Human Company",
        createdAt: new Date("2026-03-10T00:00:00.000Z"),
        lastSeenAt: new Date("2026-03-10T01:00:00.000Z"),
        userId: null,
        user: null,
        events: [
          {
            source: "architecture-review",
            deliveryState: "sent",
            crmSyncState: "pending",
            saveForFollowUp: true,
            allowCrmFollowUp: true,
            scoreBand: "75-89",
            estimateBand: "$1k-$2k",
            recommendedEngagement: "remediation-sprint",
            createdAt: new Date("2026-03-10T01:00:00.000Z"),
            sourceRecordKey: null,
          },
        ],
      },
      {
        email: "qa-bot@acme-enterprise-test.com",
        userName: "Jordan Rivera",
        companyName: "Acme Enterprise Test",
        createdAt: new Date("2026-03-11T00:00:00.000Z"),
        lastSeenAt: new Date("2026-03-11T01:00:00.000Z"),
        userId: null,
        user: null,
        events: [
          {
            source: "architecture-review",
            deliveryState: "failed",
            crmSyncState: "pending",
            saveForFollowUp: false,
            allowCrmFollowUp: false,
            scoreBand: "25-49",
            estimateBand: "$500-$1k",
            recommendedEngagement: "focused-remediation",
            createdAt: new Date("2026-03-11T01:00:00.000Z"),
            sourceRecordKey: null,
          },
        ],
      },
      {
        email: "jane@human-company.com",
        name: "Jane Doe",
        companyName: "Human Company",
        createdAt: new Date("2026-03-12T00:00:00.000Z"),
        lastSeenAt: new Date("2026-03-12T01:00:00.000Z"),
        userId: null,
        user: null,
        events: [
          {
            source: "architecture-review",
            deliveryState: "sent",
            crmSyncState: "synced",
            saveForFollowUp: true,
            allowCrmFollowUp: false,
            scoreBand: "50-74",
            estimateBand: "$2k-$3k",
            recommendedEngagement: "Savings Sprint",
            createdAt: new Date("2026-03-12T01:00:00.000Z"),
            sourceRecordKey: null,
          },
        ],
      },
    ]);

    leadLogFindManyMock.mockResolvedValue([]);
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

  it("uses legacy architecture logs only when a lead record is missing", async () => {
    userFindManyMock.mockResolvedValue([]);
    leadFindManyMock.mockResolvedValue([]);
    leadLogFindManyMock.mockResolvedValue([
      {
        userEmail: "legacy-arch@human-company.com",
        userName: "Legacy Arch",
        createdAt: new Date("2026-03-13T00:00:00.000Z"),
        quoteTier: "advisory-review",
        leadStage: "New Review",
        emailDeliveryMode: "email",
        emailSentAt: new Date("2026-03-13T01:00:00.000Z"),
        syncedToZohoAt: null,
        zohoSyncNeedsUpdate: true,
        zohoSyncError: null,
        workdriveUploadStatus: null,
      },
    ]);

    const result = await getLeadDirectory({ audience: "all" });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.email).toBe("legacy-arch@human-company.com");
    expect(result.entries[0]?.latestSource).toBe("architecture-review");
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
        latestSource: "architecture-review",
        sources: ["account", "architecture-review"],
        submissionCount: 1,
        emailDeliveryState: "sent",
        crmSyncState: "synced",
        workdriveUploadStatus: "uploaded",
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
    expect(csv).toContain("Architecture Review");
    expect(csv).toContain("workdrive_upload_status");
    expect(csv).toContain("uploaded");
  });

  it("neutralizes spreadsheet formulas in CSV exports", () => {
    const csv = renderLeadDirectoryCsv([
      {
        email: "formula@human-company.com",
        name: "=HYPERLINK(\"https://evil.test\")",
        companyName: "+Injected Corp",
        hasAccount: false,
        emailVerified: false,
        isAdmin: false,
        isInternal: false,
        firstSeenAt: new Date("2026-03-12T00:00:00.000Z"),
        latestAt: new Date("2026-03-12T00:00:00.000Z"),
        latestSource: "architecture-review",
        sources: ["architecture-review"],
        submissionCount: 1,
        emailDeliveryState: "sent",
        crmSyncState: "skipped",
        workdriveUploadStatus: null,
        recommendedEngagement: null,
        leadStage: null,
        nextAction: "Review.",
        signals: [],
        isLikelyHuman: true,
      },
    ]);

    expect(csv).toContain("\"'=HYPERLINK(\"\"https://evil.test\"\")\"");
    expect(csv).toContain("\"'+Injected Corp\"");
  });

  it("treats WorkDrive archive failures as ops attention with a visible next action", async () => {
    userFindManyMock.mockResolvedValue([]);
    leadFindManyMock.mockResolvedValue([]);
    leadLogFindManyMock.mockResolvedValue([
      {
        userEmail: "saved-review@human-company.com",
        userName: "Saved Review",
        createdAt: new Date("2026-03-14T00:00:00.000Z"),
        quoteTier: "remediation-sprint",
        leadStage: "New Review",
        emailDeliveryMode: "email",
        emailSentAt: new Date("2026-03-14T01:00:00.000Z"),
        syncedToZohoAt: new Date("2026-03-14T02:00:00.000Z"),
        zohoSyncNeedsUpdate: false,
        zohoSyncError: null,
        workdriveUploadStatus: "failed:WORKDRIVE_ACCESS_TOKEN_NOT_AVAILABLE",
      },
    ]);

    const result = await getLeadDirectory({ audience: "all", ops: "needs-attention" });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.email).toBe("saved-review@human-company.com");
    expect(result.entries[0]?.workdriveUploadStatus).toBe("failed:WORKDRIVE_ACCESS_TOKEN_NOT_AVAILABLE");
    expect(result.entries[0]?.nextAction).toContain("WorkDrive archive path");
    expect(result.stats.opsAttention).toBe(1);
  });
});
