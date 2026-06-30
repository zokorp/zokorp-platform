type BuildContentSecurityPolicyOptions = {
  gaMeasurementId?: string | null;
  nodeEnv?: string | null;
  reportUri?: string | null;
  nonce?: string | null;
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
  const nonce = "nonce" in options ? normalizeValue(options.nonce) : null;
  const hasGa = Boolean(gaMeasurementId);

  // SEC-06: when a per-request nonce is supplied (by proxy.ts middleware), use nonce + 'strict-dynamic'
  // instead of 'unsafe-inline'. Supporting browsers trust the nonce'd bootstrap and the scripts it
  // loads (ignoring host allowlists); 'self' and the GA host remain as fallbacks for engines without
  // strict-dynamic. The no-nonce branch preserves the historical policy for any caller that builds the
  // CSP without a nonce.
  const scriptSrc = ["'self'"];
  if (nonce) {
    scriptSrc.push(`'nonce-${nonce}'`, "'strict-dynamic'");
  } else {
    scriptSrc.push("'unsafe-inline'");
  }
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
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com https://www.youtube.com https://www.youtube-nocookie.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    reportUri ? `report-uri ${reportUri}` : "",
    nodeEnv === "production" ? "upgrade-insecure-requests" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
