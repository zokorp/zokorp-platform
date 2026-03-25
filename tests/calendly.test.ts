import { describe, expect, it } from "vitest";

import { buildCalendlyBookingUrl } from "@/lib/calendly";

describe("buildCalendlyBookingUrl", () => {
  it("keeps the existing email CTA tagging defaults", () => {
    const url = buildCalendlyBookingUrl({
      baseUrl: "https://calendly.com/zokorp/architecture-follow-up",
      estimateReferenceCode: "ZK-ARCH-20260325-ABC123",
    });

    expect(url).toBe(
      "https://calendly.com/zokorp/architecture-follow-up?utm_source=zokorp&utm_medium=architecture-review-email&utm_campaign=architecture-follow-up&utm_content=ZK-ARCH-20260325-ABC123",
    );
  });

  it("allows the services page to use its own tagged medium", () => {
    const url = buildCalendlyBookingUrl({
      baseUrl: "https://calendly.com/zokorp/architecture-follow-up",
      estimateReferenceCode: "ZK-ARCH-20260325-XYZ789",
      utmMedium: "services-page",
    });

    expect(url).toBe(
      "https://calendly.com/zokorp/architecture-follow-up?utm_source=zokorp&utm_medium=services-page&utm_campaign=architecture-follow-up&utm_content=ZK-ARCH-20260325-XYZ789",
    );
  });
});
