import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createArchitectureReviewCtaToken } from "@/lib/architecture-review/cta-token";

const mocks = vi.hoisted(() => ({
  leadLogUpdate: vi.fn(),
  leadUpsert: vi.fn(),
  leadInteractionCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    leadLog: {
      update: mocks.leadLogUpdate,
    },
    lead: {
      upsert: mocks.leadUpsert,
    },
    leadInteraction: {
      create: mocks.leadInteractionCreate,
    },
  },
}));

vi.mock("@/lib/db-errors", () => ({
  isSchemaDriftError: () => false,
}));

import { GET } from "@/app/api/architecture-review/cta/route";

describe("architecture review CTA route", () => {
  const originalCtaSecret = process.env.ARCH_REVIEW_CTA_SECRET;
  const originalBookingUrl = process.env.ARCH_REVIEW_BOOK_CALL_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-25T12:00:00.000Z"));
    process.env.ARCH_REVIEW_CTA_SECRET = "cta-secret";
    process.env.ARCH_REVIEW_BOOK_CALL_URL = "https://book.zokorp.com/architecture";
    mocks.leadLogUpdate.mockResolvedValue({
      id: "leadlog_123",
      userId: "user_123",
      userEmail: "architect@zokorp.com",
      userName: "Jordan Rivera",
    });
    mocks.leadUpsert.mockResolvedValue({
      id: "lead_123",
    });
    mocks.leadInteractionCreate.mockResolvedValue({
      id: "interaction_123",
    });
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalCtaSecret === undefined) {
      delete process.env.ARCH_REVIEW_CTA_SECRET;
    } else {
      process.env.ARCH_REVIEW_CTA_SECRET = originalCtaSecret;
    }

    if (originalBookingUrl === undefined) {
      delete process.env.ARCH_REVIEW_BOOK_CALL_URL;
    } else {
      process.env.ARCH_REVIEW_BOOK_CALL_URL = originalBookingUrl;
    }
  });

  it("tracks the CTA click and redirects to the booking URL", async () => {
    const token = createArchitectureReviewCtaToken(
      {
        leadId: "leadlog_123",
        ctaType: "book-call",
      },
      "cta-secret",
    );

    const response = await GET(
      new Request(`http://localhost/api/architecture-review/cta?token=${encodeURIComponent(token)}`),
    );

    expect(response.status).toBe(302);
    const redirectUrl = new URL(response.headers.get("location") ?? "");
    expect(redirectUrl.origin + redirectUrl.pathname).toBe("https://book.zokorp.com/architecture");
    expect(redirectUrl.searchParams.get("utm_source")).toBe("zokorp");
    expect(redirectUrl.searchParams.get("utm_medium")).toBe("architecture-review-email");
    expect(redirectUrl.searchParams.get("utm_campaign")).toBe("architecture-follow-up");
    expect(redirectUrl.searchParams.get("utm_content")).toMatch(/^ZK-ARCH-20260325-[A-F0-9]{6}$/);
    expect(mocks.leadLogUpdate).toHaveBeenCalledTimes(1);
    expect(mocks.leadUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: "architect@zokorp.com",
        },
        update: expect.objectContaining({
          userId: "user_123",
          name: "Jordan Rivera",
        }),
        create: expect.objectContaining({
          email: "architect@zokorp.com",
          userId: "user_123",
        }),
      }),
    );
    expect(mocks.leadInteractionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "architecture-review",
          action: "cta_clicked",
          provider: "calendly",
          estimateReferenceCode: expect.stringMatching(/^ZK-ARCH-20260325-[A-F0-9]{6}$/),
        }),
      }),
    );
  });
});
