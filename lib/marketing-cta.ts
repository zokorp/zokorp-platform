import { buildCalendlyBookingUrl } from "@/lib/calendly";

// Routed to the Discovery Call event so a single Calendly event covers both
// first-time discovery and post-architecture-review follow-up bookings. The
// utm_campaign="architecture-follow-up" tag (set elsewhere) still
// distinguishes these in analytics.
const DEFAULT_ARCHITECTURE_CALL_URL =
  "https://calendly.com/zokorp/zokorp-discovery-call";

type ConsultationCtaOptions = {
  signedIn: boolean;
  utmMedium: string;
  publicHref?: string;
  publicLabel?: string;
  utmCampaign?: string;
};

export function getArchitectureCallBaseUrl() {
  return process.env.ARCH_REVIEW_BOOK_CALL_URL?.trim() || DEFAULT_ARCHITECTURE_CALL_URL;
}

export function getArchitectureCallUrl(input: {
  utmMedium: string;
  utmSource?: string | null;
  utmCampaign?: string | null;
  estimateReferenceCode?: string | null;
}) {
  return buildCalendlyBookingUrl({
    baseUrl: getArchitectureCallBaseUrl(),
    utmMedium: input.utmMedium,
    utmSource: input.utmSource,
    utmCampaign: input.utmCampaign,
    estimateReferenceCode: input.estimateReferenceCode,
  });
}

export function getConsultationCta({
  signedIn,
  utmMedium,
  publicHref = "/contact",
  publicLabel = "Request a call",
  utmCampaign,
}: ConsultationCtaOptions) {
  if (signedIn) {
    return {
      href: getArchitectureCallUrl({
        utmMedium,
        utmCampaign,
      }),
      label: "Book a call",
      external: true,
    };
  }

  return {
    href: publicHref,
    label: publicLabel,
    external: false,
  };
}
