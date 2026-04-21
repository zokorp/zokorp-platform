/* @vitest-environment node */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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

vi.mock("@/components/service-request-panel", () => ({
  ServiceRequestPanel: () => <section data-testid="service-request-panel">Service request panel</section>,
}));

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

import ContactPage, { metadata as contactMetadata } from "@/app/contact/page";
import PrivacyPage from "@/app/privacy/page";
import RefundsPage from "@/app/refunds/page";
import SupportPage from "@/app/support/page";
import TermsPage from "@/app/terms/page";

describe("public contact and policy pages", () => {
  it("keeps consulting@zokorp.com as the primary public support identity and preserves launch-safe policy language", async () => {
    authMock.mockResolvedValue(null);

    const contactHtml = renderToStaticMarkup(await ContactPage());
    const supportHtml = renderToStaticMarkup(await SupportPage());
    const privacyHtml = renderToStaticMarkup(await PrivacyPage());
    const refundsHtml = renderToStaticMarkup(await RefundsPage());
    const termsHtml = renderToStaticMarkup(await TermsPage());

    expect(ContactPage).toBeTypeOf("function");
    expect(contactMetadata.alternates?.canonical).toBe("https://www.zokorp.com/contact");
    expect(contactMetadata.description).toContain("Public requests go to consulting@zokorp.com");
    expect(contactHtml).toContain("Two ways to get started.");
    expect(contactHtml).toContain("Book a 15-minute fit check.");
    expect(contactHtml).toContain("zokorpconsulting.zohobookings.com");
    expect(contactHtml).toContain(
      "Small practice. Founder-led. Background includes work involving organizations across homebuilding, construction, media, enterprise software, frontier AI, and sports.",
    );
    expect(contactHtml).toContain("Service request panel");
    expect(supportHtml).toContain("consulting@zokorp.com");
    expect(supportHtml).toContain("Request a call");
    expect(supportHtml).toContain("not a 24/7 managed operations desk");
    expect(supportHtml).toContain("What to include");
    expect(privacyHtml).toContain("consulting@zokorp.com");
    expect(privacyHtml).toContain("business email addresses");
    expect(privacyHtml).toContain("Email preferences");
    expect(refundsHtml).toContain("consulting@zokorp.com");
    expect(refundsHtml).toContain("Architecture Diagram Reviewer");
    expect(refundsHtml).toContain("How to request a billing review");
    expect(termsHtml).toContain("Platform terms");
    expect(termsHtml).toContain("Decision support, not a guarantee");
    expect(termsHtml).toContain("Estimate-first services");
  });
});
