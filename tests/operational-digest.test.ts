import { describe, expect, it } from "vitest";

import type { AdminOperationsSnapshot } from "@/lib/admin-operations";
import { buildOperationalDigest, renderDigestEmail } from "@/lib/operational-digest";

function emptyIssues(): AdminOperationsSnapshot["architectureEmailIssues"] {
  return [];
}

function baseStats(): AdminOperationsSnapshot["stats"] {
  return {
    pendingArchitectureEmail: 0,
    failedArchitectureEmail: 0,
    crmNeedsAttention: 0,
    failedQuoteCompanions: 0,
    recentArchitectureRuns: 0,
    recentValidatorRuns: 0,
    recentMlopsRuns: 0,
    recentBookedCalls: 0,
    followUpAttention: 0,
    automationAttention: 0,
    internalFailures: 0,
    securitySignals: 0,
    publicContractAttention: 0,
  };
}

function baseSnapshot(): AdminOperationsSnapshot {
  return {
    stats: baseStats(),
    architectureEmailIssues: emptyIssues(),
    crmSyncIssues: emptyIssues(),
    estimateCompanionIssues: emptyIssues(),
    bookedCallSignals: emptyIssues(),
    automationHealthSignals: emptyIssues(),
    publicContractSignals: emptyIssues(),
    internalFailureSignals: emptyIssues(),
    securitySignals: emptyIssues(),
    followUpAttentionIssues: emptyIssues(),
    toolRunSignals: emptyIssues(),
  };
}

describe("operational digest", () => {
  it("reports no issues when all stats are zero", () => {
    const snapshot = baseSnapshot();
    const digest = buildOperationalDigest(snapshot, new Date("2026-05-22T13:00:00Z"));

    expect(digest.hasIssues).toBe(false);
    expect(digest.totalCriticalCount).toBe(0);
    expect(digest.sections).toEqual([]);
  });

  it("aggregates failure-pattern stats into discrete sections with examples", () => {
    const snapshot = baseSnapshot();
    snapshot.stats.failedArchitectureEmail = 2;
    snapshot.stats.crmNeedsAttention = 1;
    snapshot.stats.internalFailures = 3;
    snapshot.architectureEmailIssues = [
      {
        id: "ae_1",
        createdAt: new Date("2026-05-22T08:00:00Z"),
        title: "Outbox send failed",
        statusLabel: "failed",
        statusTone: "danger",
        summary: "Resend returned 5xx for architect@example.com",
        details: ["jobId=abc-123"],
      },
      {
        id: "ae_2",
        createdAt: new Date("2026-05-22T09:00:00Z"),
        title: "Outbox send pending",
        statusLabel: "pending",
        statusTone: "warning",
        summary: "Has been pending > 10 min",
        details: [],
      },
    ];
    snapshot.crmSyncIssues = [
      {
        id: "cs_1",
        createdAt: new Date("2026-05-22T07:30:00Z"),
        title: "Zoho CRM sync failed",
        statusLabel: "needs_attention",
        statusTone: "danger",
        summary: "Token may need refresh",
        details: ["leadId=lead-9"],
      },
    ];
    snapshot.internalFailureSignals = [
      {
        id: "if_1",
        createdAt: new Date("2026-05-22T10:00:00Z"),
        title: "service.request_operator_email_failed",
        statusLabel: "error",
        statusTone: "danger",
        summary: "SMTP refused to relay",
        details: [],
      },
    ];

    const digest = buildOperationalDigest(snapshot, new Date("2026-05-22T13:00:00Z"));

    expect(digest.hasIssues).toBe(true);
    expect(digest.totalCriticalCount).toBe(6);
    expect(digest.sections.map((section) => section.label)).toEqual([
      "Architecture Reviewer email delivery",
      "Zoho CRM sync",
      "Internal operational failures",
    ]);
    expect(digest.sections[0]?.examples).toHaveLength(2);
    expect(digest.sections[0]?.examples[0]).toContain("Outbox send failed");
    expect(digest.sections[0]?.examples[0]).toContain("[failed]");
    expect(digest.sections[0]?.examples[0]).toContain("Resend returned 5xx");
  });

  it("limits the example list to 3 issues per section", () => {
    const snapshot = baseSnapshot();
    snapshot.stats.internalFailures = 5;
    snapshot.internalFailureSignals = Array.from({ length: 5 }, (_, index) => ({
      id: `if_${index}`,
      createdAt: new Date(`2026-05-22T${String(index).padStart(2, "0")}:00:00Z`),
      title: `Failure ${index}`,
      statusLabel: "error",
      statusTone: "danger" as const,
      summary: `Detail ${index}`,
      details: [],
    }));

    const digest = buildOperationalDigest(snapshot, new Date("2026-05-22T13:00:00Z"));
    expect(digest.sections[0]?.examples).toHaveLength(3);
  });

  it("renders an 'all clear' subject and body when there are no issues", () => {
    const snapshot = baseSnapshot();
    snapshot.stats.recentArchitectureRuns = 4;
    snapshot.stats.recentValidatorRuns = 2;
    const digest = buildOperationalDigest(snapshot, new Date("2026-05-22T13:00:00Z"));
    const { subject, text, html } = renderDigestEmail(digest);

    expect(subject).toBe("[ZoKorp ops] 2026-05-22 — all clear");
    expect(text).toContain("No operational failures detected in the last 24 hours.");
    expect(text).toContain("Architecture reviewer runs: 4");
    expect(text).toContain("Validator runs: 2");
    expect(html).toContain("No operational failures detected");
  });

  it("renders an attention-needed subject and section blocks when there are issues", () => {
    const snapshot = baseSnapshot();
    snapshot.stats.failedArchitectureEmail = 2;
    snapshot.architectureEmailIssues = [
      {
        id: "ae_1",
        createdAt: new Date("2026-05-22T08:00:00Z"),
        title: "Outbox send failed",
        statusLabel: "failed",
        statusTone: "danger",
        summary: "Resend returned 5xx",
        details: [],
      },
    ];

    const digest = buildOperationalDigest(snapshot, new Date("2026-05-22T13:00:00Z"));
    const { subject, text, html } = renderDigestEmail(digest);

    expect(subject).toBe("[ZoKorp ops] 2026-05-22 — 2 items need attention");
    expect(text).toContain("2 items need attention:");
    expect(text).toContain("[2] Architecture Reviewer email delivery");
    expect(text).toContain("Outbox send failed");
    expect(html).toContain("Architecture Reviewer email delivery");
    expect(html).toContain("Outbox send failed");
  });

  it("uses 'item' (singular) when exactly one item needs attention", () => {
    const snapshot = baseSnapshot();
    snapshot.stats.crmNeedsAttention = 1;
    snapshot.crmSyncIssues = [
      {
        id: "cs_1",
        createdAt: new Date("2026-05-22T07:30:00Z"),
        title: "Sync failed",
        statusLabel: "error",
        statusTone: "danger",
        summary: "x",
        details: [],
      },
    ];
    const digest = buildOperationalDigest(snapshot, new Date("2026-05-22T13:00:00Z"));
    const { subject, text } = renderDigestEmail(digest);

    expect(subject).toBe("[ZoKorp ops] 2026-05-22 — 1 item needs attention");
    expect(text).toContain("1 item needs attention:");
    expect(text).toContain("[1] Zoho CRM sync");
  });
});
