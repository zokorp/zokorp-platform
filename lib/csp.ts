type BuildContentSecurityPolicyOptions = {
  gaMeasurementId?: string | null;
  nodeEnv?: string | null;
  reportUri?: string | null;
};

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function buildContentSecurityPolicy(options: BuildContentSecurityPolicyOptions = {}) {
  const nodeEnv =
    ("nodeEnv" in options ? normalizeValue(options.nodeEnv) : null) ?? process.env.NODE_ENV ?? "development";
  const gaMeasurementId =
    ("gaMeasurementId" in options ? normalizeValue(options.gaMeasurementId) : null) ??
    normalizeValue(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const reportUri =
    ("reportUri" in options ? normalizeValue(options.reportUri) : null) ?? "/api/security/csp-report";
  const hasGa = Boolean(gaMeasurementId);

  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (nodeEnv !== "production") {
    scriptSrc.push("'unsafe-eval'");
  }
  if (hasGa) {
    scriptSrc.push("https://www.googletagmanager.com");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com https://billing.stripe.com https://*.stripe.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    reportUri ? `report-uri ${reportUri}` : "",
    nodeEnv === "production" ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
