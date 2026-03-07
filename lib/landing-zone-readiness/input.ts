import { LANDING_ZONE_BLOCKED_EMAIL_DOMAINS } from "@/lib/landing-zone-readiness/config";
import { getEmailDomain } from "@/lib/security";

const blockedDomains = new Set<string>(LANDING_ZONE_BLOCKED_EMAIL_DOMAINS);

export function isAllowedLandingZoneBusinessEmail(email: string) {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  return !blockedDomains.has(domain);
}

export function normalizeLandingZoneWebsite(website: string) {
  const trimmed = website.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
