import { getEmailDomain } from "@/lib/security";
import type {
  ArchitectureAnalysisConfidence,
  ArchitectureSubmissionContext,
  ArchitectureQuoteTier,
} from "@/lib/architecture-review/types";

const ENTERPRISE_DOMAIN_HINTS = [
  ".io",
  ".ai",
  ".tech",
  ".cloud",
  ".dev",
  ".co",
  ".org",
  ".net",
  ".com",
];

export type LeadStage = "New Review" | "Email Sent" | "CTA Clicked" | "Call Booked";

function scoreFromOverall(overallScore: number) {
  if (overallScore < 55) {
    return 48;
  }

  if (overallScore < 70) {
    return 40;
  }

  if (overallScore < 85) {
    return 30;
  }

  return 18;
}

function scoreFromDomain(userEmail: string) {
  const domain = getEmailDomain(userEmail);
  if (!domain) {
    return 0;
  }

  const hasHint = ENTERPRISE_DOMAIN_HINTS.some((hint) => domain.endsWith(hint));
  if (hasHint) {
    return 14;
  }

  return 8;
}

function scoreFromConfidence(confidence: ArchitectureAnalysisConfidence) {
  if (confidence === "high") {
    return 12;
  }

  if (confidence === "medium") {
    return 8;
  }

  return 4;
}

function scoreFromIntent(quoteTier: ArchitectureQuoteTier) {
  if (quoteTier === "implementation-partner") {
    return 16;
  }

  if (quoteTier === "remediation-sprint") {
    return 12;
  }

  return 6;
}

function scoreFromUtm(context: ArchitectureSubmissionContext | null | undefined) {
  if (!context) {
    return 0;
  }

  if (context.utmCampaign || context.utmSource || context.utmMedium) {
    return 6;
  }

  return 2;
}

export function calculateLeadScore(input: {
  overallScore: number;
  userEmail: string;
  analysisConfidence: ArchitectureAnalysisConfidence;
  quoteTier: ArchitectureQuoteTier;
  submissionContext?: ArchitectureSubmissionContext | null;
  ctaClicks?: number;
  callBooked?: boolean;
}) {
  let score =
    scoreFromOverall(input.overallScore) +
    scoreFromDomain(input.userEmail) +
    scoreFromConfidence(input.analysisConfidence) +
    scoreFromIntent(input.quoteTier) +
    scoreFromUtm(input.submissionContext);

  if (input.ctaClicks && input.ctaClicks > 0) {
    score += Math.min(20, input.ctaClicks * 5);
  }

  if (input.callBooked) {
    score += 25;
  }

  return Math.max(0, Math.min(100, score));
}

export function zohoLeadStatusForStage(stage: LeadStage | null | undefined) {
  if (stage === "Call Booked") {
    return "Qualified";
  }

  if (stage === "CTA Clicked") {
    return "Contacted";
  }

  if (stage === "Email Sent") {
    return "Contact in Future";
  }

  return "Not Contacted";
}
