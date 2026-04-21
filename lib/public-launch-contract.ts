export const PUBLIC_LAUNCH_CONTACT = {
  primaryEmail: "consulting@zokorp.com",
  location: "Houston, TX",
  linkedInUrl: "https://www.linkedin.com/in/zohaib-khawaja/",
  githubUrl: "https://github.com/zokorp/zokorp-platform",
  bookingUrl: "https://zokorpconsulting.zohobookings.com/#/4757126000000052054",
  responseWindowLabel: "Initial response within one business day",
  securityResponseLabel: "Urgent security issues are prioritized the same business day when possible",
  bookingLabel: "Request a call",
  primaryHumanPathLabel: "Public requests go through the contact form first. Clear scope is confirmed before work starts.",
} as const;

export const PUBLIC_LAUNCH_FOUNDER_PROFILE = {
  name: "Zohaib Khawaja",
  role: "Founder, ZoKorp",
  formerRoleLabel: "Former AWS Partner Solutions Architect",
  currentRoleLabel: "Microsoft",
  headshotPath: "/founder/zohaib-khawaja.jpg",
  logoPath: "/brand/zokorp-logo.png",
  summary:
    "Small practice. Direct technical judgment. Clear scope before work starts.",
  credentials: [
    "AWS Certified Solutions Architect - Professional",
    "AWS Certified Machine Learning - Specialty",
    "AWS Certified Security - Specialty",
  ],
  backgroundCompanies: [
    "Amazon Web Services",
    "Microsoft",
    "Nordic Global",
  ],
  highlights: [
    "Named founder and named background.",
    "Visible certifications and a real location.",
    "Public pages first. Account access when useful.",
  ],
} as const;

export const PUBLIC_LAUNCH_PROOF_ASSET = {
  title: "Approved public proof only",
  summary:
    "ZoKorp keeps public proof tight: named founder, named background, visible certifications, Houston, TX, and clear scope before work starts. No fake logos. No invented guarantees.",
  highlights: [
    "Employer background appears once, not everywhere.",
    "Certifications are stated directly.",
    "Initial response stays within one business day.",
  ],
} as const;

export const PUBLIC_LAUNCH_POLICY_NOTES = {
  pricing:
    "Public pricing stays useful, but broader implementation still moves through estimate-first scoping.",
  services:
    "Scope is confirmed before paid consulting, remediation, or implementation work is accepted.",
  proof:
    "No client logos, testimonials, case studies, guarantees, or metrics are published without approval.",
} as const;
