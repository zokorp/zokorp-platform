/* @vitest-environment node */

import { describe, expect, it } from "vitest";

import { metadata as accessDeniedMetadata } from "@/app/access-denied/page";
import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as accountMetadata } from "@/app/account/page";
import { metadata as billingMetadata } from "@/app/account/billing/page";
import { metadata as emailPreferencesMetadata } from "@/app/email-preferences/page";
import { metadata as forgotPasswordMetadata } from "@/app/login/forgot-password/page";
import { metadata as loginMetadata } from "@/app/login/page";
import { metadata as resetPasswordMetadata } from "@/app/login/reset-password/page";
import { metadata as verifyRequestMetadata } from "@/app/login/verify-request/page";
import { metadata as registerMetadata } from "@/app/register/page";
import { metadata as verifyEmailMetadata } from "@/app/register/verify-email/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as softwareMetadata } from "@/app/software/page";

describe("site metadata", () => {
  it("uses the www host for public page canonicals", () => {
    expect(aboutMetadata.alternates?.canonical).toBe("https://www.zokorp.com/about");
    expect(softwareMetadata.alternates?.canonical).toBe("https://www.zokorp.com/software");
  });

  it("keeps app-only routes canonicalized to the app host and noindexed", () => {
    expect(loginMetadata.alternates?.canonical).toBe("https://app.zokorp.com/login");
    expect(registerMetadata.alternates?.canonical).toBe("https://app.zokorp.com/register");
    expect(forgotPasswordMetadata.alternates?.canonical).toBe("https://app.zokorp.com/login/forgot-password");
    expect(resetPasswordMetadata.alternates?.canonical).toBe("https://app.zokorp.com/login/reset-password");
    expect(verifyRequestMetadata.alternates?.canonical).toBe("https://app.zokorp.com/login/verify-request");
    expect(verifyEmailMetadata.alternates?.canonical).toBe("https://app.zokorp.com/register/verify-email");
    expect(accountMetadata.alternates?.canonical).toBe("https://app.zokorp.com/account");
    expect(billingMetadata.alternates?.canonical).toBe("https://app.zokorp.com/account/billing");
    expect(emailPreferencesMetadata.alternates?.canonical).toBe("https://app.zokorp.com/email-preferences");
    expect(loginMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
    expect(registerMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
    expect(accountMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
    expect(billingMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
    expect(accessDeniedMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });

  it("publishes robots and sitemap for the marketing host only", async () => {
    const robotsMetadata = robots();
    const sitemapEntries = await sitemap();

    expect(robotsMetadata.host).toBe("https://www.zokorp.com");
    expect(robotsMetadata.sitemap).toBe("https://www.zokorp.com/sitemap.xml");
    expect(sitemapEntries.every((entry) => entry.url.startsWith("https://www.zokorp.com"))).toBe(true);
    expect(sitemapEntries.some((entry) => entry.url.includes("/case-studies"))).toBe(true);
  });
});
