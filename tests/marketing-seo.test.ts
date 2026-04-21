import { describe, expect, it } from "vitest";

import { metadata as aboutMetadata } from "@/app/about/page";
import { metadata as homeMetadata } from "@/app/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("marketing SEO surfaces", () => {
  it("publishes robots and sitemap for the canonical www host only", async () => {
    const robotsConfig = robots();
    const entries = await sitemap();
    const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];

    expect(robotsConfig.host).toBe("https://www.zokorp.com");
    expect(robotsConfig.sitemap).toBe("https://www.zokorp.com/sitemap.xml");
    expect(rules[0]?.disallow).toContain("/account");
    expect(entries.some((entry) => entry.url === "https://www.zokorp.com/")).toBe(true);
    expect(entries.some((entry) => entry.url.startsWith("https://app.zokorp.com"))).toBe(false);
    expect(entries.some((entry) => entry.url === "https://www.zokorp.com/case-studies")).toBe(true);
  });

  it("keeps marketing metadata canonicalized to www", () => {
    expect(homeMetadata.alternates?.canonical).toBe("https://www.zokorp.com/");
    expect(aboutMetadata.alternates?.canonical).toBe("https://www.zokorp.com/about");
    expect(homeMetadata.openGraph?.url).toBe("https://www.zokorp.com/");
  });
});
