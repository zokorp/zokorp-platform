import type {
  ArchitectureEstimateLineItem,
  ArchitectureEstimateSnapshot,
  ArchitectureReviewReport,
} from "@/lib/architecture-review/types";
import {
  getArchitectureReviewPricingCatalogEntry,
} from "@/lib/architecture-review/pricing-catalog";
import { configuredArchitectureRemediationRateUsdPerHour } from "@/lib/architecture-review/quote";
import { isExpandedReviewScope } from "@/lib/architecture-review/scope";
import { getArchitectureCallUrl } from "@/lib/marketing-cta";
import { buildEstimateReferenceCode } from "@/lib/privacy-leads";

export type ArchitectureEstimateAuditUsage = {
  ruleId: string;
  source: "published" | "fallback";
  publishedRevisionId: string | null;
  pricingMode: "DERIVED" | "OVERRIDE";
  amountUsd: number;
};

export type ArchitectureEstimateOverrideRecord = {
  ruleId: string;
  publishedRevisionId: string | null;
  serviceLineLabel: string | null;
  publicFixSummary: string | null;
  pricingMode: "DERIVED" | "OVERRIDE";
  overrideMinPriceUsd: number | null;
  overrideMaxPriceUsd: number | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function defaultBookingUrl() {
  return getArchitectureCallUrl({
    utmMedium: "architecture-review-email",
  });
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
  remediationHoursLow: number;
  remediationHoursHigh: number;
  scopeMultiplier: number;
}) {
  const midpoint = (input.remediationHoursLow + input.remediationHoursHigh) / 2;
  return roundHours(midpoint * input.scopeMultiplier);
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

  const low = input.overrideMinPriceUsd;
  const high = input.overrideMaxPriceUsd;

  if (typeof low === "number" && typeof high === "number") {
    return midpointAmount(low, high);
  }

  if (low !== null) {
    return low;
  }

  if (high !== null) {
    return high;
  }

  return input.lineItem.amountUsd;
}

// ARCH-Q01: the customer-facing estimate must stay inside the documented consultation band.
// docs/architecture-review-pricing-matrix.md:23 clamps the remediation-sprint email range to
// $650-$2,200 (low) and $850-$2,800 (high); we bound the single rendered total to that band so a
// high-hour finding cluster can no longer emit a four/five-figure auto-quote.
const CONSULTATION_BAND_FLOOR_USD = 650;
const CONSULTATION_BAND_CEILING_USD = 2_800;

function scoreBandLabelFor(overallScore: number): "0-59" | "60-89" | "90-100" {
  if (overallScore < 60) {
    return "0-59";
  }
  if (overallScore >= 90) {
    return "90-100";
  }
  return "60-89";
}

// ARCH-Q01: bound the rendered estimate to the documented band and scale the per-finding line items
// proportionally so the displayed lines still sum to the bounded headline total. The pricing matrix
// describes the core quote as "a bounded consulting estimate, not a shopping cart", so the lines are
// allocations of that bounded estimate rather than an unbounded naive sum.
function clampPayableEstimate(input: {
  lineItems: ArchitectureEstimateLineItem[];
  rawTotalUsd: number;
  band: "remediation-estimate" | "optional-polish";
}): { lineItems: ArchitectureEstimateLineItem[]; totalUsd: number } {
  const ceiling = CONSULTATION_BAND_CEILING_USD;
  // The floor only applies to the remediation sprint; an optional-polish pass can legitimately be a
  // small touch-up below $650.
  const floor = input.band === "remediation-estimate" ? CONSULTATION_BAND_FLOOR_USD : 0;
  const targetTotal = Math.min(ceiling, Math.max(floor, input.rawTotalUsd));

  if (input.rawTotalUsd <= 0 || targetTotal === input.rawTotalUsd || input.lineItems.length === 0) {
    return { lineItems: input.lineItems, totalUsd: input.rawTotalUsd };
  }

  const scale = targetTotal / input.rawTotalUsd;
  const scaled = input.lineItems.map((item) => ({
    ...item,
    amountUsd: Math.max(25, roundToNearest(item.amountUsd * scale, 25)),
  }));

  // Absorb $25-rounding drift into the largest line so the lines sum exactly to the bounded total.
  const scaledTotal = scaled.reduce((sum, item) => sum + item.amountUsd, 0);
  const drift = targetTotal - scaledTotal;
  if (drift !== 0) {
    let largestIndex = 0;
    for (let index = 1; index < scaled.length; index += 1) {
      if (scaled[index].amountUsd > scaled[largestIndex].amountUsd) {
        largestIndex = index;
      }
    }
    scaled[largestIndex] = {
      ...scaled[largestIndex],
      amountUsd: Math.max(25, scaled[largestIndex].amountUsd + drift),
    };
  }

  const totalUsd = scaled.reduce((sum, item) => sum + item.amountUsd, 0);
  return { lineItems: scaled, totalUsd };
}

function estimatePolicyForScore(input: {
  overallScore: number;
  payableQuoteTotalUsd: number;
  analysisConfidence: ArchitectureReviewReport["analysisConfidence"];
}) {
  // ARCH-Q03: a low-confidence review must not emit a payable figure. Force the consultation-first
  // path (matching Formula A's `confidence < 0.85 -> $249` guardrail and the documented contract)
  // instead of merely softening the assumptions text.
  if (input.overallScore < 60 || input.analysisConfidence === "low") {
    const lowConfidenceAbove60 = input.overallScore >= 60 && input.analysisConfidence === "low";
    return {
      band: "consultation-only" as const,
      scoreBandLabel: scoreBandLabelFor(input.overallScore),
      headline: "Consultation-first path",
      nextStep: lowConfidenceAbove60
        ? "The submitted evidence was not strong enough to pre-approve a payable remediation scope. Use the booking link so ZoKorp can confirm the real target state before issuing a quote."
        : "This architecture needs a consultation-first review before ZoKorp issues a payable remediation quote. Use the booking link to confirm the real target state and the shortest correction path.",
      payableQuoteEnabled: false,
    };
  }

  if (input.overallScore >= 90) {
    return {
      band: "optional-polish" as const,
      scoreBandLabel: "90-100" as const,
      headline: "Optional polish only",
      nextStep:
        input.payableQuoteTotalUsd > 0
          ? "The architecture is largely workable. Any scoped follow-up should focus on polish, presentation quality, or targeted optimization only."
          : "No payable remediation scope was generated because the current submission does not show material fix work. Use the booking link only if you want a human polish pass.",
      payableQuoteEnabled: input.payableQuoteTotalUsd > 0,
    };
  }

  return {
    band: "remediation-estimate" as const,
    scoreBandLabel: "60-89" as const,
    headline: "Bounded remediation estimate",
    nextStep:
      "The architecture is workable but has fixable gaps. The estimate below stays bounded to the issues visible in this submission so you can act quickly without opening a larger project.",
    payableQuoteEnabled: input.payableQuoteTotalUsd > 0,
  };
}

export function buildArchitectureEstimateSnapshot(
  report: ArchitectureReviewReport,
  overrides?: Map<string, ArchitectureEstimateOverrideRecord>,
  options?: {
    bookingUrl?: string;
  },
) {
  const publishedOverrides = overrides ?? new Map<string, ArchitectureEstimateOverrideRecord>();
  const bookingUrl = options?.bookingUrl ?? defaultBookingUrl();
  const positiveFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const scopeMultiplier = isExpandedReviewScope(report.reviewScope) ? 1.15 : 1;
  const remediationRateUsdPerHour = configuredArchitectureRemediationRateUsdPerHour();

  const quoteCandidateLineItems = positiveFindings.map((finding) => {
    const codeEntry = getArchitectureReviewPricingCatalogEntry(finding.ruleId);
    const publishedOverride = publishedOverrides.get(finding.ruleId);
    const remediationHoursLow = codeEntry?.remediationHoursLow ?? 0.5;
    const remediationHoursHigh = codeEntry?.remediationHoursHigh ?? 0.5;
    const estimatedHours = estimatedHoursForFinding({
      remediationHoursLow,
      remediationHoursHigh,
      scopeMultiplier,
    });
    const derivedAmountUsd = Math.max(75, roundToNearest(estimatedHours * remediationRateUsdPerHour, 25));
    const baseLineItem: ArchitectureEstimateLineItem = {
      ruleId: finding.ruleId,
      category: finding.category,
      pointsDeducted: finding.pointsDeducted,
      serviceLineLabel:
        normalizeText(publishedOverride?.serviceLineLabel) ||
        codeEntry?.serviceLine ||
        `Fix ${finding.ruleId}`,
      publicFixSummary: normalizeText(publishedOverride?.publicFixSummary) || finding.howToFix || finding.fix,
      amountUsd: derivedAmountUsd,
      estimatedHours,
      remediationHoursLow,
      remediationHoursHigh,
      officialSourceLinks: codeEntry?.officialSourceLinks ?? [],
      confidenceGuidance:
        codeEntry?.confidenceGuidance ??
        "Confidence depends on whether the submitted diagram and narrative clearly show the controls being claimed.",
      partialCreditGuidance:
        codeEntry?.partialCreditGuidance ??
        "Partial credit applies when the reviewer can see the architectural intent but not the exact implementation detail.",
      source: publishedOverride ? "published" : "fallback",
      publishedRevisionId: publishedOverride?.publishedRevisionId ?? null,
    };

    const amountUsd = quoteAmountForFinding({
      lineItem: baseLineItem,
      overrideMinPriceUsd: publishedOverride?.overrideMinPriceUsd ?? null,
      overrideMaxPriceUsd: publishedOverride?.overrideMaxPriceUsd ?? null,
      pricingMode: publishedOverride?.pricingMode ?? "DERIVED",
    });

    return {
      ...baseLineItem,
      amountUsd,
    };
  });

  const payableQuoteTotalUsd = quoteCandidateLineItems.reduce((sum, item) => sum + item.amountUsd, 0);
  const policy = estimatePolicyForScore({
    overallScore: report.overallScore,
    payableQuoteTotalUsd,
    analysisConfidence: report.analysisConfidence,
  });
  // ARCH-Q01: bound the customer-facing total (and scale the lines to match) for payable bands.
  const clampedEstimate =
    policy.band === "consultation-only"
      ? { lineItems: [] as ArchitectureEstimateLineItem[], totalUsd: 0 }
      : clampPayableEstimate({
          lineItems: quoteCandidateLineItems,
          rawTotalUsd: payableQuoteTotalUsd,
          band: policy.band,
        });
  const lineItems = clampedEstimate.lineItems;
  const totalUsd = clampedEstimate.totalUsd;
  const assumptions =
    policy.band === "consultation-only"
      ? [
          "No payable remediation quote is being issued at this score band.",
          "The architecture needs a consultation-first review to confirm whether the design is feasible, salvageable, or should be redesigned.",
          "Any future quote depends on validating the intended workload, constraints, and target outcome during the follow-up call.",
        ]
      : [
          "Estimated only for the issues visible in the submitted diagram and written narrative.",
          // Low-confidence reviews now route to the consultation-only band above, so the payable
          // assumptions only distinguish optional-polish from a bounded remediation pass.
          policy.band === "optional-polish"
            ? "The follow-up scope assumes polish, optimization, or presentation cleanup instead of a broader redesign."
            : "The estimate assumes the current architecture can be corrected without a broader redesign.",
          "Work is scoped for a solo implementation pass and one review cycle unless expanded during the booking conversation.",
        ];
  const exclusions =
    policy.band === "consultation-only"
      ? [
          "This email does not include a payable remediation quote or delivery commitment.",
          "New requirements, migrations, application code changes, and vendor procurement stay outside scope until the consultation confirms a workable target state.",
          "If the intended design is impossible or materially misaligned with AWS best practices, the next step is redesign guidance rather than a light remediation pass.",
        ]
      : [
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
    policy,
    lineItems,
    assumptions,
    exclusions,
  };

  const auditUsage: ArchitectureEstimateAuditUsage[] = quoteCandidateLineItems.map((item) => ({
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

export function buildFallbackArchitectureEstimateSnapshot(
  report: ArchitectureReviewReport,
  options?: {
    bookingUrl?: string;
  },
) {
  return buildArchitectureEstimateSnapshot(report, new Map<string, ArchitectureEstimateOverrideRecord>(), options);
}
