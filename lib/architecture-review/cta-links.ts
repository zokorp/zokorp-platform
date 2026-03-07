import { createArchitectureReviewCtaToken } from "@/lib/architecture-review/cta-token";
import { getSiteUrl } from "@/lib/site";

function ctaSecret() {
  return process.env.ARCH_REVIEW_CTA_SECRET ?? process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

export async function buildArchitectureReviewCtaLinks(leadId: string) {
  const secret = ctaSecret();
  const siteUrl = getSiteUrl();

  if (!secret) {
    return {
      bookArchitectureCallUrl:
        process.env.ARCH_REVIEW_BOOK_CALL_URL ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? siteUrl}/services#service-request`,
      requestRemediationPlanUrl:
        process.env.ARCH_REVIEW_REMEDIATION_PLAN_URL ??
        `${process.env.NEXT_PUBLIC_SITE_URL ?? siteUrl}/services#service-request`,
    };
  }

  const bookToken = createArchitectureReviewCtaToken({ leadId, ctaType: "book-call" }, secret);
  const remediationToken = createArchitectureReviewCtaToken({ leadId, ctaType: "remediation-plan" }, secret);

  return {
    bookArchitectureCallUrl: `${siteUrl}/api/architecture-review/cta?token=${encodeURIComponent(bookToken)}`,
    requestRemediationPlanUrl: `${siteUrl}/api/architecture-review/cta?token=${encodeURIComponent(remediationToken)}`,
  };
}
