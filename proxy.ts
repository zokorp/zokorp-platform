import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/csp";
import { getAppSiteUrl, getMarketingSiteUrl } from "@/lib/site";

const APEX_HOST = "zokorp.com";
const MARKETING_HOST = new URL(getMarketingSiteUrl()).host;
const APP_HOST = new URL(getAppSiteUrl()).host;
const STATIC_FILE_PATH = /\.[a-z0-9]+$/i;
const APP_INTERNAL_LANDING_PATH = "/app-home";
const APP_ONLY_PATH_PREFIXES = [
  "/login",
  "/register",
  "/account",
  "/admin",
  "/email-preferences",
  "/access-denied",
  "/forbidden",
];
const LEGACY_PAGE_REDIRECTS = new Map([
  ["/about-us", "/about"],
  ["/our-services", "/services"],
  ["/contact-us", "/contact"],
]);
const APP_HOST_MARKETING_PATH_PREFIXES = [
  "/about",
  "/case-studies",
  "/contact",
  "/media",
  "/pricing",
  "/privacy",
  "/refunds",
  "/security",
  "/services",
  "/support",
  "/terms",
];

function redirectToHost(request: NextRequest, nextHost: string, pathname: string, status = 308) {
  const destination = request.nextUrl.clone();
  const isLocalhostTarget =
    nextHost === "localhost" ||
    nextHost.startsWith("localhost:") ||
    nextHost === "127.0.0.1" ||
    nextHost.startsWith("127.0.0.1:");

  destination.protocol = isLocalhostTarget ? request.nextUrl.protocol : "https:";
  destination.host = nextHost;
  destination.pathname = pathname;
  return NextResponse.redirect(destination, status);
}

function normalizedPathname(pathname: string) {
  const legacyPageRedirect = LEGACY_PAGE_REDIRECTS.get(pathname);
  if (legacyPageRedirect) {
    return legacyPageRedirect;
  }

  if (pathname === "/blog" || pathname.startsWith("/blog/")) {
    return "/media";
  }

  return pathname;
}

function isAppOnlyPage(pathname: string) {
  return APP_ONLY_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAppLandingPath(pathname: string) {
  return pathname === "/" || pathname === APP_INTERNAL_LANDING_PATH;
}

function isAppHostMarketingPage(pathname: string) {
  return APP_HOST_MARKETING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isRenderablePage(pathname: string) {
  return !pathname.startsWith("/_next/") && !pathname.startsWith("/api/") && !STATIC_FILE_PATH.test(pathname);
}

// SEC-06/07: a prefetch should not receive (and cache) a per-request nonce CSP — its scripts run in
// the eventual real navigation, which gets its own nonce.
function isPrefetchRequest(request: NextRequest) {
  return (
    request.headers.get("next-router-prefetch") !== null ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("x-middleware-prefetch") !== null
  );
}

// SEC-06: generate a per-request nonce and the matching CSP, and forward the nonce to the renderer via
// the request headers (Next reads the nonce from the request Content-Security-Policy header and
// applies it to its framework scripts) so we can drop 'unsafe-inline' from script-src.
function buildNonceCspContext(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildContentSecurityPolicy({ nonce });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  return { csp, requestHeaders };
}

function buildAppHostRobotsBody() {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /account",
    "Disallow: /admin",
    "Disallow: /email-preferences",
    "Disallow: /access-denied",
    "Disallow: /forbidden",
    "",
  ].join("\n");
}

function appRobotsHeaderValue(pathname: string) {
  if (isAppOnlyPage(pathname) || isAppLandingPath(pathname)) {
    return "noindex, nofollow";
  }

  return "noindex, follow";
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.trim().toLowerCase();
  const pathname = request.nextUrl.pathname;
  const nextPathname = normalizedPathname(pathname);

  if (!host) {
    return NextResponse.next();
  }

  if (host === APEX_HOST) {
    return redirectToHost(request, MARKETING_HOST, nextPathname, 301);
  }

  if (host === APP_HOST && pathname === "/robots.txt") {
    return new NextResponse(buildAppHostRobotsBody(), {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
        "x-robots-tag": "noindex, follow",
      },
    });
  }

  if (host === APP_HOST && pathname === "/sitemap.xml") {
    return new NextResponse("Not Found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=0, must-revalidate",
      },
    });
  }

  if (host === MARKETING_HOST && isAppOnlyPage(nextPathname)) {
    return redirectToHost(request, APP_HOST, nextPathname);
  }

  if (host === MARKETING_HOST && nextPathname === APP_INTERNAL_LANDING_PATH) {
    return redirectToHost(request, APP_HOST, "/");
  }

  if (host === APP_HOST && pathname === APP_INTERNAL_LANDING_PATH) {
    return redirectToHost(request, APP_HOST, "/");
  }

  if (host === APP_HOST && isAppHostMarketingPage(nextPathname)) {
    return redirectToHost(request, MARKETING_HOST, nextPathname);
  }

  if (nextPathname !== pathname) {
    return redirectToHost(request, host, nextPathname);
  }

  const renderable = isRenderablePage(pathname);
  // Apply the nonce CSP to real HTML page renders only — not assets, API routes, or prefetches.
  const cspContext = renderable && !isPrefetchRequest(request) ? buildNonceCspContext(request) : null;
  const requestInit = cspContext ? { request: { headers: cspContext.requestHeaders } } : undefined;

  const response =
    host === APP_HOST && pathname === "/"
      ? NextResponse.rewrite(new URL(APP_INTERNAL_LANDING_PATH, request.url), requestInit)
      : NextResponse.next(requestInit);

  if (cspContext) {
    response.headers.set("content-security-policy", cspContext.csp);
  }

  if (host === APP_HOST && renderable) {
    response.headers.set("x-robots-tag", appRobotsHeaderValue(pathname));
  }

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
