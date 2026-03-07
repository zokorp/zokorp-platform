import { DEFAULT_QUOTE_PRICING_CONFIG } from "@/lib/landing-zone-readiness/config";
import type {
  LandingZoneReadinessAnswers,
  LandingZoneReadinessFinding,
  LandingZoneReadinessQuote,
  QuoteConfidence,
  QuoteTier,
} from "@/lib/landing-zone-readiness/types";

type QuoteInput = {
  answers: LandingZoneReadinessAnswers;
  overallScore: number;
  findings: LandingZoneReadinessFinding[];
};

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function selectQuoteTier(input: {
  overallScore: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  coreControlsMissing: number;
  multiCloud: boolean;
  handlesSensitiveData: boolean;
}): QuoteTier {
  const shouldUseCustomScope =
    input.overallScore <= DEFAULT_QUOTE_PRICING_CONFIG.customScopeThresholds.minimumScore &&
    input.highSeverityCount >= DEFAULT_QUOTE_PRICING_CONFIG.customScopeThresholds.minimumHighSeverityFindings &&
    input.coreControlsMissing >= DEFAULT_QUOTE_PRICING_CONFIG.customScopeThresholds.minimumCoreControlsMissing &&
    input.multiCloud &&
    input.handlesSensitiveData;

  if (shouldUseCustomScope) {
    return "Custom Scope Required";
  }

  if (input.overallScore >= 90 && input.highSeverityCount === 0 && input.coreControlsMissing === 0) {
    return "Advisory Review";
  }

  if (input.overallScore >= 75 && input.highSeverityCount <= 2 && input.coreControlsMissing <= 1) {
    return "Foundation Fix Sprint";
  }

  return "Landing Zone Hardening";
}

function estimateQuoteConfidence(input: {
  tier: QuoteTier;
  highSeverityCount: number;
  coreControlsMissing: number;
  multiCloud: boolean;
  handlesSensitiveData: boolean;
}): QuoteConfidence {
  if (
    input.tier === "Custom Scope Required" ||
    (input.multiCloud && input.handlesSensitiveData && input.highSeverityCount >= 4)
  ) {
    return "low";
  }

  if (input.coreControlsMissing >= 2 || input.highSeverityCount >= 3 || input.multiCloud) {
    return "medium";
  }

  return "high";
}

function buildRationaleLines(input: {
  tier: QuoteTier;
  highSeverityCount: number;
  mediumSeverityCount: number;
  coreControlsMissing: number;
  multiCloud: boolean;
  handlesSensitiveData: boolean;
}): string[] {
  const lines: string[] = [];

  if (input.tier === "Advisory Review") {
    lines.push("The foundation is mostly usable and the remaining gaps are narrow.");
  } else if (input.tier === "Foundation Fix Sprint") {
    lines.push("The environment is usable, but the gap list is large enough to justify a focused sprint.");
  } else if (input.tier === "Landing Zone Hardening") {
    lines.push("The landing zone has multiple control gaps across core operating areas.");
  } else {
    lines.push("The scope is broad enough that a fixed package would risk under-scoping the work.");
  }

  if (input.coreControlsMissing > 0) {
    lines.push(`Core controls are missing in ${input.coreControlsMissing} critical area${input.coreControlsMissing === 1 ? "" : "s"}.`);
  } else if (input.highSeverityCount > 0 || input.mediumSeverityCount > 0) {
    lines.push(
      `${input.highSeverityCount} high-severity and ${input.mediumSeverityCount} medium-severity finding${input.highSeverityCount + input.mediumSeverityCount === 1 ? "" : "s"} drive the remediation scope.`,
    );
  }

  if (input.multiCloud && input.handlesSensitiveData) {
    lines.push("Multi-cloud scope plus sensitive-data handling increases coordination and control hardening effort.");
  } else if (input.multiCloud) {
    lines.push("Multi-cloud scope increases standardization and remediation effort.");
  } else if (input.handlesSensitiveData) {
    lines.push("Sensitive-data handling raises the minimum acceptable control baseline.");
  }

  return lines.slice(0, 3);
}

export function buildLandingZoneQuote(input: QuoteInput): LandingZoneReadinessQuote {
  const highSeverityCount = input.findings.filter((finding) => finding.severity === "high").length;
  const mediumSeverityCount = input.findings.filter((finding) => finding.severity === "medium").length;
  const coreControlsMissing = input.findings.filter((finding) =>
    [
      "IAM-MFA",
      "IAM-SERVICE-ACCOUNTS",
      "ORG-ENV-ACCOUNTS",
      "NET-PROD-ISOLATION",
      "NET-INGRESS-EGRESS",
      "SEC-SECRETS",
      "SEC-PRIVILEGE-REVIEWS",
      "OBS-CENTRAL-LOGS",
      "OBS-ALERTING",
      "DR-BACKUPS",
      "DR-RESTORE-TESTS",
      "IAC-DEFINED",
      "IAC-CICD",
      "IAC-MANUAL-PROD",
      "IAC-CODE-REVIEW",
      "ENV-SEPARATION",
    ].includes(finding.ruleId),
  ).length;

  const multiCloud = Boolean(input.answers.secondaryCloud);
  const tier = selectQuoteTier({
    overallScore: input.overallScore,
    highSeverityCount,
    mediumSeverityCount,
    coreControlsMissing,
    multiCloud,
    handlesSensitiveData: input.answers.handlesSensitiveData,
  });

  const base = DEFAULT_QUOTE_PRICING_CONFIG.tiers[tier];
  const adders = DEFAULT_QUOTE_PRICING_CONFIG.adders;

  let quoteLow = base.low;
  let quoteHigh = base.high;

  quoteLow += highSeverityCount * adders.perHighSeverityLow;
  quoteHigh += highSeverityCount * adders.perHighSeverityHigh;
  quoteLow += mediumSeverityCount * adders.perMediumSeverityLow;
  quoteHigh += mediumSeverityCount * adders.perMediumSeverityHigh;
  quoteLow += coreControlsMissing * adders.missingCoreControlLow;
  quoteHigh += coreControlsMissing * adders.missingCoreControlHigh;

  if (multiCloud) {
    quoteLow += adders.multiCloudLow;
    quoteHigh += adders.multiCloudHigh;
  }

  if (input.answers.handlesSensitiveData) {
    quoteLow += adders.sensitiveDataLow;
    quoteHigh += adders.sensitiveDataHigh;
  }

  if (tier === "Advisory Review" && input.findings.length <= 2) {
    quoteLow = Math.min(quoteLow, 1500);
    quoteHigh = Math.min(quoteHigh, 2000);
  }

  quoteLow = roundToNearest(quoteLow, 250);
  quoteHigh = roundToNearest(Math.max(quoteLow + 500, quoteHigh), 500);

  return {
    quoteTier: tier,
    quoteLow,
    quoteHigh,
    confidence: estimateQuoteConfidence({
      tier,
      highSeverityCount,
      coreControlsMissing,
      multiCloud,
      handlesSensitiveData: input.answers.handlesSensitiveData,
    }),
    rationaleLines: buildRationaleLines({
      tier,
      highSeverityCount,
      mediumSeverityCount,
      coreControlsMissing,
      multiCloud,
      handlesSensitiveData: input.answers.handlesSensitiveData,
    }),
  };
}
