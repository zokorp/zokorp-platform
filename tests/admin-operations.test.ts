import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  architectureReviewEmailOutboxFindManyMock,
  leadLogFindManyMock,
  estimateCompanionFindManyMock,
  toolRunFindManyMock,
  auditLogFindManyMock,
  leadInteractionFindManyMock,
  serviceRequestFindManyMock,
} = vi.hoisted(() => ({
  architectureReviewEmailOutboxFindManyMock: vi.fn(),
  leadLogFindManyMock: vi.fn(),
  estimateCompanionFindManyMock: vi.fn(),
  toolRunFindManyMock: vi.fn(),
  auditLogFindManyMock: vi.fn(),
  leadInteractionFindManyMock: vi.fn(),
  serviceRequestFindManyMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    architectureReviewEmailOutbox: {
      findMany: architectureReviewEmailOutboxFindManyMock,
    },
    leadLog: {
      findMany: leadLogFindManyMock,
    },
    estimateCompanion: {
      findMany: estimateCompanionFindManyMock,
    },
    toolRun: {
      findMany: toolRunFindManyMock,
    },
    auditLog: {
      findMany: auditLogFindManyMock,
    },
    leadInteraction: {
      findMany: leadInteractionFindManyMock,
    },
    serviceRequest: {
      findMany: serviceRequestFindManyMock,
    },
  },
}));

import { getAdminOperationsSnapshot } from "@/lib/admin-operations";

describe("admin operations snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    architectureReviewEmailOutboxFindManyMock.mockResolvedValue([]);
    leadLogFindManyMock.mockResolvedValue([]);
    estimateCompanionFindManyMock.mockResolvedValue([]);
    toolRunFindManyMock.mockResolvedValue([]);
    auditLogFindManyMock.mockResolvedValue([]);
    leadInteractionFindManyMock.mockResolvedValue([]);
    serviceRequestFindManyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces booked-call qualification and sync configuration signals", async () => {
    estimateCompanionFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    auditLogFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "audit_flagged",
          action: "integration.calendly_non_business_email_flagged",
          createdAt: new Date("2026-04-04T20:00:00.000Z"),
          metadataJson: {
            email: "person@gmail.com",
            provider: "calendly",
            externalEventId: "evt_flagged",
          },
        },
        {
          id: "audit_not_configured",
          action: "internal.calendly_booked_call.not_configured",
          createdAt: new Date("2026-04-04T21:00:00.000Z"),
          metadataJson: null,
        },
      ])
      .mockResolvedValueOnce([]);
    leadInteractionFindManyMock.mockResolvedValueOnce([
      {
        id: "interaction_1",
        createdAt: new Date("2026-04-04T19:00:00.000Z"),
        lead: {
          email: "owner@acme-enterprise.com",
        },
        provider: "calendly",
        source: "architecture-review",
        estimateReferenceCode: "EST-123",
        serviceRequest: {
          trackingCode: "SR-123",
          status: "SCHEDULED",
        },
      },
    ]);

    const snapshot = await getAdminOperationsSnapshot();

    expect(snapshot.stats.recentBookedCalls).toBe(3);
    expect(snapshot.bookedCallSignals.map((entry) => entry.title)).toEqual([
      "Booked-call ingest not configured",
      "Booked follow-up flagged",
      "Booked follow-up synced",
    ]);
    expect(snapshot.bookedCallSignals[0]).toMatchObject({
      statusLabel: "not configured",
      href: "/admin/readiness",
    });
    expect(snapshot.bookedCallSignals[1]).toMatchObject({
      statusLabel: "business email required",
      summary: "person@gmail.com · calendly",
    });
    expect(snapshot.bookedCallSignals[2]).toMatchObject({
      statusLabel: "linked",
      summary: "owner@acme-enterprise.com · calendly · architecture-review",
    });
  });

  it("summarizes automation freshness and failure signals for scheduled jobs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T22:00:00.000Z"));

    estimateCompanionFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    auditLogFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "worker_run",
          action: "internal.architecture_review_worker.run",
          createdAt: new Date("2026-04-04T21:56:00.000Z"),
          metadataJson: { processed: 2, scanned: 3 },
        },
        {
          id: "followups_stale",
          action: "internal.architecture_review_followups.run",
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
          metadataJson: { processed: 4 },
        },
        {
          id: "retention_ok",
          action: "internal.retention_sweep.completed",
          createdAt: new Date("2026-04-04T05:00:00.000Z"),
          metadataJson: { scanned: 12 },
        },
        {
          id: "zoho_failed",
          action: "internal.zoho_sync_leads.failed",
          createdAt: new Date("2026-04-04T20:00:00.000Z"),
          metadataJson: { error: "ZOHO_TIMEOUT" },
        },
        {
          id: "estimate_ok",
          action: "internal.zoho_sync_estimate_companions.run",
          createdAt: new Date("2026-04-04T21:10:00.000Z"),
          metadataJson: { scanned: 5, updated: 1, failed: 0 },
        },
      ]);
    leadInteractionFindManyMock.mockResolvedValueOnce([]);
    leadInteractionFindManyMock.mockResolvedValueOnce([]);

    const snapshot = await getAdminOperationsSnapshot();

    expect(snapshot.stats.automationAttention).toBe(2);
    expect(snapshot.automationHealthSignals.map((entry) => [entry.title, entry.statusLabel])).toEqual([
      ["Zoho lead sync", "failed"],
      ["Architecture follow-ups", "stale"],
      ["Architecture queue worker", "healthy"],
      ["Estimate companion sync", "healthy"],
      ["Retention sweep", "healthy"],
    ]);
    expect(snapshot.automationHealthSignals[0]).toMatchObject({
      summary: "Expected weekly or on demand · Last signal 2 hour(s) ago",
    });
    expect(snapshot.automationHealthSignals[1]).toMatchObject({
      summary: "Expected daily · Last signal 3 day(s) ago",
    });
  });

  it("surfaces internal failures and CSP signals for operators", async () => {
    estimateCompanionFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    auditLogFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "internal_failure_1",
          action: "service.request_submission_failed",
          createdAt: new Date("2026-04-04T22:10:00.000Z"),
          metadataJson: {
            route: "/api/services/requests",
            trackingCode: "SR-123",
            errorName: "Error",
            errorMessage: "Unable to submit service request.",
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "security_1",
          action: "security.csp_violation",
          createdAt: new Date("2026-04-04T22:12:00.000Z"),
          metadataJson: {
            reports: [
              {
                effectiveDirective: "script-src",
                blockedUri: "https://example.com/script.js",
                documentUri: "https://www.zokorp.com/",
              },
            ],
            userAgent: "Mozilla/5.0",
          },
        },
      ]);

    const snapshot = await getAdminOperationsSnapshot();

    expect(snapshot.stats.internalFailures).toBe(1);
    expect(snapshot.stats.securitySignals).toBe(1);
    expect(snapshot.internalFailureSignals[0]).toMatchObject({
      title: "Service request submission failed",
      summary: "/api/services/requests · SR-123",
      href: "/admin/service-requests",
    });
    expect(snapshot.securitySignals[0]).toMatchObject({
      title: "Content Security Policy violation",
      summary: "script-src · https://example.com/script.js · https://www.zokorp.com/",
      href: "/admin/readiness",
    });
  });
});
