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

vi.mock("@/lib/auth", () => ({
  auth: authMock,
}));

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("keeps the founder-led offer model explicit on the public homepage", async () => {
    authMock.mockResolvedValue(null);

    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("Scoped cloud reviews, starting at $249.");
    expect(html).toContain("Start with an Architecture Review \u2014 $249");
    expect(html).toContain("Most engagements start with a $249 Architecture Review.");
    expect(html).toContain("Small practice. Clear scope. Direct follow-through.");
    expect(html).toContain("Selected background");
    expect(html).toContain(
      "Experience includes work involving organizations such as D.R. Horton, SiriusXM, Warner Bros., JE Dunn, Cohere, Glean, Anthropic, and the National Hockey League.",
    );
    expect(html).toContain(
      "That background shows up here as tighter scope, clearer reviews, cleaner follow-through, and less generic advice.",
    );
    expect(html).toContain("Across homebuilding, construction, media, enterprise software, frontier AI, and sports.");
    expect(html).toContain("Initial response within one business day");
    expect(html).toContain("Architecture Review");
    expect(html).toContain("Cloud Cost Optimization Audit");
    expect(html).toContain("Landing Zone Setup");
    expect(html).toContain("Advisory Retainer");
    expect(html).toContain("Public tools first");
    expect(html).toContain("Who ZoKorp works with.");
    expect(html).toContain("Good fit");
    expect(html).toContain("Not the right fit");
    expect(html).toContain("How it works");
    expect(html).toContain("77%");
    expect(html).toContain("$60M+");
    expect(html).toContain("$200M+");
    expect(html).toContain("Book a 30-min discovery call");
    expect(html).toContain("calendly.com/zokorp/zokorp-discovery-call");
    expect(html).not.toContain("AWS Readiness / FTR Validation");
    expect(html).not.toContain("Scoped Implementation");
    expect(html).not.toContain("AI/ML advisory");
  });
});
