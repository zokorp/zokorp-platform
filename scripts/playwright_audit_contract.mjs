export const MARKETING_ROUTE_EXPECTATIONS = [
  {
    path: "/",
    label: "Homepage",
    marker: "Scoped cloud reviews, starting at $249.",
  },
  {
    path: "/services",
    label: "Services",
    marker: "Choose one starting point.",
  },
  {
    path: "/about",
    label: "About",
    marker: "Founder-led cloud work, shown in public.",
  },
  {
    path: "/contact",
    label: "Contact",
    marker: "Two ways to get started.",
  },
  {
    path: "/pricing",
    label: "Pricing",
    marker: "See the prices first.",
  },
  {
    path: "/software",
    label: "Software",
    marker: "Public products first.",
  },
  {
    path: "/media",
    label: "Insights",
    marker: "Short notes. Real operating detail.",
  },
  {
    path: "/privacy",
    label: "Privacy",
    marker: "Privacy overview",
  },
  {
    path: "/terms",
    label: "Terms",
    marker: "Platform terms",
  },
  {
    path: "/refunds",
    label: "Refunds",
    marker: "Refund posture",
  },
  {
    path: "/security",
    label: "Security",
    marker: "Current platform security posture",
  },
  {
    path: "/support",
    label: "Support",
    marker: "Platform support.",
  },
];

export const APP_ROOT_EXPECTATION = {
  path: "/",
  label: "App landing",
  marker: "Account access and software live here. Company browsing and services stay on",
  expectedCanonicalHost: "app",
  expectedRobotsHeader: "noindex, nofollow",
  expectedRobotsContent: "noindex,nofollow",
};

export const APP_ROUTE_EXPECTATIONS = [
  {
    path: "/login",
    label: "Login",
    marker: "Sign in",
    expectedCanonicalHost: "app",
    expectedRobotsHeader: "noindex, nofollow",
    expectedRobotsContent: "noindex,nofollow",
  },
  {
    path: "/register",
    label: "Register",
    marker: "Create account",
    expectedCanonicalHost: "app",
    expectedRobotsHeader: "noindex, nofollow",
    expectedRobotsContent: "noindex,nofollow",
  },
  {
    path: "/software",
    label: "Software hub",
    marker: "Public products first.",
    expectedCanonicalHost: "marketing",
    expectedRobotsHeader: "noindex, follow",
  },
  {
    path: "/software/architecture-diagram-reviewer/sample-report",
    label: "Architecture reviewer sample report",
    marker: "Architecture Diagram Reviewer Sample Report",
    expectedCanonicalHost: "marketing",
    expectedRobotsHeader: "noindex, follow",
  },
];

export const APP_HOST_MARKETING_REDIRECT_EXPECTATIONS = [
  { path: "/services", label: "Services" },
  { path: "/about", label: "About" },
  { path: "/contact", label: "Contact" },
  { path: "/pricing", label: "Pricing" },
  { path: "/media", label: "Insights" },
  { path: "/privacy", label: "Privacy" },
  { path: "/terms", label: "Terms" },
  { path: "/refunds", label: "Refunds" },
  { path: "/security", label: "Security" },
  { path: "/support", label: "Support" },
];

export const APP_SIGNED_OUT_REDIRECT_EXPECTATIONS = [
  {
    path: "/account",
    label: "Account",
    expectedLocation: "/login?callbackUrl=%2Faccount",
  },
  {
    path: "/account/billing",
    label: "Billing",
    expectedLocation: "/login?callbackUrl=%2Faccount%2Fbilling",
  },
];

export const APP_PRODUCT_EXPECTATIONS = [
  {
    slug: "architecture-diagram-reviewer",
    label: "Architecture Diagram Reviewer",
    path: "/software/architecture-diagram-reviewer",
    titleMarker: "Architecture Diagram Reviewer",
    expectedCanonicalHost: "marketing",
    expectedRobotsHeader: "noindex, follow",
    publicMarkers: [
      "Verified business-email account required",
      "Sign in with your verified business email before running this diagnostic.",
    ],
    authenticatedMarkers: [
      "Architecture Description (required)",
    ],
  },
  {
    slug: "zokorp-validator",
    label: "ZoKorpValidator",
    path: "/software/zokorp-validator",
    titleMarker: "ZoKorpValidator",
    expectedCanonicalHost: "marketing",
    expectedRobotsHeader: "noindex, follow",
    publicMarkers: [
      "Sign in first",
      "Sign in first, then purchase the correct tier to unlock this tool.",
    ],
    authenticatedMarkers: [
      "Run ZoKorpValidator",
    ],
  },
  {
    slug: "mlops-foundation-platform",
    label: "ZoKorp Forecasting Beta",
    path: "/software/mlops-foundation-platform",
    titleMarker: "ZoKorp Forecasting Beta",
    expectedCanonicalHost: "marketing",
    expectedRobotsHeader: "noindex, follow",
    publicMarkers: [
      "Forecasting beta only",
      "Subscription required",
    ],
    authenticatedMarkers: [
      "Subscription required",
      "Active subscription",
    ],
  },
];

export const APP_META_EXPECTATIONS = [
  {
    id: "app_email_preferences_canonical",
    label: "Email preferences canonical",
    path: "/email-preferences",
    expectedCanonicalHost: "app",
    expectedRobotsContent: "noindex,nofollow",
  },
  {
    id: "app_access_denied_robots",
    label: "Access denied robots meta",
    path: "/access-denied",
    expectedCanonicalHost: "app",
    expectedRobotsContent: "noindex,nofollow",
  },
];

export const LEGACY_REDIRECT_EXPECTATIONS = [
  {
    from: "/about-us",
    to: "/about",
  },
  {
    from: "/our-services",
    to: "/services",
  },
  {
    from: "/contact-us",
    to: "/contact",
  },
  {
    from: "/blog",
    to: "/media",
  },
  {
    from: "/blog/example-post",
    to: "/media",
  },
];

export const MARKETING_PRIMARY_NAV_LABELS = ["Services", "Software", "Pricing", "About", "Case Studies", "Contact"];
export const MARKETING_MORE_MENU_LABELS = ["Insights", "Support"];
export const FOOTER_LEGAL_LINK_LABELS = ["Security", "Privacy", "Refunds", "Terms", "Support"];

export const CONSULTING_PRICE_MARKERS = [
  "$249",
  "from $750",
  "from $2,500",
  "from $1,500/month",
];
