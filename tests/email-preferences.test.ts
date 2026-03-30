import { describe, expect, it } from "vitest";

import {
  buildEmailPreferenceFooter,
  buildEmailPreferenceLinks,
  buildEmailPreferencesToken,
  readEmailPreferencesToken,
} from "@/lib/email-preferences";

describe("email preferences helpers", () => {
  it("round-trips signed preference tokens", () => {
    const token = buildEmailPreferencesToken({
      userId: "user_123",
      email: "owner@acmecloud.com",
    });

    expect(readEmailPreferencesToken(token)).toMatchObject({
      userId: "user_123",
      email: "owner@acmecloud.com",
    });
  });

  it("builds manage and unsubscribe links plus footer copy", () => {
    const links = buildEmailPreferenceLinks({
      userId: "user_123",
      email: "owner@acmecloud.com",
    });

    expect(links?.manageUrl).toContain("/email-preferences?token=");
    expect(links?.marketingUnsubscribeUrl).toContain("/email-preferences/unsubscribe?token=");

    const footer = buildEmailPreferenceFooter({
      manageUrl: links?.manageUrl ?? "",
      marketingUnsubscribeUrl: links?.marketingUnsubscribeUrl ?? "",
    });

    expect(footer.text).toContain("Manage operational-result and follow-up email settings");
    expect(footer.html).toContain("Unsubscribe");
  });
});
