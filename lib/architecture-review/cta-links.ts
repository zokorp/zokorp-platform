import { createArchitectureReviewCtaToken } from "@/lib/architecture-review/cta-token";
import { getArchitectureCallUrl } from "@/lib/marketing-cta";
import { getAppSiteUrl, getMarketingSiteUrl } from "@/lib/site";

function ctaSecret() {
  // SEC-08: the CTA signing secret must be its own value (it may share the sibling arch-review .eml
  // secret), but never the auth secret. When unset the CTA links degrade to plain marketing URLs.
  return process.env.ARCH_REVIEW_CTA_SECRET ?? process.env.ARCH_REVIEW_EML_SECRET ?? "";
}

export async function buildArchitectureReviewCtaLinks(leadId: string) {
  const secret = ctaSecret();
  const appSiteUrl = getAppSiteUrl();
  const marketingSiteUrl = getMarketingSiteUrl();

  if (!secret) {
    return {
      bookArchitectureCallUrl: getArchitectureCallUrl({
        utmMedium: "architecture-review-email",
      }),
      requestRemediationPlanUrl: process.env.ARCH_REVIEW_REMEDIATION_PLAN_URL ?? `${marketingSiteUrl}/contact`,
    };
  }

  const bookToken = createArchitectureReviewCtaToken({ leadId, ctaType: "book-call" }, secret);
  const remediationToken = createArchitectureReviewCtaToken({ leadId, ctaType: "remediation-plan" }, secret);

  return {
    bookArchitectureCallUrl: `${appSiteUrl}/api/architecture-review/cta?token=${encodeURIComponent(bookToken)}`,
    requestRemediationPlanUrl: `${appSiteUrl}/api/architecture-review/cta?token=${encodeURIComponent(remediationToken)}`,
  };
}
