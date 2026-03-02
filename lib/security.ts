const MAX_UPLOAD_MB_FALLBACK = 10;

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([".pdf", ".xlsx", ".xls"]);

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

export function isAllowedFileType(filename: string, mimeType: string): boolean {
  const lower = filename.toLowerCase();
  const extensionAllowed = [...ALLOWED_UPLOAD_EXTENSIONS].some((ext) => lower.endsWith(ext));
  const mimeAllowed = ALLOWED_UPLOAD_MIME_TYPES.has(mimeType);

  return extensionAllowed && mimeAllowed;
}

export function maxUploadBytes(maxUploadMb?: number): number {
  const mb = maxUploadMb && maxUploadMb > 0 ? maxUploadMb : MAX_UPLOAD_MB_FALLBACK;
  return mb * 1024 * 1024;
}
