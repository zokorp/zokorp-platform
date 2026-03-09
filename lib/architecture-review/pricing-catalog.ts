import { calculateFixCostUSD } from "@/lib/architecture-review/quote";
import type { ArchitectureCategory } from "@/lib/architecture-review/types";

type PointsSpec =
  | {
      kind: "fixed";
      value: number;
      summary: string;
    }
  | {
      kind: "range";
      min: number;
      max: number;
      summary: string;
    }
  | {
      kind: "optional";
      summary: string;
    };

type QuoteImpact = "included" | "review-rejected" | "zero-cost-optional";

export type ArchitectureReviewPricingCatalogEntry = {
  ruleId: string;
  category: ArchitectureCategory;
  serviceLine: string;
  triggerSummary: string;
  pointsSummary: string;
  minPointsDeducted: number;
  maxPointsDeducted: number;
  minFixCostUSD: number;
  maxFixCostUSD: number;
  quoteImpact: QuoteImpact;
  pricingNotes?: string;
};

export type ArchitectureReviewPackageCatalogEntry = {
  tier: "advisory-review" | "remediation-sprint" | "implementation-partner";
  label: string;
  pricingSummary: string;
  deliverySummary: string;
};

function normalizePoints(points: PointsSpec) {
  if (points.kind === "fixed") {
    return {
      min: points.value,
      max: points.value,
      summary: points.summary,
    };
  }

  if (points.kind === "range") {
    return {
      min: points.min,
      max: points.max,
      summary: points.summary,
    };
  }

  return {
    min: 0,
    max: 0,
    summary: points.summary,
  };
}

function createPricingEntry(input: {
  ruleId: string;
  category: ArchitectureCategory;
  serviceLine: string;
  triggerSummary: string;
  points: PointsSpec;
  quoteImpact?: QuoteImpact;
  pricingNotes?: string;
}): ArchitectureReviewPricingCatalogEntry {
  const normalizedPoints = normalizePoints(input.points);

  return {
    ruleId: input.ruleId,
    category: input.category,
    serviceLine: input.serviceLine,
    triggerSummary: input.triggerSummary,
    pointsSummary: normalizedPoints.summary,
    minPointsDeducted: normalizedPoints.min,
    maxPointsDeducted: normalizedPoints.max,
    minFixCostUSD: calculateFixCostUSD(input.category, normalizedPoints.min),
    maxFixCostUSD: calculateFixCostUSD(input.category, normalizedPoints.max),
    quoteImpact: input.quoteImpact ?? "included",
    pricingNotes: input.pricingNotes,
  };
}

export const ARCHITECTURE_REVIEW_PACKAGE_CATALOG: ArchitectureReviewPackageCatalogEntry[] = [
  {
    tier: "advisory-review",
    label: "Advisory Review",
    pricingSummary: "Fixed at $249.",
    deliverySummary: "45-minute review call to prioritize findings, sequence fixes, and assign owners.",
  },
  {
    tier: "remediation-sprint",
    label: "Remediation Sprint",
    pricingSummary:
      "Rendered in the email as 0.9x-1.2x of the deterministic core quote, clamped to $650-$2,200 low and $850-$2,800 high.",
    deliverySummary: "Hands-on fix package for the highest-impact deductions with updated architecture artifacts.",
  },
  {
    tier: "implementation-partner",
    label: "Implementation Partner",
    pricingSummary: "Custom, selected when the score profile or engagement preference points to broader execution help.",
    deliverySummary: "End-to-end redesign and execution support with rollout, governance, and delivery milestones.",
  },
];

export const ARCHITECTURE_REVIEW_PRICING_CATALOG: ArchitectureReviewPricingCatalogEntry[] = [
  createPricingEntry({
    ruleId: "MSFT-META-TITLE",
    category: "clarity",
    serviceLine: "Architecture metadata cleanup",
    triggerSummary: "Diagram title metadata is missing.",
    points: {
      kind: "fixed",
      value: 3,
      summary: "Fixed at 3 clarity points when title metadata is absent.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-META-OWNER",
    category: "clarity",
    serviceLine: "Ownership and operating-contact cleanup",
    triggerSummary: "Diagram owner metadata is missing.",
    points: {
      kind: "fixed",
      value: 3,
      summary: "Fixed at 3 clarity points when owner metadata is absent.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-META-LAST-UPDATED",
    category: "clarity",
    serviceLine: "Review-date hygiene",
    triggerSummary: "Diagram last-reviewed metadata is missing.",
    points: {
      kind: "fixed",
      value: 3,
      summary: "Fixed at 3 clarity points when last-reviewed metadata is absent.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-META-VERSION",
    category: "clarity",
    serviceLine: "Version-control hygiene",
    triggerSummary: "Diagram version metadata is missing.",
    points: {
      kind: "fixed",
      value: 3,
      summary: "Fixed at 3 clarity points when version metadata is absent.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-SECURITY",
    category: "security",
    serviceLine: "Security control mapping",
    triggerSummary: "No meaningful identity, secret-management, or encryption controls are described.",
    points: {
      kind: "fixed",
      value: 12,
      summary: "Fixed at 12 security points when security controls are missing entirely.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-RELIABILITY",
    category: "reliability",
    serviceLine: "Reliability and recovery planning",
    triggerSummary: "No meaningful redundancy, backup/restore, or disaster-recovery controls are described.",
    points: {
      kind: "fixed",
      value: 10,
      summary: "Fixed at 10 reliability points when recovery controls are missing entirely.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-OPERATIONS",
    category: "operations",
    serviceLine: "Observability and runbook setup",
    triggerSummary: "No meaningful monitoring, alerting, or runbook ownership is described.",
    points: {
      kind: "fixed",
      value: 8,
      summary: "Fixed at 8 operations points when operational controls are missing entirely.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-PERFORMANCE",
    category: "performance",
    serviceLine: "Performance and scalability review",
    triggerSummary: "No meaningful caching, load-balancing, or scaling controls are described.",
    points: {
      kind: "fixed",
      value: 6,
      summary: "Fixed at 6 performance points when performance controls are missing entirely.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-COST",
    category: "cost",
    serviceLine: "Cost guardrail review",
    triggerSummary: "No rightsizing, autoscaling-bound, or budget-control language is described.",
    points: {
      kind: "fixed",
      value: 6,
      summary: "Fixed at 6 cost points when cost controls are missing entirely.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-SECURITY-DEPTH",
    category: "security",
    serviceLine: "Security control depth expansion",
    triggerSummary: "Only one security signal is present; the reviewer wants at least two concrete mechanisms.",
    points: {
      kind: "fixed",
      value: 6,
      summary: "Fixed at 6 security points when only one security indicator is present.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-RELIABILITY-DEPTH",
    category: "reliability",
    serviceLine: "Recovery-detail expansion",
    triggerSummary: "Only one reliability signal is present; the reviewer wants at least two concrete mechanisms.",
    points: {
      kind: "fixed",
      value: 5,
      summary: "Fixed at 5 reliability points when only one reliability indicator is present.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-OPERATIONS-DEPTH",
    category: "operations",
    serviceLine: "Observability-depth expansion",
    triggerSummary: "Only one operations signal is present; the reviewer wants at least two concrete mechanisms.",
    points: {
      kind: "fixed",
      value: 4,
      summary: "Fixed at 4 operations points when only one operations indicator is present.",
    },
  }),
  createPricingEntry({
    ruleId: "PILLAR-SUSTAINABILITY-OPTIONAL",
    category: "sustainability",
    serviceLine: "Optional sustainability guidance",
    triggerSummary: "No sustainability signals are present, but sustainability is treated as optional guidance.",
    points: {
      kind: "optional",
      summary: "Always 0 points; this is advisory only.",
    },
    quoteImpact: "zero-cost-optional",
  }),
  createPricingEntry({
    ruleId: "CLAR-OFFICIAL-REFERENCE-PATTERN",
    category: "clarity",
    serviceLine: "Reference-architecture calibration",
    triggerSummary: "The reviewer detected an official reference-pattern diagram and softened penalties.",
    points: {
      kind: "optional",
      summary: "Always 0 points; this entry documents softened scoring.",
    },
    quoteImpact: "zero-cost-optional",
  }),
  createPricingEntry({
    ruleId: "INPUT-NOT-ARCH-DIAGRAM",
    category: "clarity",
    serviceLine: "Submission rejection and re-upload request",
    triggerSummary: "OCR strongly indicates the upload is not an architecture diagram.",
    points: {
      kind: "fixed",
      value: 35,
      summary: "Fixed at 35 clarity points in the engine, but this normally causes the review to be rejected before a quote is sent.",
    },
    quoteImpact: "review-rejected",
    pricingNotes: "No quote should be sent; the user is asked to upload a real architecture diagram.",
  }),
  createPricingEntry({
    ruleId: "INPUT-NON-ARCH-SUSPECT",
    category: "clarity",
    serviceLine: "Submission-quality triage",
    triggerSummary: "OCR indicates mixed non-architecture and architecture signals.",
    points: {
      kind: "fixed",
      value: 10,
      summary: "Fixed at 10 clarity points when the upload is suspicious but not rejected outright.",
    },
    pricingNotes: "This commonly pushes the quote toward diagnostic-only handling by reducing confidence in the review.",
  }),
  createPricingEntry({
    ruleId: "INPUT-PARAGRAPH-QUALITY",
    category: "clarity",
    serviceLine: "Narrative rewrite and flow clarification",
    triggerSummary: "The architecture paragraph is too short or too low-signal to trust.",
    points: {
      kind: "fixed",
      value: 8,
      summary: "Fixed at 8 clarity points when the architecture paragraph lacks usable detail.",
    },
  }),
  createPricingEntry({
    ruleId: "AWS-PROVIDER-MISMATCH",
    category: "clarity",
    serviceLine: "Provider alignment correction",
    triggerSummary: "The selected provider is AWS, but the detected services look like another cloud.",
    points: {
      kind: "fixed",
      value: 14,
      summary: "Fixed at 14 clarity points when the chosen provider conflicts with detected provider signals.",
    },
  }),
  createPricingEntry({
    ruleId: "AZURE-PROVIDER-MISMATCH",
    category: "clarity",
    serviceLine: "Provider alignment correction",
    triggerSummary: "The selected provider is Azure, but the detected services look like another cloud.",
    points: {
      kind: "fixed",
      value: 14,
      summary: "Fixed at 14 clarity points when the chosen provider conflicts with detected provider signals.",
    },
  }),
  createPricingEntry({
    ruleId: "GCP-PROVIDER-MISMATCH",
    category: "clarity",
    serviceLine: "Provider alignment correction",
    triggerSummary: "The selected provider is GCP, but the detected services look like another cloud.",
    points: {
      kind: "fixed",
      value: 14,
      summary: "Fixed at 14 clarity points when the chosen provider conflicts with detected provider signals.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-FLOW-DIRECTION",
    category: "clarity",
    serviceLine: "Request/data-flow narration",
    triggerSummary: "The narrative does not explain directionality with clear verbs or sequence markers.",
    points: {
      kind: "fixed",
      value: 6,
      summary: "Fixed at 6 clarity points when request/data direction is unclear.",
    },
  }),
  createPricingEntry({
    ruleId: "CLAR-UNIDIR-RELATIONSHIPS",
    category: "clarity",
    serviceLine: "Relationship-arrow cleanup",
    triggerSummary: "Bidirectional relationships or arrows were detected instead of explicit one-way flows.",
    points: {
      kind: "fixed",
      value: 4,
      summary: "Fixed at 4 clarity points when bidirectional relationship labels are used.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-COMPONENT-LABEL-COVERAGE",
    category: "clarity",
    serviceLine: "Component-role explanation pass",
    triggerSummary:
      "More than 8 service tokens were detected, but the paragraph explains fewer than roughly 35% of them (minimum 3 explained).",
    points: {
      kind: "range",
      min: 4,
      max: 12,
      summary: "Calculated as 4 + floor(missing explained components / 2), capped at 12 clarity points.",
    },
  }),
  createPricingEntry({
    ruleId: "CLAR-BOUNDARY-EXPLICIT",
    category: "clarity",
    serviceLine: "Trust-boundary and scope labeling",
    triggerSummary: "The diagram narrative does not name scope boundaries, in-scope/out-of-scope areas, or trust boundaries.",
    points: {
      kind: "fixed",
      value: 4,
      summary: "Fixed at 4 clarity points when trust boundaries are not made explicit.",
    },
  }),
  createPricingEntry({
    ruleId: "CLAR-REL-LABELS-MISSING",
    category: "clarity",
    serviceLine: "Protocol and transfer labeling",
    triggerSummary: "The paragraph uses generic relationship verbs but omits protocol or transfer-intent labels.",
    points: {
      kind: "fixed",
      value: 4,
      summary: "Fixed at 4 clarity points when relationship intent/protocol labels are missing.",
    },
  }),
  createPricingEntry({
    ruleId: "CLAR-REGION-ZONE-MISSING",
    category: "clarity",
    serviceLine: "Region and zone placement review",
    triggerSummary: "The architecture is complex enough to need region/zone language, but none is present.",
    points: {
      kind: "fixed",
      value: 4,
      summary: "Fixed at 4 clarity points when region/zone strategy is absent.",
    },
  }),
  createPricingEntry({
    ruleId: "CLAR-STALE-DIAGRAM",
    category: "clarity",
    serviceLine: "Diagram refresh and recertification",
    triggerSummary: "The supplied last-reviewed date makes the diagram look stale.",
    points: {
      kind: "range",
      min: 2,
      max: 6,
      summary: "Calculated as 2 + floor((months stale - 6) / 4), capped at 6 clarity points.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-LEGEND-SEMANTICS",
    category: "clarity",
    serviceLine: "Legend and notation standardization",
    triggerSummary: "Multiple arrow semantics were detected, but the legend metadata is empty.",
    points: {
      kind: "fixed",
      value: 7,
      summary: "Fixed at 7 clarity points when diagram semantics need a legend.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-LAYERING-DENSITY",
    category: "clarity",
    serviceLine: "Layered-diagram decomposition",
    triggerSummary: "The canvas is dense enough that the reviewer recommends splitting it into layered diagrams.",
    points: {
      kind: "range",
      min: 1,
      max: 5,
      summary: "Calculated as 1 + floor((service token count - 18) / 4), capped at 5 clarity points.",
    },
  }),
  createPricingEntry({
    ruleId: "MSFT-LAYERING-OPTIONAL",
    category: "clarity",
    serviceLine: "Optional layered-view recommendation",
    triggerSummary: "The diagram is busy enough that a layered view would help, but it is not required.",
    points: {
      kind: "optional",
      summary: "Always 0 points; this is advisory only.",
    },
    quoteImpact: "zero-cost-optional",
  }),
  createPricingEntry({
    ruleId: "REL-RTO-RPO-MISSING",
    category: "reliability",
    serviceLine: "Recovery-target definition",
    triggerSummary: "Stateful services are present, but no RTO/RPO targets are named.",
    points: {
      kind: "fixed",
      value: 8,
      summary: "Fixed at 8 reliability points when stateful recovery targets are missing.",
    },
  }),
  createPricingEntry({
    ruleId: "REL-BACKUP-RESTORE",
    category: "reliability",
    serviceLine: "Backup and restore planning",
    triggerSummary: "Stateful services are present, but no backup/restore coverage is described.",
    points: {
      kind: "fixed",
      value: 8,
      summary: "Fixed at 8 reliability points when backup/restore coverage is missing.",
    },
  }),
  createPricingEntry({
    ruleId: "SEC-BASELINE-MISSING",
    category: "security",
    serviceLine: "Compliance baseline mapping",
    triggerSummary: "A regulated scope was selected, but the diagram does not map any explicit control baseline.",
    points: {
      kind: "fixed",
      value: 8,
      summary: "Fixed at 8 security points when compliance baseline detail is absent.",
    },
  }),
  createPricingEntry({
    ruleId: "CLAR-DATA-CLASS-MISSING",
    category: "security",
    serviceLine: "Sensitive-data classification review",
    triggerSummary: "Stateful data is present, but the diagram never identifies PII/PCI/PHI or other sensitive-data classes.",
    points: {
      kind: "fixed",
      value: 6,
      summary: "Fixed at 6 security points when data-classification language is missing.",
    },
  }),
];

const pricingCatalogByRuleId = new Map(
  ARCHITECTURE_REVIEW_PRICING_CATALOG.map((entry) => [entry.ruleId, entry]),
);

export function getArchitectureReviewPricingCatalogEntry(ruleId: string) {
  return pricingCatalogByRuleId.get(ruleId) ?? null;
}
