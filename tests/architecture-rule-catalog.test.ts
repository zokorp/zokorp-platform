import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ArchitectureRuleCatalogPricingMode,
  ArchitectureRuleCatalogReviewStatus,
} from "@prisma/client";

const state = vi.hoisted(() => {
  const createCatalog = (input: Partial<Record<string, unknown>> & { ruleId: string }) => ({
    id: String(input.id ?? `catalog_${Math.random().toString(36).slice(2, 8)}`),
    ruleId: input.ruleId,
    category: String(input.category ?? "security"),
    isPresentInCode: input.isPresentInCode ?? true,
    codeSnapshotJson: input.codeSnapshotJson ?? {},
    reviewStatus: input.reviewStatus ?? "UNREVIEWED",
    publishedVersion: input.publishedVersion ?? null,
    publishedRevisionId: input.publishedRevisionId ?? null,
    serviceLineLabel: input.serviceLineLabel ?? null,
    publicFixSummary: input.publicFixSummary ?? null,
    internalResearchNotes: input.internalResearchNotes ?? null,
    pricingMode: input.pricingMode ?? "DERIVED",
    overrideMinPriceUsd: input.overrideMinPriceUsd ?? null,
    overrideMaxPriceUsd: input.overrideMaxPriceUsd ?? null,
    nextReviewAt: input.nextReviewAt ?? null,
    lastReviewedAt: input.lastReviewedAt ?? null,
    lastReviewedByEmail: input.lastReviewedByEmail ?? null,
    publishedAt: input.publishedAt ?? null,
    lastCodeSyncedAt: input.lastCodeSyncedAt ?? new Date("2026-03-24T00:00:00.000Z"),
    createdAt: input.createdAt ?? new Date("2026-03-24T00:00:00.000Z"),
    updatedAt: input.updatedAt ?? new Date("2026-03-24T00:00:00.000Z"),
  });

  const createRevision = (input: Partial<Record<string, unknown>> & { catalogId: string; version: number }) => ({
    id: String(input.id ?? `revision_${Math.random().toString(36).slice(2, 8)}`),
    catalogId: input.catalogId,
    version: input.version,
    status: input.status ?? "DRAFT",
    serviceLineLabel: String(input.serviceLineLabel ?? "Draft service line"),
    publicFixSummary: String(input.publicFixSummary ?? "Draft public summary"),
    internalResearchNotes: input.internalResearchNotes ?? null,
    pricingMode: input.pricingMode ?? "DERIVED",
    overrideMinPriceUsd: input.overrideMinPriceUsd ?? null,
    overrideMaxPriceUsd: input.overrideMaxPriceUsd ?? null,
    nextReviewAt: input.nextReviewAt ?? null,
    changeSummary: input.changeSummary ?? null,
    changedByEmail: input.changedByEmail ?? null,
    createdAt: input.createdAt ?? new Date("2026-03-24T00:00:00.000Z"),
    publishedAt: input.publishedAt ?? null,
    effectiveAt: input.effectiveAt ?? null,
    snapshotJson: input.snapshotJson ?? {},
  });

  return {
    catalogs: [] as ReturnType<typeof createCatalog>[],
    revisions: [] as ReturnType<typeof createRevision>[],
    createCatalog,
    createRevision,
    reset() {
      this.catalogs = [];
      this.revisions = [];
    },
  };
});

function clone<T>(value: T): T {
  return structuredClone(value);
}

vi.mock("@/lib/db", () => ({
  db: {
    architectureRuleCatalog: {
      findMany: vi.fn(async (args?: Record<string, unknown>) => {
        let rows = [...state.catalogs];
        const where = (args?.where ?? {}) as Record<string, unknown>;

        if (where.ruleId && typeof where.ruleId === "object" && where.ruleId !== null && "in" in where.ruleId) {
          const allowed = new Set((where.ruleId as { in: string[] }).in);
          rows = rows.filter((row) => allowed.has(row.ruleId));
        }

        if (where.reviewStatus) {
          rows = rows.filter((row) => row.reviewStatus === where.reviewStatus);
        }

        if (where.isPresentInCode !== undefined) {
          rows = rows.filter((row) => row.isPresentInCode === where.isPresentInCode);
        }

        return rows.map((row) => clone(row));
      }),
      findUnique: vi.fn(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const row = state.catalogs.find((entry) => entry.ruleId === where.ruleId);
        if (!row) {
          return null;
        }

        if ((args.select as Record<string, unknown> | undefined)?.revisions) {
          return {
            ...clone(row),
            revisions: state.revisions
              .filter((revision) => revision.catalogId === row.id)
              .sort((left, right) => right.version - left.version)
              .map((revision) => clone(revision)),
          };
        }

        return clone(row);
      }),
      create: vi.fn(async (args: Record<string, unknown>) => {
        const row = state.createCatalog(args.data as { ruleId: string });
        state.catalogs.push(row);
        return clone(row);
      }),
      update: vi.fn(async (args: Record<string, unknown>) => {
        const where = args.where as Record<string, unknown>;
        const row = state.catalogs.find((entry) => entry.id === where.id);
        if (!row) {
          throw new Error("catalog not found");
        }

        Object.assign(row, args.data, {
          updatedAt: new Date("2026-03-25T00:00:00.000Z"),
        });
        return clone(row);
      }),
    },
    architectureRuleCatalogRevision: {
      create: vi.fn(async (args: Record<string, unknown>) => {
        const row = state.createRevision(args.data as { catalogId: string; version: number });
        state.revisions.push(row);
        return clone(row);
      }),
    },
  },
}));

vi.mock("@/lib/db-errors", () => ({
  isSchemaDriftError: () => false,
}));

import {
  getArchitectureRuleCatalogDirectory,
  loadArchitectureEstimateSnapshot,
  parseArchitectureRuleCatalogFormInput,
  publishArchitectureRuleCatalog,
  saveArchitectureRuleCatalogDraft,
  syncArchitectureRuleCatalog,
} from "@/lib/architecture-review/rule-catalog";
import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";
import { getArchitectureReviewPricingCatalogEntry } from "@/lib/architecture-review/pricing-catalog";

describe("architecture rule catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.reset();
  });

  it("uses a published DB override for live quote copy and pricing", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("PILLAR-SECURITY");
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_security",
        ruleId: "PILLAR-SECURITY",
        category: "security",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
        publishedVersion: 2,
        publishedRevisionId: "revision_security_live",
        serviceLineLabel: "Security redesign sprint",
        publicFixSummary: "Map IAM, secret storage, and encryption controls into the diagram.",
        pricingMode: ArchitectureRuleCatalogPricingMode.OVERRIDE,
        overrideMinPriceUsd: 900,
        overrideMaxPriceUsd: 1100,
      }),
    );

    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Edge traffic reaches app services and a stateful store.",
      findings: [
        {
          ruleId: "PILLAR-SECURITY",
          category: "security",
          pointsDeducted: 12,
          message: "Security controls are missing.",
          fix: "Add IAM, secret-management, and encryption details.",
          evidence: "No security controls were described.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    const { snapshot, auditUsage } = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });

    expect(snapshot.totalUsd).toBe(1000);
    expect(snapshot.lineItems[0]).toMatchObject({
      ruleId: "PILLAR-SECURITY",
      serviceLineLabel: "Security redesign sprint",
      publicFixSummary: "Map IAM, secret storage, and encryption controls into the diagram.",
      amountUsd: 1000,
      source: "published",
      publishedRevisionId: "revision_security_live",
    });
    expect(auditUsage[0]).toMatchObject({
      ruleId: "PILLAR-SECURITY",
      source: "published",
      pricingMode: "OVERRIDE",
      amountUsd: 1000,
    });
  });

  it("falls back to code-backed pricing when a rule only has a draft", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("PILLAR-OPERATIONS");
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_ops",
        ruleId: "PILLAR-OPERATIONS",
        category: "operations",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.DRAFT,
        publishedVersion: null,
        serviceLineLabel: "Draft-only operations package",
        publicFixSummary: "Draft summary that should not go live.",
        pricingMode: ArchitectureRuleCatalogPricingMode.OVERRIDE,
        overrideMinPriceUsd: 999,
        overrideMaxPriceUsd: 999,
      }),
    );

    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Services process requests and write audit logs.",
      findings: [
        {
          ruleId: "PILLAR-OPERATIONS",
          category: "operations",
          pointsDeducted: 8,
          message: "Operational controls are missing.",
          fix: "Add metrics, alerts, logs, and runbook ownership.",
          evidence: "No meaningful observability controls were described.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    const { snapshot } = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });

    expect(snapshot.lineItems[0]).toMatchObject({
      ruleId: "PILLAR-OPERATIONS",
      serviceLineLabel: "Observability and runbook setup",
      source: "fallback",
    });
    expect(snapshot.lineItems[0]?.amountUsd).toBe(report.findings[0]?.fixCostUSD);
  });

  it("syncs missing rules and marks changed or removed rules as stale", async () => {
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_changed",
        ruleId: "PILLAR-SECURITY",
        category: "security",
        codeSnapshotJson: { ruleId: "PILLAR-SECURITY", serviceLine: "Old value" },
        reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
        publishedVersion: 1,
      }),
    );
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_removed",
        ruleId: "REMOVED-RULE",
        category: "clarity",
        codeSnapshotJson: { ruleId: "REMOVED-RULE" },
        reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
        publishedVersion: 3,
      }),
    );

    const result = await syncArchitectureRuleCatalog();

    expect(result.created).toBeGreaterThan(0);
    expect(result.markedStale).toBeGreaterThanOrEqual(2);

    const changed = state.catalogs.find((entry) => entry.ruleId === "PILLAR-SECURITY");
    const removed = state.catalogs.find((entry) => entry.ruleId === "REMOVED-RULE");

    expect(changed?.reviewStatus).toBe(ArchitectureRuleCatalogReviewStatus.STALE);
    expect(removed?.reviewStatus).toBe(ArchitectureRuleCatalogReviewStatus.STALE);
    expect(removed?.isPresentInCode).toBe(false);
  });

  it("saves drafts without changing the published runtime row", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("PILLAR-COST");
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_cost",
        ruleId: "PILLAR-COST",
        category: "cost",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
        publishedVersion: 1,
        publishedRevisionId: "revision_cost_live",
        serviceLineLabel: "Cost guardrail review",
        publicFixSummary: "Current published summary.",
        pricingMode: ArchitectureRuleCatalogPricingMode.OVERRIDE,
        overrideMinPriceUsd: 650,
        overrideMaxPriceUsd: 650,
      }),
    );

    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Services fan out to multiple managed dependencies.",
      findings: [
        {
          ruleId: "PILLAR-COST",
          category: "cost",
          pointsDeducted: 8,
          message: "Cost controls are missing.",
          fix: "Add budget guardrails, scale limits, and lifecycle coverage.",
          evidence: "No cost controls were described.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    const liveBeforeDraft = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });

    await saveArchitectureRuleCatalogDraft({
      ruleId: "PILLAR-COST",
      serviceLineLabel: "Draft cost optimization package",
      publicFixSummary: "Draft summary only.",
      changedByEmail: "owner@zokorp.com",
    });

    const catalog = state.catalogs.find((entry) => entry.ruleId === "PILLAR-COST");
    const draftRevision = state.revisions.find((entry) => entry.catalogId === "catalog_cost");
    const liveAfterDraft = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });
    const directory = await getArchitectureRuleCatalogDirectory();
    const directoryEntry = directory.entries.find((entry) => entry.ruleId === "PILLAR-COST");

    expect(catalog?.reviewStatus).toBe(ArchitectureRuleCatalogReviewStatus.DRAFT);
    expect(catalog?.serviceLineLabel).toBe("Cost guardrail review");
    expect(liveBeforeDraft.snapshot.lineItems[0]).toMatchObject({
      source: "published",
      serviceLineLabel: "Cost guardrail review",
      amountUsd: 650,
    });
    expect(liveAfterDraft.snapshot.lineItems[0]).toMatchObject({
      source: "published",
      serviceLineLabel: "Cost guardrail review",
      amountUsd: 650,
    });
    expect(directoryEntry).toMatchObject({
      liveState: "DRAFT_PENDING",
      hasDraftPending: true,
    });
    expect(draftRevision).toMatchObject({
      status: ArchitectureRuleCatalogReviewStatus.DRAFT,
      serviceLineLabel: "Draft cost optimization package",
      publicFixSummary: "Draft summary only.",
      changedByEmail: "owner@zokorp.com",
    });
  });

  it("falls back to code-backed pricing when a previously published rule is stale", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("PILLAR-SECURITY");
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_security_stale",
        ruleId: "PILLAR-SECURITY",
        category: "security",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.STALE,
        publishedVersion: 4,
        publishedRevisionId: "revision_security_stale",
        serviceLineLabel: "Stale security override",
        publicFixSummary: "Should not stay live when stale.",
        pricingMode: ArchitectureRuleCatalogPricingMode.OVERRIDE,
        overrideMinPriceUsd: 1500,
        overrideMaxPriceUsd: 1500,
      }),
    );

    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Traffic reaches application services and stateful systems.",
      findings: [
        {
          ruleId: "PILLAR-SECURITY",
          category: "security",
          pointsDeducted: 12,
          message: "Security controls are missing.",
          fix: "Document identity, secret, and encryption controls.",
          evidence: "No explicit security controls were described.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    const { snapshot } = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });

    expect(snapshot.lineItems[0]).toMatchObject({
      source: "fallback",
      serviceLineLabel: codeEntry?.serviceLine,
      publicFixSummary: report.findings[0]?.fix,
    });
    expect(snapshot.lineItems[0]?.amountUsd).toBe(report.findings[0]?.fixCostUSD);
  });

  it("publishes a reviewed revision and leaves immutable code-backed fields untouched", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("CLAR-STALE-DIAGRAM");
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_stale",
        ruleId: "CLAR-STALE-DIAGRAM",
        category: "clarity",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.UNREVIEWED,
      }),
    );

    const formData = new FormData();
    formData.set("ruleId", "CLAR-STALE-DIAGRAM");
    formData.set("serviceLineLabel", "Diagram refresh sprint");
    formData.set("publicFixSummary", "Refresh the stale architecture view and recertify the operating flow.");
    formData.set("pricingMode", "OVERRIDE");
    formData.set("overrideMinPriceUsd", "450");
    formData.set("overrideMaxPriceUsd", "650");
    formData.set("changeSummary", "Founder-reviewed update");
    formData.set("category", "security");

    const parsed = parseArchitectureRuleCatalogFormInput(formData);
    await publishArchitectureRuleCatalog({
      ...parsed,
      changedByEmail: "owner@zokorp.com",
    });

    const catalog = state.catalogs.find((entry) => entry.ruleId === "CLAR-STALE-DIAGRAM");
    const publishedRevision = state.revisions.find((entry) => entry.catalogId === "catalog_stale");

    expect(parsed).not.toHaveProperty("category");
    expect(catalog).toMatchObject({
      category: "clarity",
      reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
      serviceLineLabel: "Diagram refresh sprint",
      pricingMode: ArchitectureRuleCatalogPricingMode.OVERRIDE,
      overrideMinPriceUsd: 450,
      overrideMaxPriceUsd: 650,
      lastReviewedByEmail: "owner@zokorp.com",
    });
    expect(publishedRevision).toMatchObject({
      status: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
      serviceLineLabel: "Diagram refresh sprint",
      changedByEmail: "owner@zokorp.com",
    });
  });
});
