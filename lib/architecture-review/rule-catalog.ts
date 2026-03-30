import {
  ArchitectureRuleCatalogPricingMode as PrismaArchitectureRuleCatalogPricingMode,
  ArchitectureRuleCatalogReviewStatus as PrismaArchitectureRuleCatalogReviewStatus,
  Prisma,
} from "@prisma/client";

import type {
  ArchitectureCategory,
  ArchitectureEstimateLineItem,
  ArchitectureEstimateSnapshot,
  ArchitectureReviewReport,
} from "@/lib/architecture-review/types";
import {
  ARCHITECTURE_REVIEW_PRICING_CATALOG,
  getArchitectureReviewPricingCatalogEntry,
  type ArchitectureReviewPricingCatalogEntry,
} from "@/lib/architecture-review/pricing-catalog";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { buildEstimateReferenceCode } from "@/lib/privacy-leads";
import { getSiteUrl } from "@/lib/site";

export const ARCHITECTURE_RULE_CATALOG_FILTERS = [
  "all",
  "needs-review",
  "stale",
  "recently-updated",
] as const;

export type ArchitectureRuleCatalogFilter = (typeof ARCHITECTURE_RULE_CATALOG_FILTERS)[number];
export type ArchitectureRuleCatalogLiveState = "PUBLISHED" | "DRAFT_PENDING" | "NEEDS_REVIEW" | "STALE";

export type ArchitectureRuleCatalogDirectoryEntry = {
  ruleId: string;
  category: string;
  reviewStatus: "UNREVIEWED" | "DRAFT" | "PUBLISHED" | "STALE";
  liveState: ArchitectureRuleCatalogLiveState;
  hasDraftPending: boolean;
  isPresentInCode: boolean;
  serviceLineLabel: string;
  publicFixSummary: string;
  pricingMode: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
  publishedVersion: number | null;
  publishedAt: Date | null;
  updatedAt: Date;
  nextReviewAt: Date | null;
  lastReviewedAt: Date | null;
  lastReviewedByEmail: string | null;
};

export type ArchitectureRuleCatalogDirectory = {
  filter: ArchitectureRuleCatalogFilter;
  q: string;
  entries: ArchitectureRuleCatalogDirectoryEntry[];
  stats: {
    total: number;
    needsReview: number;
    stale: number;
    published: number;
    draftPending: number;
  };
};

export type ArchitectureRuleCatalogRevisionRecord = {
  id: string;
  version: number;
  status: "UNREVIEWED" | "DRAFT" | "PUBLISHED" | "STALE";
  serviceLineLabel: string;
  publicFixSummary: string;
  internalResearchNotes: string;
  pricingMode: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
  nextReviewAt: Date | null;
  changeSummary: string | null;
  changedByEmail: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  effectiveAt: Date | null;
};

export type ArchitectureRuleCatalogDetail = {
  ruleId: string;
  codeEntry: ArchitectureReviewPricingCatalogEntry;
  catalog: {
    reviewStatus: "UNREVIEWED" | "DRAFT" | "PUBLISHED" | "STALE";
    liveState: ArchitectureRuleCatalogLiveState;
    hasDraftPending: boolean;
    isPresentInCode: boolean;
    publishedVersion: number | null;
    publishedAt: Date | null;
    updatedAt: Date;
    nextReviewAt: Date | null;
    lastReviewedAt: Date | null;
    lastReviewedByEmail: string | null;
  };
  formDefaults: {
    serviceLineLabel: string;
    publicFixSummary: string;
    internalResearchNotes: string;
    pricingMode: "DERIVED" | "OVERRIDE";
    overrideMinPriceUsd: string;
    overrideMaxPriceUsd: string;
    nextReviewAt: string;
  };
  effectiveRuntime: {
    source: "published" | "fallback";
    serviceLineLabel: string;
    publicFixSummary: string;
    pricingMode: "DERIVED" | "OVERRIDE";
    overrideMinPriceUsd: number | null;
    overrideMaxPriceUsd: number | null;
    publishedRevisionId: string | null;
  };
  revisions: ArchitectureRuleCatalogRevisionRecord[];
};

export type ArchitectureEstimateAuditUsage = {
  ruleId: string;
  source: "published" | "fallback";
  publishedRevisionId: string | null;
  pricingMode: "DERIVED" | "OVERRIDE";
  amountUsd: number;
};

type PersistedCatalogRecord = {
  id: string;
  ruleId: string;
  category: string;
  isPresentInCode: boolean;
  codeSnapshotJson: unknown;
  reviewStatus: "UNREVIEWED" | "DRAFT" | "PUBLISHED" | "STALE";
  publishedVersion: number | null;
  publishedRevisionId: string | null;
  serviceLineLabel: string | null;
  publicFixSummary: string | null;
  internalResearchNotes: string | null;
  pricingMode: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
  nextReviewAt: Date | null;
  lastReviewedAt: Date | null;
  lastReviewedByEmail: string | null;
  publishedAt: Date | null;
  lastCodeSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type PersistedRevisionRecord = {
  id: string;
  version: number;
  status: "UNREVIEWED" | "DRAFT" | "PUBLISHED" | "STALE";
  serviceLineLabel: string;
  publicFixSummary: string;
  internalResearchNotes: string | null;
  pricingMode: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
  nextReviewAt: Date | null;
  changeSummary: string | null;
  changedByEmail: string | null;
  createdAt: Date;
  publishedAt: Date | null;
  effectiveAt: Date | null;
};

type PublishedCatalogOverride = {
  ruleId: string;
  publishedRevisionId: string | null;
  serviceLineLabel: string | null;
  publicFixSummary: string | null;
  pricingMode: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableStringify(nestedValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeCategory(value: string, fallback: ArchitectureCategory): ArchitectureCategory {
  if (
    value === "operations" ||
    value === "clarity" ||
    value === "security" ||
    value === "reliability" ||
    value === "performance" ||
    value === "cost" ||
    value === "sustainability"
  ) {
    return value;
  }

  return fallback;
}

function defaultBookingUrl() {
  return process.env.ARCH_REVIEW_BOOK_CALL_URL ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? getSiteUrl()}/services#service-request`;
}

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function midpointAmount(low: number, high: number) {
  if (low === high) {
    return low;
  }

  return roundToNearest((low + high) / 2, 25);
}

function roundHours(value: number) {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

function estimatedHoursForFinding(input: {
  category: ArchitectureCategory;
  pointsDeducted: number;
  amountUsd: number;
}) {
  const categoryMultiplier: Record<ArchitectureCategory, number> = {
    clarity: 0.3,
    operations: 0.4,
    performance: 0.45,
    cost: 0.4,
    sustainability: 0.25,
    reliability: 0.55,
    security: 0.6,
  };

  const pointsComponent = input.pointsDeducted * categoryMultiplier[input.category];
  const amountComponent = input.amountUsd / 300;
  return roundHours(pointsComponent + amountComponent);
}

function formatDateInputValue(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function parseDateInputValue(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function effectiveServiceLineLabel(input: {
  codeEntry: ArchitectureReviewPricingCatalogEntry;
  serviceLineLabel?: string | null;
}) {
  return normalizeText(input.serviceLineLabel) || input.codeEntry.serviceLine;
}

function effectivePublicFixSummary(input: {
  codeEntry: ArchitectureReviewPricingCatalogEntry;
  publicFixSummary?: string | null;
}) {
  return normalizeText(input.publicFixSummary) || input.codeEntry.triggerSummary;
}

function effectiveInternalResearchNotes(input: {
  codeEntry: ArchitectureReviewPricingCatalogEntry;
  internalResearchNotes?: string | null;
}) {
  return normalizeText(input.internalResearchNotes) || normalizeText(input.codeEntry.pricingNotes);
}

function serializeEditableSnapshot(input: {
  ruleId: string;
  serviceLineLabel: string;
  publicFixSummary: string;
  internalResearchNotes: string;
  pricingMode: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
  nextReviewAt: Date | null;
}) {
  return {
    ruleId: input.ruleId,
    serviceLineLabel: input.serviceLineLabel,
    publicFixSummary: input.publicFixSummary,
    internalResearchNotes: input.internalResearchNotes,
    pricingMode: input.pricingMode,
    overrideMinPriceUsd: input.overrideMinPriceUsd,
    overrideMaxPriceUsd: input.overrideMaxPriceUsd,
    nextReviewAtISO: input.nextReviewAt?.toISOString() ?? null,
  };
}

function nextVersionNumber(revisions: PersistedRevisionRecord[]) {
  const latest = revisions.reduce((maxVersion, revision) => Math.max(maxVersion, revision.version), 0);
  return latest + 1;
}

function normalizeOverrideAmount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

function runtimeSourceForRow(row: PersistedCatalogRecord | null) {
  if (row && row.publishedRevisionId && row.reviewStatus !== "STALE" && row.isPresentInCode) {
    return "published" as const;
  }

  return "fallback" as const;
}

function hasDraftPendingForRow(row: PersistedCatalogRecord) {
  return row.reviewStatus === "DRAFT" && row.publishedRevisionId !== null && row.isPresentInCode;
}

function liveStateForRow(row: PersistedCatalogRecord): ArchitectureRuleCatalogLiveState {
  if (!row.isPresentInCode || row.reviewStatus === "STALE") {
    return "STALE";
  }

  if (hasDraftPendingForRow(row)) {
    return "DRAFT_PENDING";
  }

  if (row.publishedRevisionId) {
    return "PUBLISHED";
  }

  return "NEEDS_REVIEW";
}

function buildDirectoryEntry(row: PersistedCatalogRecord, codeEntry: ArchitectureReviewPricingCatalogEntry) {
  return {
    ruleId: row.ruleId,
    category: row.category,
    reviewStatus: row.reviewStatus,
    liveState: liveStateForRow(row),
    hasDraftPending: hasDraftPendingForRow(row),
    isPresentInCode: row.isPresentInCode,
    serviceLineLabel: effectiveServiceLineLabel({
      codeEntry,
      serviceLineLabel: row.serviceLineLabel,
    }),
    publicFixSummary: effectivePublicFixSummary({
      codeEntry,
      publicFixSummary: row.publicFixSummary,
    }),
    pricingMode: row.pricingMode,
    overrideMinPriceUsd: row.overrideMinPriceUsd,
    overrideMaxPriceUsd: row.overrideMaxPriceUsd,
    publishedVersion: row.publishedVersion,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    nextReviewAt: row.nextReviewAt,
    lastReviewedAt: row.lastReviewedAt,
    lastReviewedByEmail: row.lastReviewedByEmail,
  } satisfies ArchitectureRuleCatalogDirectoryEntry;
}

function matchDirectoryFilter(entry: ArchitectureRuleCatalogDirectoryEntry, filter: ArchitectureRuleCatalogFilter) {
  if (filter === "needs-review") {
    return entry.liveState === "NEEDS_REVIEW" || entry.liveState === "DRAFT_PENDING";
  }

  if (filter === "stale") {
    return entry.liveState === "STALE";
  }

  if (filter === "recently-updated") {
    return entry.updatedAt.getTime() >= Date.now() - 14 * 24 * 60 * 60 * 1000;
  }

  return true;
}

function matchSearch(entry: ArchitectureRuleCatalogDirectoryEntry, q: string) {
  if (!q) {
    return true;
  }

  const haystack = [
    entry.ruleId,
    entry.category,
    entry.serviceLineLabel,
    entry.publicFixSummary,
    entry.lastReviewedByEmail ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q.toLowerCase());
}

function codeSnapshotForEntry(entry: ArchitectureReviewPricingCatalogEntry) {
  return JSON.parse(JSON.stringify(entry)) as Prisma.InputJsonValue;
}

function codeEntryFromSnapshot(
  ruleId: string,
  category: string,
  snapshot: unknown,
): ArchitectureReviewPricingCatalogEntry {
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    const value = snapshot as Record<string, unknown>;

    return {
      ruleId: typeof value.ruleId === "string" ? value.ruleId : ruleId,
      category: normalizeCategory(typeof value.category === "string" ? value.category : category, "clarity"),
      serviceLine: typeof value.serviceLine === "string" ? value.serviceLine : "Archived rule",
      triggerSummary:
        typeof value.triggerSummary === "string"
          ? value.triggerSummary
          : "This rule is no longer present in code. Review the last saved pricing before reusing it.",
      pointsSummary: typeof value.pointsSummary === "string" ? value.pointsSummary : "Archived code snapshot",
      minPointsDeducted: typeof value.minPointsDeducted === "number" ? value.minPointsDeducted : 0,
      maxPointsDeducted: typeof value.maxPointsDeducted === "number" ? value.maxPointsDeducted : 0,
      minFixCostUSD: typeof value.minFixCostUSD === "number" ? value.minFixCostUSD : 0,
      maxFixCostUSD: typeof value.maxFixCostUSD === "number" ? value.maxFixCostUSD : 0,
      quoteImpact:
        value.quoteImpact === "review-rejected" || value.quoteImpact === "zero-cost-optional"
          ? value.quoteImpact
          : "included",
      pricingNotes: typeof value.pricingNotes === "string" ? value.pricingNotes : undefined,
    };
  }

  return {
    ruleId,
    category: normalizeCategory(category, "clarity"),
    serviceLine: "Archived rule",
    triggerSummary: "This rule is no longer present in code. Review it before trusting historical pricing.",
    pointsSummary: "Archived code snapshot",
    minPointsDeducted: 0,
    maxPointsDeducted: 0,
    minFixCostUSD: 0,
    maxFixCostUSD: 0,
    quoteImpact: "included",
  };
}

function quoteAmountForFinding(input: {
  lineItem: ArchitectureEstimateLineItem;
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
  pricingMode: "DERIVED" | "OVERRIDE";
}) {
  if (input.pricingMode !== "OVERRIDE") {
    return input.lineItem.amountUsd;
  }

  const low = normalizeOverrideAmount(input.overrideMinPriceUsd);
  const high = normalizeOverrideAmount(input.overrideMaxPriceUsd);

  if (low !== null && high !== null) {
    return midpointAmount(Math.min(low, high), Math.max(low, high));
  }

  if (low !== null) {
    return low;
  }

  if (high !== null) {
    return high;
  }

  return input.lineItem.amountUsd;
}

async function fetchCatalogRows() {
  return db.architectureRuleCatalog.findMany({
    orderBy: [{ category: "asc" }, { ruleId: "asc" }],
    select: {
      id: true,
      ruleId: true,
      category: true,
      isPresentInCode: true,
      codeSnapshotJson: true,
      reviewStatus: true,
      publishedVersion: true,
      publishedRevisionId: true,
      serviceLineLabel: true,
      publicFixSummary: true,
      internalResearchNotes: true,
      pricingMode: true,
      overrideMinPriceUsd: true,
      overrideMaxPriceUsd: true,
      nextReviewAt: true,
      lastReviewedAt: true,
      lastReviewedByEmail: true,
      publishedAt: true,
      lastCodeSyncedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function fetchCatalogDetailRow(ruleId: string) {
  return db.architectureRuleCatalog.findUnique({
    where: { ruleId },
    select: {
      id: true,
      ruleId: true,
      category: true,
      isPresentInCode: true,
      codeSnapshotJson: true,
      reviewStatus: true,
      publishedVersion: true,
      publishedRevisionId: true,
      serviceLineLabel: true,
      publicFixSummary: true,
      internalResearchNotes: true,
      pricingMode: true,
      overrideMinPriceUsd: true,
      overrideMaxPriceUsd: true,
      nextReviewAt: true,
      lastReviewedAt: true,
      lastReviewedByEmail: true,
      publishedAt: true,
      lastCodeSyncedAt: true,
      createdAt: true,
      updatedAt: true,
      revisions: {
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          version: true,
          status: true,
          serviceLineLabel: true,
          publicFixSummary: true,
          internalResearchNotes: true,
          pricingMode: true,
          overrideMinPriceUsd: true,
          overrideMaxPriceUsd: true,
          nextReviewAt: true,
          changeSummary: true,
          changedByEmail: true,
          createdAt: true,
          publishedAt: true,
          effectiveAt: true,
        },
      },
    },
  });
}

async function fetchPublishedOverrides(ruleIds: string[]) {
  if (ruleIds.length === 0) {
    return new Map<string, PublishedCatalogOverride>();
  }

  try {
    const rows = await db.architectureRuleCatalog.findMany({
      where: {
        ruleId: { in: ruleIds },
        isPresentInCode: true,
      },
      select: {
        ruleId: true,
        reviewStatus: true,
        publishedRevisionId: true,
        serviceLineLabel: true,
        publicFixSummary: true,
        pricingMode: true,
        overrideMinPriceUsd: true,
        overrideMaxPriceUsd: true,
      },
    });

    return new Map(
      rows
        .filter(
          (row) =>
            row.publishedRevisionId !== null &&
            row.reviewStatus !== PrismaArchitectureRuleCatalogReviewStatus.STALE,
        )
        .map((row) => [row.ruleId, row]),
    );
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return new Map<string, PublishedCatalogOverride>();
    }

    throw error;
  }
}

export function buildFallbackArchitectureEstimateSnapshot(
  report: ArchitectureReviewReport,
  options?: {
    bookingUrl?: string;
  },
) {
  return buildArchitectureEstimateSnapshot(report, new Map<string, PublishedCatalogOverride>(), options);
}

function buildArchitectureEstimateSnapshot(
  report: ArchitectureReviewReport,
  publishedOverrides: Map<string, PublishedCatalogOverride>,
  options?: {
    bookingUrl?: string;
  },
) {
  const bookingUrl = options?.bookingUrl ?? defaultBookingUrl();
  const positiveFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);

  const lineItems = positiveFindings.map((finding) => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry(finding.ruleId);
    const publishedOverride = publishedOverrides.get(finding.ruleId);
    const baseLineItem: ArchitectureEstimateLineItem = {
      ruleId: finding.ruleId,
      category: finding.category,
      pointsDeducted: finding.pointsDeducted,
      serviceLineLabel:
        normalizeText(publishedOverride?.serviceLineLabel) ||
        codeEntry?.serviceLine ||
        `Fix ${finding.ruleId}`,
      publicFixSummary:
        normalizeText(publishedOverride?.publicFixSummary) ||
        finding.fix,
      amountUsd: finding.fixCostUSD,
      estimatedHours: estimatedHoursForFinding({
        category: finding.category,
        pointsDeducted: finding.pointsDeducted,
        amountUsd: finding.fixCostUSD,
      }),
      source: publishedOverride ? "published" : "fallback",
      publishedRevisionId: publishedOverride?.publishedRevisionId ?? null,
    };

    return {
      ...baseLineItem,
      amountUsd: quoteAmountForFinding({
        lineItem: baseLineItem,
        overrideMinPriceUsd: publishedOverride?.overrideMinPriceUsd ?? null,
        overrideMaxPriceUsd: publishedOverride?.overrideMaxPriceUsd ?? null,
        pricingMode: publishedOverride?.pricingMode ?? "DERIVED",
      }),
      estimatedHours: estimatedHoursForFinding({
        category: finding.category,
        pointsDeducted: finding.pointsDeducted,
        amountUsd: quoteAmountForFinding({
          lineItem: baseLineItem,
          overrideMinPriceUsd: publishedOverride?.overrideMinPriceUsd ?? null,
          overrideMaxPriceUsd: publishedOverride?.overrideMaxPriceUsd ?? null,
          pricingMode: publishedOverride?.pricingMode ?? "DERIVED",
        }),
      }),
    };
  });

  const totalUsd = lineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  const assumptions = [
    "Estimated only for the issues visible in the submitted diagram and written narrative.",
    report.analysisConfidence === "low"
      ? "Because the evidence confidence was low, the estimate assumes no hidden dependencies outside the submitted material."
      : "The estimate assumes the current architecture can be corrected without a broader redesign.",
    "Work is scoped for a solo implementation pass and one review cycle unless expanded during the booking conversation.",
  ];
  const exclusions = [
    "New requirements, migrations, application code changes, and vendor procurement are excluded from this estimate.",
    "Issues not visible in the submitted diagram or uncovered later are outside this estimated total.",
    "Ongoing support, managed operations, and subscription work are not included unless separately agreed.",
  ];

  const snapshot: ArchitectureEstimateSnapshot = {
    referenceCode: buildEstimateReferenceCode({
      source: "architecture-review",
      email: report.userEmail,
      generatedAtISO: report.generatedAtISO,
    }),
    bookingUrl,
    totalUsd,
    lineItems,
    assumptions,
    exclusions,
  };

  const auditUsage: ArchitectureEstimateAuditUsage[] = lineItems.map((item) => ({
    ruleId: item.ruleId,
    source: item.source,
    publishedRevisionId: item.publishedRevisionId ?? null,
    pricingMode: publishedOverrides.get(item.ruleId)?.pricingMode ?? "DERIVED",
    amountUsd: item.amountUsd,
  }));

  return {
    snapshot,
    auditUsage,
  };
}

export async function loadArchitectureEstimateSnapshot(
  report: ArchitectureReviewReport,
  options?: {
    bookingUrl?: string;
  },
) {
  const publishedOverrides = await fetchPublishedOverrides(
    report.findings.filter((finding) => finding.pointsDeducted > 0).map((finding) => finding.ruleId),
  );

  return buildArchitectureEstimateSnapshot(report, publishedOverrides, options);
}

export async function syncArchitectureRuleCatalog() {
  const codeEntries = new Map(
    ARCHITECTURE_REVIEW_PRICING_CATALOG.map((entry) => [entry.ruleId, entry]),
  );

  try {
    const existingRows = await fetchCatalogRows();
    const existingByRuleId = new Map(existingRows.map((row) => [row.ruleId, row]));
    let created = 0;
    let markedStale = 0;
    let refreshed = 0;

    for (const codeEntry of ARCHITECTURE_REVIEW_PRICING_CATALOG) {
      const snapshot = codeSnapshotForEntry(codeEntry);
      const existing = existingByRuleId.get(codeEntry.ruleId);

      if (!existing) {
        await db.architectureRuleCatalog.create({
          data: {
            ruleId: codeEntry.ruleId,
            category: codeEntry.category,
            isPresentInCode: true,
            codeSnapshotJson: snapshot,
            reviewStatus: PrismaArchitectureRuleCatalogReviewStatus.UNREVIEWED,
          },
        });
        created += 1;
        continue;
      }

      const codeChanged = stableStringify(existing.codeSnapshotJson) !== stableStringify(snapshot);
      const nextReviewStatus =
        !existing.isPresentInCode || codeChanged
          ? existing.publishedVersion
            ? PrismaArchitectureRuleCatalogReviewStatus.STALE
            : existing.reviewStatus === PrismaArchitectureRuleCatalogReviewStatus.DRAFT
              ? PrismaArchitectureRuleCatalogReviewStatus.DRAFT
              : PrismaArchitectureRuleCatalogReviewStatus.UNREVIEWED
          : existing.reviewStatus;

      await db.architectureRuleCatalog.update({
        where: { id: existing.id },
        data: {
          category: codeEntry.category,
          isPresentInCode: true,
          codeSnapshotJson: snapshot,
          reviewStatus: nextReviewStatus,
          lastCodeSyncedAt: new Date(),
        },
      });

      if (codeChanged || !existing.isPresentInCode) {
        if (existing.publishedVersion) {
          markedStale += 1;
        } else {
          refreshed += 1;
        }
      }
    }

    for (const existing of existingRows) {
      if (codeEntries.has(existing.ruleId)) {
        continue;
      }

      await db.architectureRuleCatalog.update({
        where: { id: existing.id },
        data: {
          isPresentInCode: false,
          reviewStatus: PrismaArchitectureRuleCatalogReviewStatus.STALE,
          lastCodeSyncedAt: new Date(),
        },
      });
      markedStale += 1;
    }

    return {
      created,
      markedStale,
      refreshed,
    };
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return {
        created: 0,
        markedStale: 0,
        refreshed: 0,
      };
    }

    throw error;
  }
}

export async function getArchitectureRuleCatalogDirectory(input?: {
  filter?: string | null;
  q?: string | null;
}) {
  await syncArchitectureRuleCatalog();

  const requestedFilter = normalizeText(input?.filter).toLowerCase();
  const filter = (
    ARCHITECTURE_RULE_CATALOG_FILTERS.find((value) => value === requestedFilter) ?? "all"
  ) satisfies ArchitectureRuleCatalogFilter;
  const q = normalizeText(input?.q);

  try {
    const rows = await fetchCatalogRows();
    const entries = rows
      .map((row) => {
        const codeEntry =
          getArchitectureReviewPricingCatalogEntry(row.ruleId) ??
          codeEntryFromSnapshot(row.ruleId, row.category, row.codeSnapshotJson);

        return buildDirectoryEntry(row, codeEntry);
      })
      .filter((entry) => matchDirectoryFilter(entry, filter))
      .filter((entry) => matchSearch(entry, q))
      .sort((left, right) => {
        const statusWeight = (state: ArchitectureRuleCatalogDirectoryEntry["liveState"]) => {
          if (state === "STALE") {
            return 0;
          }

          if (state === "NEEDS_REVIEW") {
            return 1;
          }

          if (state === "DRAFT_PENDING") {
            return 2;
          }

          return 3;
        };

        const weightDelta = statusWeight(left.liveState) - statusWeight(right.liveState);
        if (weightDelta !== 0) {
          return weightDelta;
        }

        return left.ruleId.localeCompare(right.ruleId);
      });

    return {
      filter,
      q,
      entries,
      stats: {
        total: rows.length,
        needsReview: rows.filter((row) => liveStateForRow(row) === "NEEDS_REVIEW").length,
        stale: rows.filter((row) => liveStateForRow(row) === "STALE").length,
        published: rows.filter((row) => liveStateForRow(row) === "PUBLISHED").length,
        draftPending: rows.filter((row) => liveStateForRow(row) === "DRAFT_PENDING").length,
      },
    } satisfies ArchitectureRuleCatalogDirectory;
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return {
        filter,
        q,
        entries: [],
        stats: {
          total: 0,
          needsReview: 0,
          stale: 0,
          published: 0,
          draftPending: 0,
        },
      } satisfies ArchitectureRuleCatalogDirectory;
    }

    throw error;
  }
}

function buildFormDefaults(input: {
  codeEntry: ArchitectureReviewPricingCatalogEntry;
  catalog: PersistedCatalogRecord;
  latestDraft: PersistedRevisionRecord | null;
}) {
  const source = input.latestDraft ?? input.catalog;
  return {
    serviceLineLabel: normalizeText(source.serviceLineLabel) || input.codeEntry.serviceLine,
    publicFixSummary:
      normalizeText(source.publicFixSummary) || effectivePublicFixSummary({ codeEntry: input.codeEntry }),
    internalResearchNotes:
      normalizeText(source.internalResearchNotes) || effectiveInternalResearchNotes({ codeEntry: input.codeEntry }),
    pricingMode: source.pricingMode,
    overrideMinPriceUsd:
      source.overrideMinPriceUsd === null || source.overrideMinPriceUsd === undefined
        ? ""
        : String(source.overrideMinPriceUsd),
    overrideMaxPriceUsd:
      source.overrideMaxPriceUsd === null || source.overrideMaxPriceUsd === undefined
        ? ""
        : String(source.overrideMaxPriceUsd),
    nextReviewAt: formatDateInputValue(source.nextReviewAt),
  };
}

function buildRuntimePreview(input: {
  codeEntry: ArchitectureReviewPricingCatalogEntry;
  catalog: PersistedCatalogRecord;
}) {
  if (runtimeSourceForRow(input.catalog) === "published") {
    return {
      source: "published" as const,
      serviceLineLabel: effectiveServiceLineLabel({
        codeEntry: input.codeEntry,
        serviceLineLabel: input.catalog.serviceLineLabel,
      }),
      publicFixSummary: effectivePublicFixSummary({
        codeEntry: input.codeEntry,
        publicFixSummary: input.catalog.publicFixSummary,
      }),
      pricingMode: input.catalog.pricingMode,
      overrideMinPriceUsd: input.catalog.overrideMinPriceUsd,
      overrideMaxPriceUsd: input.catalog.overrideMaxPriceUsd,
      publishedRevisionId: input.catalog.publishedRevisionId,
    };
  }

  return {
    source: "fallback" as const,
    serviceLineLabel: input.codeEntry.serviceLine,
    publicFixSummary: effectivePublicFixSummary({ codeEntry: input.codeEntry }),
    pricingMode: "DERIVED" as const,
    overrideMinPriceUsd: null,
    overrideMaxPriceUsd: null,
    publishedRevisionId: null,
  };
}

export async function getArchitectureRuleCatalogDetail(ruleId: string) {
  await syncArchitectureRuleCatalog();

  try {
    const catalog = await fetchCatalogDetailRow(ruleId);
    if (!catalog) {
      return null;
    }

    const codeEntry =
      getArchitectureReviewPricingCatalogEntry(ruleId) ??
      codeEntryFromSnapshot(catalog.ruleId, catalog.category, catalog.codeSnapshotJson);

    const latestDraft =
      catalog.revisions.find((revision) => revision.status === PrismaArchitectureRuleCatalogReviewStatus.DRAFT) ?? null;

    return {
      ruleId,
      codeEntry,
      catalog: {
        reviewStatus: catalog.reviewStatus,
        liveState: liveStateForRow(catalog),
        hasDraftPending: hasDraftPendingForRow(catalog),
        isPresentInCode: catalog.isPresentInCode,
        publishedVersion: catalog.publishedVersion,
        publishedAt: catalog.publishedAt,
        updatedAt: catalog.updatedAt,
        nextReviewAt: catalog.nextReviewAt,
        lastReviewedAt: catalog.lastReviewedAt,
        lastReviewedByEmail: catalog.lastReviewedByEmail,
      },
      formDefaults: buildFormDefaults({
        codeEntry,
        catalog,
        latestDraft,
      }),
      effectiveRuntime: buildRuntimePreview({
        codeEntry,
        catalog,
      }),
      revisions: catalog.revisions.map((revision) => ({
        id: revision.id,
        version: revision.version,
        status: revision.status,
        serviceLineLabel: revision.serviceLineLabel,
        publicFixSummary: revision.publicFixSummary,
        internalResearchNotes: normalizeText(revision.internalResearchNotes),
        pricingMode: revision.pricingMode,
        overrideMinPriceUsd: revision.overrideMinPriceUsd,
        overrideMaxPriceUsd: revision.overrideMaxPriceUsd,
        nextReviewAt: revision.nextReviewAt,
        changeSummary: revision.changeSummary,
        changedByEmail: revision.changedByEmail,
        createdAt: revision.createdAt,
        publishedAt: revision.publishedAt,
        effectiveAt: revision.effectiveAt,
      })),
    } satisfies ArchitectureRuleCatalogDetail;
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return null;
    }

    throw error;
  }
}

type EditableCatalogInput = {
  ruleId: string;
  serviceLineLabel?: string | null;
  publicFixSummary?: string | null;
  internalResearchNotes?: string | null;
  pricingMode?: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd?: number | null;
  overrideMaxPriceUsd?: number | null;
  nextReviewAt?: Date | null;
  changeSummary?: string | null;
  changedByEmail?: string | null;
};

async function ensureCatalogWithRevisions(ruleId: string) {
  await syncArchitectureRuleCatalog();

  const catalog = await db.architectureRuleCatalog.findUnique({
    where: { ruleId },
    select: {
      id: true,
      ruleId: true,
      category: true,
      isPresentInCode: true,
      codeSnapshotJson: true,
      reviewStatus: true,
      publishedVersion: true,
      publishedRevisionId: true,
      serviceLineLabel: true,
      publicFixSummary: true,
      internalResearchNotes: true,
      pricingMode: true,
      overrideMinPriceUsd: true,
      overrideMaxPriceUsd: true,
      nextReviewAt: true,
      lastReviewedAt: true,
      lastReviewedByEmail: true,
      publishedAt: true,
      lastCodeSyncedAt: true,
      createdAt: true,
      updatedAt: true,
      revisions: {
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          version: true,
          status: true,
          serviceLineLabel: true,
          publicFixSummary: true,
          internalResearchNotes: true,
          pricingMode: true,
          overrideMinPriceUsd: true,
          overrideMaxPriceUsd: true,
          nextReviewAt: true,
          changeSummary: true,
          changedByEmail: true,
          createdAt: true,
          publishedAt: true,
          effectiveAt: true,
        },
      },
    },
  });

  if (!catalog) {
    throw new Error("Architecture rule catalog entry not found");
  }

  const codeEntry =
    getArchitectureReviewPricingCatalogEntry(ruleId) ??
    codeEntryFromSnapshot(catalog.ruleId, catalog.category, catalog.codeSnapshotJson);

  return {
    catalog,
    codeEntry,
  };
}

function buildNormalizedEditableInput(
  input: EditableCatalogInput,
  current: {
    catalog: PersistedCatalogRecord;
    revisions: PersistedRevisionRecord[];
    codeEntry: ArchitectureReviewPricingCatalogEntry;
  },
) {
  const latestDraft =
    current.revisions.find((revision) => revision.status === PrismaArchitectureRuleCatalogReviewStatus.DRAFT) ?? null;
  const draftLikeSource = latestDraft ?? current.catalog;

  const pricingMode = input.pricingMode ?? draftLikeSource.pricingMode;
  const serviceLineLabel =
    normalizeText(input.serviceLineLabel) ||
    normalizeText(draftLikeSource.serviceLineLabel) ||
    current.codeEntry.serviceLine;
  const publicFixSummary =
    normalizeText(input.publicFixSummary) ||
    normalizeText(draftLikeSource.publicFixSummary) ||
    effectivePublicFixSummary({ codeEntry: current.codeEntry });
  const internalResearchNotes =
    normalizeText(input.internalResearchNotes) ||
    normalizeText(draftLikeSource.internalResearchNotes) ||
    effectiveInternalResearchNotes({ codeEntry: current.codeEntry });
  const overrideMinPriceUsd =
    input.overrideMinPriceUsd !== undefined
      ? normalizeOverrideAmount(input.overrideMinPriceUsd)
      : draftLikeSource.overrideMinPriceUsd;
  const overrideMaxPriceUsd =
    input.overrideMaxPriceUsd !== undefined
      ? normalizeOverrideAmount(input.overrideMaxPriceUsd)
      : draftLikeSource.overrideMaxPriceUsd;
  const nextReviewAt = input.nextReviewAt !== undefined ? input.nextReviewAt : draftLikeSource.nextReviewAt;

  return {
    serviceLineLabel,
    publicFixSummary,
    internalResearchNotes,
    pricingMode,
    overrideMinPriceUsd,
    overrideMaxPriceUsd,
    nextReviewAt,
    changeSummary: normalizeOptionalText(input.changeSummary),
    changedByEmail: normalizeOptionalText(input.changedByEmail),
  };
}

export async function saveArchitectureRuleCatalogDraft(input: EditableCatalogInput) {
  const { catalog, codeEntry } = await ensureCatalogWithRevisions(input.ruleId);
  const normalized = buildNormalizedEditableInput(input, {
    catalog,
    revisions: catalog.revisions,
    codeEntry,
  });
  const version = nextVersionNumber(catalog.revisions);

  const snapshotJson = serializeEditableSnapshot({
    ruleId: input.ruleId,
    serviceLineLabel: normalized.serviceLineLabel,
    publicFixSummary: normalized.publicFixSummary,
    internalResearchNotes: normalized.internalResearchNotes,
    pricingMode: normalized.pricingMode,
    overrideMinPriceUsd: normalized.overrideMinPriceUsd ?? null,
    overrideMaxPriceUsd: normalized.overrideMaxPriceUsd ?? null,
    nextReviewAt: normalized.nextReviewAt ?? null,
  });

  const revision = await db.architectureRuleCatalogRevision.create({
    data: {
      catalogId: catalog.id,
      version,
      status: PrismaArchitectureRuleCatalogReviewStatus.DRAFT,
      serviceLineLabel: normalized.serviceLineLabel,
      publicFixSummary: normalized.publicFixSummary,
      internalResearchNotes: normalizeOptionalText(normalized.internalResearchNotes),
      pricingMode:
        normalized.pricingMode === "OVERRIDE"
          ? PrismaArchitectureRuleCatalogPricingMode.OVERRIDE
          : PrismaArchitectureRuleCatalogPricingMode.DERIVED,
      overrideMinPriceUsd: normalized.overrideMinPriceUsd ?? null,
      overrideMaxPriceUsd: normalized.overrideMaxPriceUsd ?? null,
      nextReviewAt: normalized.nextReviewAt ?? null,
      changeSummary: normalized.changeSummary,
      changedByEmail: normalized.changedByEmail,
      snapshotJson,
    },
  });

  await db.architectureRuleCatalog.update({
    where: { id: catalog.id },
    data: {
      reviewStatus: PrismaArchitectureRuleCatalogReviewStatus.DRAFT,
      nextReviewAt: normalized.nextReviewAt ?? null,
    },
  });

  return revision;
}

export async function publishArchitectureRuleCatalog(input: EditableCatalogInput) {
  const { catalog, codeEntry } = await ensureCatalogWithRevisions(input.ruleId);
  const normalized = buildNormalizedEditableInput(input, {
    catalog,
    revisions: catalog.revisions,
    codeEntry,
  });
  const version = nextVersionNumber(catalog.revisions);
  const now = new Date();

  const snapshotJson = serializeEditableSnapshot({
    ruleId: input.ruleId,
    serviceLineLabel: normalized.serviceLineLabel,
    publicFixSummary: normalized.publicFixSummary,
    internalResearchNotes: normalized.internalResearchNotes,
    pricingMode: normalized.pricingMode,
    overrideMinPriceUsd: normalized.overrideMinPriceUsd ?? null,
    overrideMaxPriceUsd: normalized.overrideMaxPriceUsd ?? null,
    nextReviewAt: normalized.nextReviewAt ?? null,
  });

  const revision = await db.architectureRuleCatalogRevision.create({
    data: {
      catalogId: catalog.id,
      version,
      status: PrismaArchitectureRuleCatalogReviewStatus.PUBLISHED,
      serviceLineLabel: normalized.serviceLineLabel,
      publicFixSummary: normalized.publicFixSummary,
      internalResearchNotes: normalizeOptionalText(normalized.internalResearchNotes),
      pricingMode:
        normalized.pricingMode === "OVERRIDE"
          ? PrismaArchitectureRuleCatalogPricingMode.OVERRIDE
          : PrismaArchitectureRuleCatalogPricingMode.DERIVED,
      overrideMinPriceUsd: normalized.overrideMinPriceUsd ?? null,
      overrideMaxPriceUsd: normalized.overrideMaxPriceUsd ?? null,
      nextReviewAt: normalized.nextReviewAt ?? null,
      changeSummary: normalized.changeSummary,
      changedByEmail: normalized.changedByEmail,
      publishedAt: now,
      effectiveAt: now,
      snapshotJson,
    },
  });

  await db.architectureRuleCatalog.update({
    where: { id: catalog.id },
    data: {
      reviewStatus: PrismaArchitectureRuleCatalogReviewStatus.PUBLISHED,
      publishedVersion: version,
      publishedRevisionId: revision.id,
      serviceLineLabel: normalized.serviceLineLabel,
      publicFixSummary: normalized.publicFixSummary,
      internalResearchNotes: normalizeOptionalText(normalized.internalResearchNotes),
      pricingMode:
        normalized.pricingMode === "OVERRIDE"
          ? PrismaArchitectureRuleCatalogPricingMode.OVERRIDE
          : PrismaArchitectureRuleCatalogPricingMode.DERIVED,
      overrideMinPriceUsd: normalized.overrideMinPriceUsd ?? null,
      overrideMaxPriceUsd: normalized.overrideMaxPriceUsd ?? null,
      nextReviewAt: normalized.nextReviewAt ?? null,
      publishedAt: now,
      lastReviewedAt: now,
      lastReviewedByEmail: normalized.changedByEmail,
    },
  });

  return revision;
}

export function parseArchitectureRuleCatalogFormInput(formData: FormData) {
  const ruleId = normalizeText(String(formData.get("ruleId") ?? ""));
  if (!ruleId) {
    throw new Error("Missing rule id");
  }

  const pricingModeRaw = normalizeText(String(formData.get("pricingMode") ?? "DERIVED")).toUpperCase();
  const pricingMode = pricingModeRaw === "OVERRIDE" ? "OVERRIDE" : "DERIVED";
  const parseAmount = (fieldName: string) => {
    const raw = normalizeText(String(formData.get(fieldName) ?? ""));
    if (!raw) {
      return null;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Invalid ${fieldName}`);
    }

    return parsed;
  };

  return {
    ruleId,
    serviceLineLabel: String(formData.get("serviceLineLabel") ?? ""),
    publicFixSummary: String(formData.get("publicFixSummary") ?? ""),
    internalResearchNotes: String(formData.get("internalResearchNotes") ?? ""),
    pricingMode,
    overrideMinPriceUsd: parseAmount("overrideMinPriceUsd"),
    overrideMaxPriceUsd: parseAmount("overrideMaxPriceUsd"),
    nextReviewAt: parseDateInputValue(String(formData.get("nextReviewAt") ?? "")),
    changeSummary: String(formData.get("changeSummary") ?? ""),
  } satisfies EditableCatalogInput;
}
