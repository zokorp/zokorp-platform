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
    const codeEntry = getArchitectureReviewPricingCatalogEntry("internet_facing_endpoint_without_tls");
    const ruleId = codeEntry!.ruleId;
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_security",
        ruleId,
        category: "security",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
        publishedVersion: 2,
        publishedRevisionId: "revision_security_live",
        serviceLineLabel: "TLS hardening sprint",
        publicFixSummary: "Enforce HTTPS/TLS on the public path before quoting any polish work.",
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
          ruleId,
          category: "security",
          pointsDeducted: 5,
          message: "Public traffic is present without explicit TLS enforcement.",
          fix: "Terminate TLS with ACM at the public entry point and enforce HTTPS-only.",
          evidence: "The submission shows internet-facing traffic without clearly stating TLS termination.",
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
      ruleId,
      serviceLineLabel: "TLS hardening sprint",
      publicFixSummary: "Enforce HTTPS/TLS on the public path before quoting any polish work.",
      amountUsd: 1000,
      source: "published",
      publishedRevisionId: "revision_security_live",
    });
    expect(auditUsage[0]).toMatchObject({
      ruleId,
      source: "published",
      pricingMode: "OVERRIDE",
      amountUsd: 1000,
    });
  });

  it("falls back to code-backed pricing when a rule only has a draft", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("centralized_application_logging");
    const ruleId = codeEntry!.ruleId;
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_ops",
        ruleId,
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
          ruleId,
          category: "operations",
          pointsDeducted: 4,
          message: "Application logs are not centralized.",
          fix: "Ship service logs to CloudWatch Logs with retention and access controls.",
          evidence: "The submission does not show a centralized logging path.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    const { snapshot } = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });

    expect(snapshot.lineItems[0]).toMatchObject({
      ruleId,
      serviceLineLabel: codeEntry?.serviceLine,
      source: "fallback",
    });
    expect(snapshot.lineItems[0]?.amountUsd).toBeGreaterThan(0);
    expect(snapshot.lineItems[0]?.amountUsd).not.toBe(999);
  });

  it("suppresses payable quotes for low-score consultation-first reviews", async () => {
    const report = buildArchitectureReviewReport({
      provider: "aws",
      flowNarrative: "Traffic path is unclear and the submission is missing security, reliability, and operations details.",
      findings: [
        {
          ruleId: "internet_facing_endpoint_without_tls",
          category: "security",
          pointsDeducted: 12,
          message: "Public traffic is present without explicit TLS enforcement.",
          fix: "Terminate TLS with ACM at the public entry point and enforce HTTPS-only.",
          evidence: "The public ingress path does not show HTTPS/TLS.",
        },
        {
          ruleId: "single_az_database_for_production",
          category: "reliability",
          pointsDeducted: 10,
          message: "The production database is single-AZ.",
          fix: "Enable Multi-AZ or redesign the database location strategy.",
          evidence: "The submission only shows a single-AZ relational database path.",
        },
        {
          ruleId: "centralized_application_logging",
          category: "operations",
          pointsDeducted: 8,
          message: "Production logging is missing.",
          fix: "Centralize application logs and baseline retention.",
          evidence: "The diagram does not show centralized service logs.",
        },
        {
          ruleId: "workload_objective_and_constraints_stated",
          category: "clarity",
          pointsDeducted: 12,
          message: "The workload objective and constraints are not credible yet.",
          fix: "State the workload objective, users, load, and recovery requirements.",
          evidence: "The narrative leaves core constraints ambiguous.",
        },
        {
          ruleId: "autoscaling_defined_for_variable_load",
          category: "performance",
          pointsDeducted: 8,
          message: "No scaling strategy is defined for the variable workload.",
          fix: "Add Auto Scaling or an equivalent scaling path with guardrails.",
          evidence: "The workload claims variability but no scaling controls are shown.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    const { snapshot } = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });

    expect(snapshot.policy).toMatchObject({
      band: "consultation-only",
      scoreBandLabel: "0-59",
      payableQuoteEnabled: false,
    });
    expect(snapshot.totalUsd).toBe(0);
    expect(snapshot.lineItems).toHaveLength(0);
  });

  it("syncs missing rules and marks changed or removed rules as stale", async () => {
    const changedCodeEntry = getArchitectureReviewPricingCatalogEntry("internet_facing_endpoint_without_tls");
    const changedRuleId = changedCodeEntry!.ruleId;
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_changed",
        ruleId: changedRuleId,
        category: "security",
        codeSnapshotJson: { ruleId: changedRuleId, serviceLine: "Old value" },
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

    const changed = state.catalogs.find((entry) => entry.ruleId === changedRuleId);
    const removed = state.catalogs.find((entry) => entry.ruleId === "REMOVED-RULE");

    expect(changed?.reviewStatus).toBe(ArchitectureRuleCatalogReviewStatus.STALE);
    expect(removed?.reviewStatus).toBe(ArchitectureRuleCatalogReviewStatus.STALE);
    expect(removed?.isPresentInCode).toBe(false);
  });

  it("saves drafts without changing the published runtime row", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("autoscaling_defined_for_variable_load");
    const ruleId = codeEntry!.ruleId;
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_cost",
        ruleId,
        category: "performance",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
        publishedVersion: 1,
        publishedRevisionId: "revision_cost_live",
        serviceLineLabel: "Scaling strategy sprint",
        publicFixSummary: "Current published scaling summary.",
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
          ruleId,
          category: "performance",
          pointsDeducted: 8,
          message: "Scaling controls are missing for a variable workload.",
          fix: "Add Auto Scaling signals, thresholds, and scale safety limits.",
          evidence: "The architecture claims variable demand without a scaling path.",
        },
      ],
      userEmail: "architect@zokorp.com",
      generatedAtISO: "2026-03-24T00:00:00.000Z",
    });

    const liveBeforeDraft = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });

    await saveArchitectureRuleCatalogDraft({
      ruleId,
      serviceLineLabel: "Draft scaling optimization package",
      publicFixSummary: "Draft scaling summary only.",
      changedByEmail: "owner@zokorp.com",
    });

    const catalog = state.catalogs.find((entry) => entry.ruleId === ruleId);
    const draftRevision = state.revisions.find((entry) => entry.catalogId === "catalog_cost");
    const liveAfterDraft = await loadArchitectureEstimateSnapshot(report, {
      bookingUrl: "https://book.zokorp.com/architecture",
    });
    const directory = await getArchitectureRuleCatalogDirectory();
    const directoryEntry = directory.entries.find((entry) => entry.ruleId === ruleId);

    expect(catalog?.reviewStatus).toBe(ArchitectureRuleCatalogReviewStatus.DRAFT);
    expect(catalog?.serviceLineLabel).toBe("Scaling strategy sprint");
    expect(liveBeforeDraft.snapshot.lineItems[0]).toMatchObject({
      source: "published",
      serviceLineLabel: "Scaling strategy sprint",
      amountUsd: 650,
    });
    expect(liveAfterDraft.snapshot.lineItems[0]).toMatchObject({
      source: "published",
      serviceLineLabel: "Scaling strategy sprint",
      amountUsd: 650,
    });
    expect(directoryEntry).toMatchObject({
      liveState: "DRAFT_PENDING",
      hasDraftPending: true,
    });
    expect(draftRevision).toMatchObject({
      status: ArchitectureRuleCatalogReviewStatus.DRAFT,
      serviceLineLabel: "Draft scaling optimization package",
      publicFixSummary: "Draft scaling summary only.",
      changedByEmail: "owner@zokorp.com",
    });
  });

  it("falls back to code-backed pricing when a previously published rule is stale", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("data_classification_and_compliance_noted");
    const ruleId = codeEntry!.ruleId;
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_security_stale",
        ruleId,
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
          ruleId,
          category: "security",
          pointsDeducted: 3,
          message: "Sensitive data is implied, but classification and compliance scope are not explicit.",
          fix: "Add a short data inventory with sensitivity and compliance scope.",
          evidence: "The submission references customer data but does not classify it.",
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
      publicFixSummary: report.findings[0]?.howToFix,
    });
    expect(snapshot.lineItems[0]?.amountUsd).toBeGreaterThan(0);
    expect(snapshot.lineItems[0]?.amountUsd).not.toBe(1500);
  });

  it("rejects an inverted admin override band (ARCH-Q04)", () => {
    const formData = new FormData();
    formData.set("ruleId", "internet_facing_endpoint_without_tls");
    formData.set("pricingMode", "OVERRIDE");
    formData.set("overrideMinPriceUsd", "5000");
    formData.set("overrideMaxPriceUsd", "500");

    expect(() => parseArchitectureRuleCatalogFormInput(formData)).toThrow(/minimum price cannot exceed/i);
  });

  it("publishes a reviewed revision and leaves immutable code-backed fields untouched", async () => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry("infrastructure_as_code_indicated");
    const ruleId = codeEntry!.ruleId;
    state.catalogs.push(
      state.createCatalog({
        id: "catalog_stale",
        ruleId,
        category: "operations",
        codeSnapshotJson: codeEntry,
        reviewStatus: ArchitectureRuleCatalogReviewStatus.UNREVIEWED,
      }),
    );

    const formData = new FormData();
    formData.set("ruleId", ruleId);
    formData.set("serviceLineLabel", "IaC delivery baseline");
    formData.set("publicFixSummary", "Move the production footprint into reviewed infrastructure as code workflows.");
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

    const catalog = state.catalogs.find((entry) => entry.ruleId === ruleId);
    const publishedRevision = state.revisions.find((entry) => entry.catalogId === "catalog_stale");

    expect(parsed).not.toHaveProperty("category");
    expect(catalog).toMatchObject({
      category: "operations",
      reviewStatus: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
      serviceLineLabel: "IaC delivery baseline",
      pricingMode: ArchitectureRuleCatalogPricingMode.OVERRIDE,
      overrideMinPriceUsd: 450,
      overrideMaxPriceUsd: 650,
      lastReviewedByEmail: "owner@zokorp.com",
    });
    expect(publishedRevision).toMatchObject({
      status: ArchitectureRuleCatalogReviewStatus.PUBLISHED,
      serviceLineLabel: "IaC delivery baseline",
      changedByEmail: "owner@zokorp.com",
    });
  });
});
