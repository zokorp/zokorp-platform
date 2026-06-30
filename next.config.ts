import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { shouldUploadSentrySourceMaps } from "./lib/sentry-config";

// SEC-06/07: the Content-Security-Policy is now emitted per-request by proxy.ts (the Next 16
// middleware) so it can carry a per-request nonce and drop 'unsafe-inline'. The remaining static
// security headers stay here. HSTS is emitted in every environment (preview and production); browsers
// ignore it over plain http (local dev), so an always-on value is safe and closes the SEC-07 gap
// where these headers were only set when NODE_ENV=production.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

const sentrySourceMapUploadEnabled = shouldUploadSentrySourceMaps();

export default sentrySourceMapUploadEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
