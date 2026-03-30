import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserEmailPreferencesByTokenMock, saveUserEmailPreferencesByTokenMock } = vi.hoisted(() => ({
  getUserEmailPreferencesByTokenMock: vi.fn(),
  saveUserEmailPreferencesByTokenMock: vi.fn(),
}));

vi.mock("@/lib/email-preferences", () => ({
  getUserEmailPreferencesByToken: getUserEmailPreferencesByTokenMock,
  saveUserEmailPreferencesByToken: saveUserEmailPreferencesByTokenMock,
}));

import { GET } from "@/app/email-preferences/unsubscribe/route";

describe("email preferences unsubscribe route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserEmailPreferencesByTokenMock.mockResolvedValue({
      preferences: {
        operationalResultEmails: false,
      },
    });
  });

  it("redirects to invalid when no token is supplied", async () => {
    const response = await GET(new Request("https://app.zokorp.com/email-preferences/unsubscribe"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://app.zokorp.com/email-preferences?status=invalid");
  });

  it("applies marketing opt-out and redirects back to the manage page", async () => {
    saveUserEmailPreferencesByTokenMock.mockResolvedValue({
      ok: true,
    });

    const response = await GET(
      new Request("https://app.zokorp.com/email-preferences/unsubscribe?token=signed-token"),
    );

    expect(saveUserEmailPreferencesByTokenMock).toHaveBeenCalledWith({
      token: "signed-token",
      operationalResultEmails: false,
      marketingFollowUpEmails: false,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://app.zokorp.com/email-preferences?token=signed-token&updated=1",
    );
  });
});
