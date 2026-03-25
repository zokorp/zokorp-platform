import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  create: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    leadEvent: {
      create: dbMocks.create,
      upsert: dbMocks.upsert,
    },
  },
}));

import { buildEstimateReferenceCode, hashSubmissionFingerprint, recordLeadEvent } from "@/lib/privacy-leads";

describe("privacy lead helpers", () => {
  it("builds a stable estimate reference code from the tool and email", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T14:00:00.000Z"));

    const code = buildEstimateReferenceCode({
      source: "landing-zone",
      email: "Owner@AcmeCloud.com",
    });

    expect(code).toMatch(/^ZK-LZ-20260324-[A-F0-9]{6}$/);
  });

  it("creates the same fingerprint hash for the same logical submission payload", () => {
    const first = hashSubmissionFingerprint({
      toolName: "landing-zone",
      email: "owner@acmecloud.com",
      payload: {
        companyName: "Acme Cloud",
        answers: {
          mfa: "yes",
          sso: "yes",
        },
      },
    });

    const second = hashSubmissionFingerprint({
      toolName: "landing-zone",
      email: "OWNER@ACMECLOUD.COM",
      payload: {
        answers: {
          sso: "yes",
          mfa: "yes",
        },
        companyName: "Acme Cloud",
      },
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("upserts lead events when a source record key is present", async () => {
    dbMocks.upsert.mockResolvedValueOnce({ id: "evt_1" });

    const result = await recordLeadEvent({
      leadId: "lead_1",
      userId: "user_1",
      aggregate: {
        source: "architecture-review",
        deliveryState: "sent",
        crmSyncState: "skipped",
        saveForFollowUp: true,
        allowCrmFollowUp: false,
        scoreBand: "40-59",
        estimateBand: "1000-1999",
        recommendedEngagement: "implementation-partner",
        sourceRecordKey: "architecture-review:job_123",
      },
    });

    expect(result).toEqual({ id: "evt_1" });
    expect(dbMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceRecordKey: "architecture-review:job_123" },
      }),
    );
    expect(dbMocks.create).not.toHaveBeenCalled();
  });

  it("creates lead events when no source record key is present", async () => {
    dbMocks.create.mockResolvedValueOnce({ id: "evt_2" });

    const result = await recordLeadEvent({
      leadId: "lead_2",
      aggregate: {
        source: "cloud-cost",
        deliveryState: "sent",
        crmSyncState: "pending",
        saveForFollowUp: false,
        allowCrmFollowUp: true,
      },
    });

    expect(result).toEqual({ id: "evt_2" });
    expect(dbMocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "lead_2",
          sourceRecordKey: null,
        }),
      }),
    );
  });
});
