import { z } from "zod";

import {
  BILLING_SUMMARY_MAX_CHARS,
  CLOUD_COST_BLOCKED_EMAIL_DOMAINS,
  NARRATIVE_MIN_CHARS,
  NARRATIVE_MIN_WORDS,
} from "@/lib/cloud-cost-leak-finder/config";
import { getEmailDomain } from "@/lib/security";

const blockedDomains = new Set<string>(CLOUD_COST_BLOCKED_EMAIL_DOMAINS);

const LOW_EFFORT_EXAMPLES = new Set([
  "help",
  "reduce costs",
  "cloud too expensive",
  "our cloud is expensive",
  "need savings",
  "cut cloud costs",
]);

export function isAllowedCloudCostBusinessEmail(email: string) {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  return !blockedDomains.has(domain);
}

export function normalizeCloudCostWebsite(website: string) {
  const trimmed = website.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function normalizeFreeText(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

export function evaluateNarrativeQuality(narrative: string) {
  const normalized = normalizeFreeText(narrative);
  const words = normalized ? normalized.split(" ") : [];
  const lower = normalized.toLowerCase();
  const detailBand =
    normalized.length >= 260 || words.length >= 45 ? "high" : normalized.length >= 140 || words.length >= 24 ? "medium" : "low";
  const lowEffort =
    LOW_EFFORT_EXAMPLES.has(lower) ||
    normalized.length < NARRATIVE_MIN_CHARS ||
    words.length < NARRATIVE_MIN_WORDS;

  return {
    normalized,
    charCount: normalized.length,
    wordCount: words.length,
    detailBand,
    lowEffort,
  } as const;
}

export function narrativeValidationMessage(narrative: string) {
  const quality = evaluateNarrativeQuality(narrative);
  if (!quality.lowEffort) {
    return null;
  }

  return "Add more detail about your workloads, spend drivers, and what feels wasteful so the review can be useful.";
}

export function billingSummaryValidationMessage(summary: string) {
  if (summary.trim().length <= BILLING_SUMMARY_MAX_CHARS) {
    return null;
  }

  return `Keep the billing summary under ${BILLING_SUMMARY_MAX_CHARS.toLocaleString()} characters.`;
}

export function firstCloudCostIssueMessage(error: z.ZodError) {
  const firstIssue = error.issues[0];
  const field = firstIssue?.path[0];

  if (field === "email") {
    return "Enter a valid business email address.";
  }

  if (field === "website") {
    return "Enter a valid company website or domain.";
  }

  if (field === "secondaryCloud") {
    return "Choose a different secondary cloud or leave it blank.";
  }

  if (field === "narrativeInput") {
    return narrativeValidationMessage("") ?? "Describe your cloud environment in more detail.";
  }

  if (field === "billingSummaryInput") {
    return billingSummaryValidationMessage("x".repeat(BILLING_SUMMARY_MAX_CHARS + 1)) ?? "Review the billing summary input.";
  }

  return firstIssue?.message || "Please review the required fields and try again.";
}
