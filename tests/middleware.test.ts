import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

describe("host routing proxy", () => {
  it("redirects apex traffic to canonical www and preserves path/query", () => {
    const request = new NextRequest("https://zokorp.com/pricing?plan=ftr", {
      headers: {
        host: "zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://www.zokorp.com/pricing?plan=ftr");
  });

  it("rewrites app root traffic into the app landing page and keeps it noindex", () => {
    const request = new NextRequest("https://app.zokorp.com/", {
      headers: {
        host: "app.zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("redirects legacy Squarespace pages to the current marketing IA", () => {
    const request = new NextRequest("https://www.zokorp.com/about-us", {
      headers: {
        host: "www.zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://www.zokorp.com/about");
  });

  it("redirects legacy blog pages to media", () => {
    const request = new NextRequest("https://www.zokorp.com/blog/gemma-2", {
      headers: {
        host: "www.zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://www.zokorp.com/media");
  });

  it("redirects marketing-host auth pages to the app host", () => {
    const request = new NextRequest("https://www.zokorp.com/register?callbackUrl=%2Fsoftware", {
      headers: {
        host: "www.zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://app.zokorp.com/register?callbackUrl=%2Fsoftware");
  });

  it("redirects app-host marketing pages to the canonical marketing host", () => {
    const request = new NextRequest("https://app.zokorp.com/contact", {
      headers: {
        host: "app.zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://www.zokorp.com/contact");
  });

  it.each(["/login", "/register", "/account"])("marks protected app route %s as noindex", (path) => {
    const request = new NextRequest(`https://app.zokorp.com${path}`, {
      headers: {
        host: "app.zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("leaves canonical marketing traffic alone", () => {
    const request = new NextRequest("https://www.zokorp.com/contact", {
      headers: {
        host: "www.zokorp.com",
      },
    });

    const response = proxy(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("sets a per-request nonce CSP on rendered pages but not on redirects (SEC-06/07)", () => {
    const pageResponse = proxy(
      new NextRequest("https://www.zokorp.com/services", { headers: { host: "www.zokorp.com" } }),
    );
    const csp = pageResponse.headers.get("content-security-policy");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toMatch(/'nonce-[^']+'/);
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");

    const redirectResponse = proxy(
      new NextRequest("https://zokorp.com/services", { headers: { host: "zokorp.com" } }),
    );
    expect(redirectResponse.status).toBe(301);
    expect(redirectResponse.headers.get("content-security-policy")).toBeNull();
  });

  it("does not attach a nonce CSP to prefetch requests (SEC-06)", () => {
    const response = proxy(
      new NextRequest("https://www.zokorp.com/services", {
        headers: { host: "www.zokorp.com", "next-router-prefetch": "1" },
      }),
    );
    expect(response.headers.get("content-security-policy")).toBeNull();
  });
});
