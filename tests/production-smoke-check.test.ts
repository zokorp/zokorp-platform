/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  APP_HOST_MARKETING_REDIRECT_EXPECTATIONS,
  APP_PRODUCT_EXPECTATIONS,
  APP_ROOT_EXPECTATION,
  APP_ROUTE_EXPECTATIONS,
  APP_SIGNED_OUT_REDIRECT_EXPECTATIONS,
  APP_META_EXPECTATIONS,
  LEGACY_REDIRECT_EXPECTATIONS,
  MARKETING_ROUTE_EXPECTATIONS,
} from "@/scripts/playwright_audit_contract.mjs";
import { runProductionSmokeCheck } from "@/scripts/production_smoke_check.mjs";

function mockResponse({
  status = 200,
  url,
  body = "",
  headers = {},
}: {
  status?: number;
  url: string;
  body?: string;
  headers?: Record<string, string>;
}) {
  const response = new Response(body, {
    status,
    headers,
  });
  Object.defineProperty(response, "url", {
    value: url,
  });
  return response;
}

function htmlResponse({
  url,
  body,
  canonicalUrl,
  robotsContent,
  headers = {},
}: {
  url: string;
  body: string;
  canonicalUrl?: string;
  robotsContent?: string;
  headers?: Record<string, string>;
}) {
  const headParts = [];
  if (canonicalUrl) {
    headParts.push(`<link rel="canonical" href="${canonicalUrl}">`);
  }
  if (robotsContent) {
    headParts.push(`<meta name="robots" content="${robotsContent}">`);
  }

  return mockResponse({
    url,
    body: `<!doctype html><html><head>${headParts.join("")}</head><body>${body}</body></html>`,
    headers,
  });
}

describe("runProductionSmokeCheck", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.JOURNEY_MARKETING_BASE_URL;
    delete process.env.JOURNEY_APP_BASE_URL;
    delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  });

  it("passes for a same-origin local target and skips host-split-only checks", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const localBaseUrl = "http://127.0.0.1:3000";

      if (url === "http://example.com" || url === "https://vercel.com") {
        return mockResponse({ url, body: "ok" });
      }

      if (url.endsWith("/robots.txt")) {
        return mockResponse({
          url,
          body: `User-agent: *\nSitemap: ${localBaseUrl}/sitemap.xml\n`,
        });
      }

      if (url.endsWith("/sitemap.xml")) {
        return mockResponse({
          url,
          body: `<urlset><url><loc>${localBaseUrl}/</loc></url></urlset>`,
        });
      }

      if (init?.redirect === "manual") {
        for (const redirect of LEGACY_REDIRECT_EXPECTATIONS) {
          if (url === `http://127.0.0.1:3000${redirect.from}`) {
            return mockResponse({
              status: 308,
              url,
              headers: { location: `http://127.0.0.1:3000${redirect.to}` },
            });
          }
        }
      }

      for (const route of APP_ROUTE_EXPECTATIONS) {
        if (url === `${localBaseUrl}${route.path}`) {
          return htmlResponse({
            url,
            body: route.marker,
            canonicalUrl: route.expectedCanonicalHost
              ? `${route.expectedCanonicalHost === "app" ? "https://app.zokorp.com" : "https://www.zokorp.com"}${route.path}`
              : undefined,
            robotsContent: route.expectedRobotsContent,
            headers:
              route.expectedRobotsHeader
                ? { "x-robots-tag": route.expectedRobotsHeader }
                : undefined,
          });
        }
      }

      for (const route of MARKETING_ROUTE_EXPECTATIONS) {
        if (url === `${localBaseUrl}${route.path}`) {
          return htmlResponse({
            url,
            body: route.marker,
            canonicalUrl: `${localBaseUrl}${route.path}`,
          });
        }
      }

      for (const product of APP_PRODUCT_EXPECTATIONS) {
        if (url === `${localBaseUrl}${product.path}`) {
          return htmlResponse({
            url,
            body: product.titleMarker,
            canonicalUrl: `https://www.zokorp.com${product.path}`,
            robotsContent: "noindex,follow",
            headers: { "x-robots-tag": "noindex, follow" },
          });
        }
      }

      for (const metaExpectation of APP_META_EXPECTATIONS) {
        if (url === `${localBaseUrl}${metaExpectation.path}`) {
          return htmlResponse({
            url,
            body: metaExpectation.label,
            canonicalUrl: metaExpectation.expectedCanonicalHost
              ? `${metaExpectation.expectedCanonicalHost === "app" ? "https://app.zokorp.com" : "https://www.zokorp.com"}${metaExpectation.path}`
              : undefined,
            robotsContent: metaExpectation.expectedRobotsContent,
            headers: metaExpectation.path === "/email-preferences" ? { "x-robots-tag": "noindex, nofollow" } : undefined,
          });
        }
      }

      throw new Error(`Unexpected fetch URL in local smoke test: ${url}`);
    });

    const summary = await runProductionSmokeCheck({
      marketingBaseUrl: "http://127.0.0.1:3000",
      appBaseUrl: "http://127.0.0.1:3000",
      apexBaseUrl: "",
      timeoutMs: 5000,
    });

    expect(summary.outcome).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_root_landing")?.status).toBe("skipped");
    expect(summary.steps.find((step) => step.id === "app_robots")?.status).toBe("skipped");
    expect(summary.steps.find((step) => step.id === "app_sitemap_absent")?.status).toBe("skipped");
    expect(summary.steps.find((step) => step.id === "app_email_preferences_canonical")?.status).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_access_denied_robots")?.status).toBe("pass");
  });

  it("marks production marketing-host drift as blocked instead of failed", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const redirectMode = init?.redirect ?? "follow";
      const marketingBaseUrl = "https://www.zokorp.com";
      const appBaseUrl = "https://app.zokorp.com";

      if (url === "http://example.com" || url === "https://vercel.com") {
        return mockResponse({ url, body: "ok" });
      }

      if (redirectMode === "manual") {
        if (url === "https://zokorp.com") {
          return mockResponse({
            status: 301,
            url,
            headers: { location: "https://www.zokorp.com/" },
          });
        }

        for (const redirect of LEGACY_REDIRECT_EXPECTATIONS) {
          if (url === `https://www.zokorp.com${redirect.from}`) {
            return mockResponse({
              status: 308,
              url,
              headers: { location: `https://app.zokorp.com${redirect.to}` },
            });
          }
        }

        for (const redirect of APP_HOST_MARKETING_REDIRECT_EXPECTATIONS) {
          if (url === `https://app.zokorp.com${redirect.path}`) {
            return mockResponse({
              status: 308,
              url,
              headers: { location: `https://www.zokorp.com${redirect.path}` },
            });
          }
        }

        for (const redirect of APP_SIGNED_OUT_REDIRECT_EXPECTATIONS) {
          if (url === `https://app.zokorp.com${redirect.path}`) {
            return mockResponse({
              status: 307,
              url,
              headers: { location: `https://app.zokorp.com${redirect.expectedLocation}` },
            });
          }
        }
      }

      if (url === `${marketingBaseUrl}/robots.txt`) {
        return mockResponse({
          url,
          body: "User-agent: *\nSitemap: https://www.zokorp.com/sitemap.xml\n",
        });
      }

      if (url === `${marketingBaseUrl}/sitemap.xml`) {
        return mockResponse({
          url,
          body: "<urlset><url><loc>https://www.zokorp.com/</loc></url></urlset>",
        });
      }

      if (url === `${appBaseUrl}/robots.txt`) {
        return mockResponse({
          url,
          body: "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\n",
        });
      }

      if (url === `${appBaseUrl}/sitemap.xml`) {
        return mockResponse({
          status: 404,
          url,
          body: "Not Found",
        });
      }

      for (const route of MARKETING_ROUTE_EXPECTATIONS) {
        if (url === `${marketingBaseUrl}${route.path}`) {
          return mockResponse({
            url: `${appBaseUrl}${route.path}`,
            body: route.marker,
          });
        }
      }

      if (url === `${appBaseUrl}${APP_ROOT_EXPECTATION.path}`) {
        return htmlResponse({
          url,
          body: APP_ROOT_EXPECTATION.marker,
          canonicalUrl: `${appBaseUrl}${APP_ROOT_EXPECTATION.path}`,
          robotsContent: APP_ROOT_EXPECTATION.expectedRobotsContent,
          headers: { "x-robots-tag": APP_ROOT_EXPECTATION.expectedRobotsHeader },
        });
      }

      for (const route of APP_ROUTE_EXPECTATIONS) {
        if (url === `${appBaseUrl}${route.path}`) {
          return htmlResponse({
            url,
            body: route.marker,
            canonicalUrl: route.expectedCanonicalHost
              ? `${route.expectedCanonicalHost === "app" ? appBaseUrl : marketingBaseUrl}${route.path}`
              : undefined,
            robotsContent: route.expectedRobotsContent,
            headers: route.expectedRobotsHeader ? { "x-robots-tag": route.expectedRobotsHeader } : undefined,
          });
        }
      }

      for (const product of APP_PRODUCT_EXPECTATIONS) {
        if (url === `${appBaseUrl}${product.path}`) {
          return htmlResponse({
            url,
            body: product.titleMarker,
            canonicalUrl: `${marketingBaseUrl}${product.path}`,
            robotsContent: "noindex,follow",
            headers: { "x-robots-tag": "noindex, follow" },
          });
        }
      }

      for (const metaExpectation of APP_META_EXPECTATIONS) {
        if (url === `${appBaseUrl}${metaExpectation.path}`) {
          return htmlResponse({
            url,
            body: metaExpectation.label,
            canonicalUrl: metaExpectation.expectedCanonicalHost ? `${appBaseUrl}${metaExpectation.path}` : undefined,
            robotsContent: metaExpectation.expectedRobotsContent,
            headers: metaExpectation.expectedRobotsContent?.includes("nofollow")
              ? { "x-robots-tag": "noindex, nofollow" }
              : undefined,
          });
        }
      }

      throw new Error(`Unexpected fetch URL in blocked smoke test: ${url}`);
    });

    const summary = await runProductionSmokeCheck({
      marketingBaseUrl: "https://www.zokorp.com",
      appBaseUrl: "https://app.zokorp.com",
      apexBaseUrl: "https://zokorp.com",
      timeoutMs: 5000,
    });

    expect(summary.outcome).toBe("blocked");
    expect(summary.steps.find((step) => step.id === "marketing_homepage")?.status).toBe("blocked");
    expect(summary.steps.find((step) => step.id === "app_root_landing")?.status).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_marketing_redirect_contact")?.status).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_account_redirect_to_login")?.status).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_login")?.status).toBe("pass");
    expect(summary.steps.some((step) => step.status === "fail")).toBe(false);
  });

  it("accepts preview JOURNEY base URLs when SMOKE variables are not set", async () => {
    process.env.JOURNEY_MARKETING_BASE_URL = "https://preview-www.example";
    process.env.JOURNEY_APP_BASE_URL = "https://preview-app.example";
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET = "preview-bypass-secret";

    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const requestHeaders = new Headers(init?.headers);

      if (url === "http://example.com" || url === "https://vercel.com") {
        expect(requestHeaders.get("x-vercel-protection-bypass")).toBe("preview-bypass-secret");
        return mockResponse({ url, body: "ok" });
      }

      if (url === "https://preview-www.example/robots.txt") {
        expect(requestHeaders.get("x-vercel-protection-bypass")).toBe("preview-bypass-secret");
        return mockResponse({
          url,
          body: "User-agent: *\nSitemap: https://preview-www.example/sitemap.xml\n",
        });
      }

      if (url === "https://preview-www.example/sitemap.xml") {
        expect(requestHeaders.get("x-vercel-protection-bypass")).toBe("preview-bypass-secret");
        return mockResponse({
          url,
          body: "<urlset><url><loc>https://preview-www.example/</loc></url></urlset>",
        });
      }

      if (url === "https://preview-www.example/") {
        expect(requestHeaders.get("x-vercel-protection-bypass")).toBe("preview-bypass-secret");
        return htmlResponse({
          url,
          body: MARKETING_ROUTE_EXPECTATIONS.find((route) => route.path === "/")?.marker ?? "homepage",
          canonicalUrl: "https://preview-www.example/",
        });
      }

      if (url === "https://preview-app.example/") {
        expect(requestHeaders.get("x-vercel-protection-bypass")).toBe("preview-bypass-secret");
        return htmlResponse({
          url,
          body: APP_ROOT_EXPECTATION.marker,
          canonicalUrl: "https://preview-app.example/",
          robotsContent: APP_ROOT_EXPECTATION.expectedRobotsContent,
          headers: { "x-robots-tag": APP_ROOT_EXPECTATION.expectedRobotsHeader },
        });
      }

      if (url === "https://preview-app.example/robots.txt") {
        expect(requestHeaders.get("x-vercel-protection-bypass")).toBe("preview-bypass-secret");
        return mockResponse({
          url,
          body: "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\n",
        });
      }

      if (url === "https://preview-app.example/sitemap.xml") {
        expect(requestHeaders.get("x-vercel-protection-bypass")).toBe("preview-bypass-secret");
        return mockResponse({
          status: 404,
          url,
          body: "Not Found",
        });
      }

      throw new Error(`Unexpected fetch URL in preview env smoke test: ${url}`);
    });

    const summary = await runProductionSmokeCheck({
      timeoutMs: 5000,
    });

    expect(summary.baseUrls.marketing).toBe("https://preview-www.example");
    expect(summary.baseUrls.app).toBe("https://preview-app.example");
    expect(summary.steps.find((step) => step.id === "marketing_homepage")?.status).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_root_landing")?.status).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_robots")?.status).toBe("pass");
    expect(summary.steps.find((step) => step.id === "app_sitemap_absent")?.status).toBe("pass");
  });
});
