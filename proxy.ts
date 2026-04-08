import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getAppSiteUrl, getMarketingSiteUrl } from "@/lib/site";

const APEX_HOST = "zokorp.com";
const MARKETING_HOST = new URL(getMarketingSiteUrl()).host;
const APP_HOST = new URL(getAppSiteUrl()).host;
const STATIC_FILE_PATH = /\.[a-z0-9]+$/i;
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
  if (pathname === "/case-studies") {
    return "/about";
  }

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

function isRenderablePage(pathname: string) {
  return !pathname.startsWith("/_next/") && !pathname.startsWith("/api/") && !STATIC_FILE_PATH.test(pathname);
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

  if (host === MARKETING_HOST && isAppOnlyPage(nextPathname)) {
    return redirectToHost(request, APP_HOST, nextPathname);
  }

  if (host === APP_HOST && pathname === "/") {
    return redirectToHost(request, APP_HOST, "/software");
  }

  if (nextPathname !== pathname) {
    return redirectToHost(request, host, nextPathname);
  }

  const response = NextResponse.next();

  if (host === APP_HOST && isRenderablePage(pathname)) {
    response.headers.set("x-robots-tag", "noindex, follow");
  }

  return response;
}

export const config = {
  matcher: ["/:path*"],
};
