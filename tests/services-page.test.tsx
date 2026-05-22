/* @vitest-environment node */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

import ServicesPage from "@/app/services/page";

describe("ServicesPage", () => {
  const originalBookingUrl = process.env.ARCH_REVIEW_BOOK_CALL_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ARCH_REVIEW_BOOK_CALL_URL = "https://calendly.com/zokorp/zokorp-architecture-review-follow-up";
    authMock.mockResolvedValue({
      user: {
        email: "consulting@zokorp.com",
      },
    });
  });

  afterEach(() => {
    if (originalBookingUrl === undefined) {
      delete process.env.ARCH_REVIEW_BOOK_CALL_URL;
    } else {
      process.env.ARCH_REVIEW_BOOK_CALL_URL = originalBookingUrl;
    }
  });

  it("renders the productized AWS services model with signed-in request handling", async () => {
    const html = renderToStaticMarkup(await ServicesPage());

    expect(html).toContain("utm_source=zokorp");
    expect(html).toContain("utm_medium=services-page");
    expect(html).toContain("utm_campaign=architecture-follow-up");
    expect(html).toContain("Choose one starting point.");
    expect(html).toContain("Pick the first move, not a generic package.");
    expect(html).toContain("Architecture Review");
    expect(html).toContain("$249");
    expect(html).toContain("Cloud Cost Optimization Audit");
    expect(html).toContain("from $750");
    expect(html).toContain("Landing Zone Setup");
    expect(html).toContain("from $2,500");
    expect(html).toContain("Advisory Retainer");
    expect(html).toContain("from $1,500/month");
    expect(html).toContain("Why trust this work?");
    expect(html).toContain("Larger-environment standards, applied to smaller scoped engagements.");
    expect(html).toContain(
      "The same founder handling your review has operated in larger technical environments with stricter standards, more stakeholders, and less room for vague recommendations.",
    );
    expect(html).toContain(
      "Experience includes work involving organizations such as D.R. Horton, SiriusXM, Warner Bros., JE Dunn, Cohere, Glean, Anthropic, and the National Hockey League.",
    );
    expect(html).toContain("Founder-led judgment shaped by higher-stakes architecture decisions and clearer tradeoff calls.");
    expect(html).toContain("Stronger evidence discipline and less vague pass/fail language");
    expect(html).toContain("Practical prioritization instead of generic savings lists");
    expect(html).toContain("Cleaner baselines and fewer naive recommendations before the environment gets harder to unwind.");
    expect(html).toContain("Additional scoped work");
    expect(html).toContain("Readiness / Validation Review");
    expect(html).toContain("Scoped Implementation");
    expect(html).toContain("from $1,250 per sprint or $149/hr");
    expect(html).toContain("Specialist Advisory");
    expect(html).toContain("from $3,500");
    expect(html).toContain("Public requests go through the contact form.");
    expect(html).toContain("Scope is confirmed before paid consulting, remediation, or implementation work is accepted.");
    expect(html).toContain("Initial response within one business day");
    expect(html).toContain("Request a call");
    expect(html).toContain("Request a scoped response.");
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain("Microsoft");
    expect(html).not.toContain("Former AWS");
    expect(html).not.toContain("Signed in as");
    expect(html).not.toContain("Broad-launch replacement slot");
  });
});
