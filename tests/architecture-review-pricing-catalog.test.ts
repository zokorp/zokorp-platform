import { describe, expect, it } from "vitest";

import {
  ARCHITECTURE_REVIEW_PACKAGE_CATALOG,
  ARCHITECTURE_REVIEW_PRICING_CATALOG,
  getArchitectureReviewPricingCatalogEntry,
} from "@/lib/architecture-review/pricing-catalog";

describe("architecture review pricing catalog", () => {
  it("covers the current deterministic finding catalog without duplicate rule ids", () => {
    const ruleIds = ARCHITECTURE_REVIEW_PRICING_CATALOG.map((entry) => entry.ruleId);
    expect(new Set(ruleIds).size).toBe(ruleIds.length);

    expect(ruleIds).toEqual([
      "MSFT-META-TITLE",
      "MSFT-META-OWNER",
      "MSFT-META-LAST-UPDATED",
      "MSFT-META-VERSION",
      "PILLAR-SECURITY",
      "PILLAR-RELIABILITY",
      "PILLAR-OPERATIONS",
      "PILLAR-PERFORMANCE",
      "PILLAR-COST",
      "PILLAR-SECURITY-DEPTH",
      "PILLAR-RELIABILITY-DEPTH",
      "PILLAR-OPERATIONS-DEPTH",
      "PILLAR-SUSTAINABILITY-OPTIONAL",
      "CLAR-OFFICIAL-REFERENCE-PATTERN",
      "INPUT-NOT-ARCH-DIAGRAM",
      "INPUT-NON-ARCH-SUSPECT",
      "INPUT-PARAGRAPH-QUALITY",
      "AWS-PROVIDER-MISMATCH",
      "AZURE-PROVIDER-MISMATCH",
      "GCP-PROVIDER-MISMATCH",
      "MSFT-FLOW-DIRECTION",
      "CLAR-UNIDIR-RELATIONSHIPS",
      "MSFT-COMPONENT-LABEL-COVERAGE",
      "CLAR-BOUNDARY-EXPLICIT",
      "CLAR-REL-LABELS-MISSING",
      "CLAR-REGION-ZONE-MISSING",
      "CLAR-STALE-DIAGRAM",
      "MSFT-LEGEND-SEMANTICS",
      "MSFT-LAYERING-DENSITY",
      "MSFT-LAYERING-OPTIONAL",
      "REL-RTO-RPO-MISSING",
      "REL-BACKUP-RESTORE",
      "SEC-BASELINE-MISSING",
      "CLAR-DATA-CLASS-MISSING",
    ]);
  });

  it("captures variable pricing bands for range-based findings", () => {
    const coverageEntry = getArchitectureReviewPricingCatalogEntry("MSFT-COMPONENT-LABEL-COVERAGE");
    const staleEntry = getArchitectureReviewPricingCatalogEntry("CLAR-STALE-DIAGRAM");

    expect(coverageEntry).toMatchObject({
      minPointsDeducted: 4,
      maxPointsDeducted: 12,
      minFixCostUSD: 33,
      maxFixCostUSD: 54,
    });

    expect(staleEntry).toMatchObject({
      minPointsDeducted: 2,
      maxPointsDeducted: 6,
      minFixCostUSD: 28,
      maxFixCostUSD: 38,
    });
  });

  it("marks non-priced recommendations and rejection-only rules correctly", () => {
    expect(getArchitectureReviewPricingCatalogEntry("PILLAR-SUSTAINABILITY-OPTIONAL")).toMatchObject({
      quoteImpact: "zero-cost-optional",
      minFixCostUSD: 0,
      maxFixCostUSD: 0,
    });

    expect(getArchitectureReviewPricingCatalogEntry("INPUT-NOT-ARCH-DIAGRAM")).toMatchObject({
      quoteImpact: "review-rejected",
      pricingNotes: expect.stringContaining("No quote should be sent"),
    });
  });

  it("documents the package-level pricing posture", () => {
    expect(ARCHITECTURE_REVIEW_PACKAGE_CATALOG).toEqual([
      expect.objectContaining({
        tier: "advisory-review",
        pricingSummary: "Fixed at $249.",
      }),
      expect.objectContaining({
        tier: "remediation-sprint",
      }),
      expect.objectContaining({
        tier: "implementation-partner",
        pricingSummary: expect.stringContaining("Custom"),
      }),
    ]);
  });
});
