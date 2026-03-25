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
    process.env.ARCH_REVIEW_BOOK_CALL_URL = "https://calendly.com/zokorp/architecture-follow-up";
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

  it("renders a tagged booking CTA and a signed-in service request panel on first paint", async () => {
    const html = renderToStaticMarkup(await ServicesPage());

    expect(html).toContain("utm_source=zokorp");
    expect(html).toContain("utm_medium=services-page");
    expect(html).toContain("utm_campaign=architecture-follow-up");
    expect(html).toContain("Signed in as");
    expect(html).toContain("consulting@zokorp.com");
    expect(html).not.toContain("Sign in to submit a request and track milestones from your account.");
  });
});
