import disposableEmailDomains from "disposable-email-domains";
import { getDomain } from "tldts";

import {
  DISPOSABLE_EMAIL_DOMAIN_ADDITIONS,
  DISPOSABLE_EMAIL_DOMAIN_ALLOWLIST,
} from "@/lib/email-domain-overrides";

const MAX_UPLOAD_MB_FALLBACK = 10;

// GATE-01: the gate is a best-effort denylist, not a guarantee. The copy reflects that rather than
// overstating it ("Personal email domains are not allowed").
export const BUSINESS_EMAIL_REQUIRED_MESSAGE =
  "Please sign up with your work email — common personal and disposable email providers aren't accepted for this tool.";

// Consumer / personal mailbox hosts. Edit this list to add or remove a domain.
const CONSUMER_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.co.jp",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "tutanota.com",
  "tutamail.com",
  "tuta.io",
  "gmx.com",
  "gmx.net",
  "gmx.de",
  "yandex.com",
  "yandex.ru",
  "mail.ru",
  "mail.com",
  "zoho.com",
  "fastmail.com",
  "fastmail.fm",
  "hushmail.com",
  "inbox.com",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "naver.com",
  "daum.net",
  "hanmail.net",
  "rediffmail.com",
];

// Disposable / temporary inbox services. Edit this list to add or remove a domain.
const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "yopmail.com",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "tempr.email",
  "throwaway.email",
  "throwawaymail.com",
  "maildrop.cc",
  "10minutemail.com",
  "10minutemail.net",
  "trashmail.com",
  "trashmail.de",
  "getnada.com",
  "nada.email",
  "mohmal.com",
  "emailondeck.com",
  "mintemail.com",
  "spambox.us",
  "discard.email",
  "dispostable.com",
  "fakeinbox.com",
  "mytemp.email",
  "mailnesia.com",
  "spam4.me",
  "dropmail.me",
  "mailcatch.com",
  "mvrht.net",
  "33mail.com",
  "moakt.com",
  "wegwerfmail.de",
  "anonbox.net",
  "incognitomail.org",
  "burnermail.io",
  "fakemail.net",
];

// GATE-01: combine the curated consumer list + the small inline disposable backstop + the vendored,
// regularly-refreshed `disposable-email-domains` dataset (~120k domains) + local abuse-log additions,
// minus any explicit allowlist. Built once at module load into a Set for O(1) lookups.
const DISPOSABLE_ALLOWLIST = new Set(DISPOSABLE_EMAIL_DOMAIN_ALLOWLIST.map((domain) => domain.toLowerCase()));
const FREE_EMAIL_DOMAINS = new Set<string>(
  [
    ...CONSUMER_EMAIL_DOMAINS,
    ...DISPOSABLE_EMAIL_DOMAINS,
    ...disposableEmailDomains,
    ...DISPOSABLE_EMAIL_DOMAIN_ADDITIONS,
  ]
    .map((domain) => domain.toLowerCase())
    .filter((domain) => !DISPOSABLE_ALLOWLIST.has(domain)),
);

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([".pdf", ".xlsx"]);

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
type SupportedUploadKind = "pdf" | "xlsx";

export function parseAdminEmails(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function getEmailDomain(email: string): string | null {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[1]) {
    return null;
  }

  return parts[1];
}

// GATE-03: match on the registrable domain (eTLD+1) as well as the exact host, so a per-user subdomain
// of a blocked provider (e.g. mail.gmail.com -> gmail.com) is also caught.
export function getRegistrableEmailDomain(email: string): string | null {
  const host = getEmailDomain(email);
  if (!host) {
    return null;
  }
  return getDomain(host) ?? host;
}

export function isBusinessEmail(email: string): boolean {
  const host = getEmailDomain(email);
  if (!host) {
    return false;
  }

  if (FREE_EMAIL_DOMAINS.has(host)) {
    return false;
  }

  const registrable = getDomain(host);
  if (registrable && FREE_EMAIL_DOMAINS.has(registrable)) {
    return false;
  }

  return true;
}

function startsWithBytes(buffer: Buffer, bytes: number[]) {
  if (buffer.length < bytes.length) {
    return false;
  }

  return bytes.every((byte, index) => buffer[index] === byte);
}

function detectByMagic(buffer: Buffer): SupportedUploadKind | null {
  if (startsWithBytes(buffer, PDF_MAGIC)) {
    return "pdf";
  }

  if (startsWithBytes(buffer, ZIP_MAGIC)) {
    return "xlsx";
  }

  return null;
}

function detectByExtension(filename: string): SupportedUploadKind | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "pdf";
  }

  if (lower.endsWith(".xlsx")) {
    return "xlsx";
  }

  return null;
}

function detectByMime(mimeType: string): SupportedUploadKind | null {
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return "xlsx";
  }

  return null;
}

export function isAllowedFileType(filename: string, mimeType: string, buffer?: Buffer): boolean {
  const extensionAllowed = [...ALLOWED_UPLOAD_EXTENSIONS].some((ext) =>
    filename.toLowerCase().endsWith(ext),
  );
  const mimeAllowed = ALLOWED_UPLOAD_MIME_TYPES.has(mimeType);

  if (!extensionAllowed && !mimeAllowed) {
    return false;
  }

  if (!buffer) {
    return true;
  }

  const byMagic = detectByMagic(buffer);
  if (!byMagic) {
    return false;
  }

  const byExtension = detectByExtension(filename);
  const byMime = detectByMime(mimeType);

  return byMagic === byExtension || byMagic === byMime;
}

export function maxUploadBytes(maxUploadMb?: number): number {
  const mb = maxUploadMb && maxUploadMb > 0 ? maxUploadMb : MAX_UPLOAD_MB_FALLBACK;
  return mb * 1024 * 1024;
}
