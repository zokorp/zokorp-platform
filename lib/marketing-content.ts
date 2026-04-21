export type PublicServiceOffer = {
  slug: string;
  eyebrow: string;
  title: string;
  priceAnchor: string;
  summary: string;
  bullets: string[];
  included: string[];
  prominence: "primary" | "secondary";
};

export const MARKETING_TRUST_CHIPS: readonly string[] = [];

export const CONSULTING_OFFERS: PublicServiceOffer[] = [
  {
    slug: "architecture-review",
    eyebrow: "Start here",
    title: "Architecture Review",
    priceAnchor: "$249",
    summary: "A fast technical read with a clear next step.",
    bullets: [
      "Findings, not filler",
      "What to fix or validate next",
      "Best first buy when scope is still forming",
    ],
    included: [
      "Risks and gaps",
      "Next-step recommendation",
      "Founder review",
    ],
    prominence: "primary",
  },
  {
    slug: "cloud-cost-optimization-audit",
    eyebrow: "One-time audit",
    title: "Cloud Cost Optimization Audit",
    priceAnchor: "from $750",
    summary: "A bounded spend review with clear priorities.",
    bullets: [
      "Waste review with clear priorities",
      "Savings tied to real spend",
      "Best when the bill no longer fits the value",
    ],
    included: [
      "Spend review",
      "Savings priorities",
      "Remediation guidance",
    ],
    prominence: "primary",
  },
  {
    slug: "landing-zone-setup",
    eyebrow: "Fixed scope",
    title: "Landing Zone Setup",
    priceAnchor: "from $2,500",
    summary: "A clean baseline for identity, network, and security.",
    bullets: [
      "Security-first baseline",
      "Clean account and network structure",
      "Better footing before broader work",
    ],
    included: [
      "IAM baseline",
      "Network baseline",
      "Documented baseline",
    ],
    prominence: "primary",
  },
  {
    slug: "advisory-retainer",
    eyebrow: "Light support",
    title: "Advisory Retainer",
    priceAnchor: "from $1,500/month",
    summary: "Light continuity after the first scoped engagement.",
    bullets: [
      "Decision support without a managed-service contract",
      "Continuity after review or remediation work",
      "Business-hours support with visible expectations",
    ],
    included: [
      "Founder access",
      "Architecture guidance",
      "Follow-up support",
    ],
    prominence: "primary",
  },
  {
    slug: "readiness-validation-review",
    eyebrow: "Additional scoped work",
    title: "Readiness / Validation Review",
    priceAnchor: "from $1,500",
    summary: "A validation pass for teams that need evidence and pass/fail clarity.",
    bullets: [
      "Evidence-based findings",
      "Pass/fail output by control area",
      "Best once the architecture is stable",
    ],
    included: [
      "Control findings",
      "Remediation guidance",
      "Validation summary",
    ],
    prominence: "secondary",
  },
  {
    slug: "scoped-implementation",
    eyebrow: "Additional scoped work",
    title: "Scoped Implementation",
    priceAnchor: "from $1,250 per sprint or $149/hr",
    summary: "Hands-on follow-through once the next step is already clear.",
    bullets: [
      "Bounded implementation",
      "Clear stop point and handoff",
      "Used only when the work is specific enough to scope",
    ],
    included: [
      "Defined work scope",
      "Hands-on fixes",
      "Clear handoff",
    ],
    prominence: "secondary",
  },
] as const;

export const PRIMARY_CONSULTING_OFFERS = CONSULTING_OFFERS.filter((offer) => offer.prominence === "primary");
export const SECONDARY_CONSULTING_OFFERS = CONSULTING_OFFERS.filter((offer) => offer.prominence === "secondary");

export const SPECIALIST_ADVISORY = {
  title: "Specialist Advisory",
  priceAnchor: "from $3,500",
  summary: "Used only when the problem is narrow enough to scope.",
  bullets: [
    "Best for specialist AI or validation questions",
    "Secondary to the core review and setup work",
    "Scope before build work starts",
  ],
} as const;

export const SOFTWARE_HIGHLIGHTS = [
  {
    title: "Architecture Diagram Reviewer",
    href: "/software/architecture-diagram-reviewer",
    summary: "Review an architecture and get a concrete next step.",
    audience: "Teams that want fast cloud architecture feedback.",
    outcome: "Review findings and a clearer remediation path.",
    cta: "Open reviewer",
  },
  {
    title: "ZoKorpValidator",
    href: "/software/zokorp-validator",
    summary: "Run evidence-heavy validation without keeping it manual.",
    audience: "Teams that need repeatable validation output.",
    outcome: "Clearer validation output and a steadier workflow.",
    cta: "Open validator",
  },
  {
    title: "Forecasting beta",
    href: "/software/mlops-foundation-platform",
    summary: "A narrow forecasting workflow kept separate from general consulting.",
    audience: "Teams evaluating a focused forecasting workflow.",
    outcome: "Public product context before signup or billing.",
    cta: "View beta",
  },
] as const;

export const HOME_ICP_CONTENT = {
  eyebrow: "Who this is for",
  title: "Who ZoKorp works with.",
  goodFit: {
    heading: "Good fit",
    items: [
      "Engineering teams at 10–200 person companies making a first cloud move or scaling an existing one",
      "CTOs and VPs of Engineering who need a fast, credible outside read before committing to a direction",
      "Startups preparing for Series A infrastructure audits or SOC 2 / HIPAA readiness",
      "Teams that have cloud costs growing faster than they can explain",
      "Organizations building or operationalizing AI/ML pipelines on AWS or Azure",
    ],
  },
  notFit: {
    heading: "Not the right fit",
    items: [
      "Companies that need a large systems integration team or staff augmentation",
      "Projects requiring on-site presence or embedded resourcing",
      "Organizations that want a vendor managing infrastructure long-term — we scope, deliver, and hand off, we don't operate",
    ],
  },
} as const;

export const HOME_PROCESS_STEPS = [
  {
    title: "Pick a starting point",
    body: "Choose the service that matches your situation. If you're unsure, start with the $249 Architecture Review — it's designed to clarify the next step.",
  },
  {
    title: "Short fit check, or just buy",
    body: "For the $249 Architecture Review, no call is required — submit and we begin. For larger engagements, a 15-minute fit check comes first to confirm scope and timeline.",
  },
  {
    title: "Scoped delivery and written handoff",
    body: "Every engagement runs under a signed SOW. Deliverables are written, not presentation-based. You own the output.",
  },
] as const;

export const HOME_PAGE_CONTENT = {
  hero: {
    eyebrow: "Founder-led cloud consulting",
    title: "Scoped cloud reviews, starting at $249.",
    lede: "Architecture reviews, cost audits, and landing-zone setup — fixed scope, visible price, delivered by a certified founder. No retainers to unwind, no surprises at invoice time.",
    postLede: "Most engagements start with a $249 Architecture Review. No call required to begin.",
    supportingBullets: [
      "Fixed price, before you commit",
      "Initial response within one business day",
      "Written handoff, not a deck",
    ],
  },
  founderTitle: "Founder-led",
  founderSummary: "Small practice. Clear scope. Direct follow-through.",
  offersTitle: "Start with one path",
  offersIntro: "Four scoped entry points. No generic bundle.",
  softwareTitle: "Public tools first",
  softwareIntro: "See the product before signup or billing.",
} as const;

export const SERVICES_PAGE_CONTENT = {
  hero: {
    eyebrow: "Services",
    title: "Choose one starting point.",
    lede: "Start with a review, cost audit, setup, or retainer. Broader work only after the path is clear.",
    supportingBullets: [
      "Visible starting prices",
      "Estimate-first scoping",
      "One-business-day response",
    ],
  },
  primaryTitle: "Primary services",
  primaryIntro: "Pick the first move, not a generic package.",
  entryPointNote:
    "Not sure where to start? The Architecture Review ($249) is designed to answer exactly that.",
  secondaryTitle: "Additional scoped work",
  secondarySummary: "Validation and implementation stay available, but not as the first buy.",
  requestTitle: "Follow-up",
  requestIntro: "Request a scoped response.",
} as const;

export const SERVICES_INCLUDED_ITEMS: readonly {
  label: string;
  detail: string;
}[] = [
  {
    label: "Signed SOW before work begins",
    detail: "No billable work starts without a written scope both sides have agreed to.",
  },
  {
    label: "Written deliverables — reports, not slide decks",
    detail: "Findings and recommendations land as documents you can circulate and act on.",
  },
  {
    label: "Founder delivery",
    detail: "Zohaib on every project — not a junior analyst, not an account manager.",
  },
  {
    label: "Written follow-up included",
    detail: "Each engagement includes a set number of written follow-up questions. Terms vary by engagement.",
  },
  {
    label: "One-business-day response",
    detail: "Initial response within one business day of contact.",
  },
] as const;

export const ABOUT_PAGE_CONTENT = {
  hero: {
    eyebrow: "About",
    title: "Founder-led cloud work, shown in public.",
    lede:
      "The panels, workshops, event rooms, and interview footage here show the communication style behind ZoKorp.",
    supportingBullets: [
      "AWS certifications",
      "Houston, TX",
      "Small operating model",
    ],
  },
} as const;

export const PRICING_PAGE_CONTENT = {
  hero: {
    eyebrow: "Pricing",
    title: "Visible price anchors first.",
    lede: "Use the public numbers first. Quote only what still needs scoping.",
    supportingBullets: [
      "Visible starting prices",
      "What is included",
      "Estimate-first for broader work",
    ],
  },
  consultingTitle: "Consulting offers",
  consultingIntro: "Read the table, then request follow-up only if the scope still needs work.",
  secondarySummary: "Validation and implementation are available, but not the first buy.",
  softwareTitle: "Software pricing",
} as const;

export const SOFTWARE_PAGE_CONTENT = {
  hero: {
    eyebrow: "Software",
    title: "See the product first.",
    lede: "Browse publicly. Create an account only when access, history, or billing matters.",
    supportingBullets: [
      "What it does",
      "Who it is for",
      "What you get",
    ],
  },
  spotlightTitle: "Public product paths",
  spotlightIntro: "Each product should scan in seconds.",
  accessSummary: "Public pages on `www`. Usage and billing in `app`.",
} as const;

export const CONTACT_PAGE_CONTENT = {
  eyebrow: "Contact",
  title: "Two ways to get started.",
  lede: "Book a fit check (fastest) or send a message below. Public requests go to consulting@zokorp.com. Initial response within one business day.",
} as const;
