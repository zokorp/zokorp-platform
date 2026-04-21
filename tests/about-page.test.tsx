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

import AboutPage from "@/app/about/page";

describe("AboutPage", () => {
  it("keeps the founder-led positioning, quantified enterprise proof, and interview media explicit", async () => {
    authMock.mockResolvedValue(null);

    const html = renderToStaticMarkup(await AboutPage());

    expect(html).toContain("Founder-led cloud work, shown in public.");
    expect(html).toContain("Zohaib Khawaja");
    expect(html).toContain("AWS Partner Solutions Architect");
    expect(html).toContain("$60M+ in partner contracts");
    expect(html).toContain("$200M+ in customer cloud spend");
    expect(html).toContain("94 minutes to 22");
    expect(html).toContain("Larger-environment judgment. Smaller-practice delivery.");
    expect(html).toContain("Selected background");
    expect(html).toContain("Credentials");
    expect(html).toContain("AWS Certified Solutions Architect");
    expect(html).toContain("Initial response within one business day");
    expect(html).toContain("Interview footage, embedded here.");
    expect(html).toContain(
      "https://www.youtube-nocookie.com/embed/bQvrHYfJgl8?start=1320&amp;end=1581&amp;rel=0",
    );
    expect(html).toContain("data-about-reveal");
    expect(html).toContain("talk-agent-stage.jpeg");
    expect(html).toContain("panel-stage.jpeg");
    expect(html).toContain("cloudathon-stage.jpeg");
    expect(html).toContain('target="_blank"');
    expect(html).toContain("zokorpconsulting.zohobookings.com");
    expect(html).not.toContain("AI/ML advisory");
  });
});
