export function getSiteOriginFromRequest(request: Request): string {
  const fallback = new URL(request.url).origin;
  const raw = process.env.NEXT_PUBLIC_SITE_URL;

  if (!raw) {
    return fallback;
  }

  const cleaned = raw.replaceAll("\\n", "").replaceAll("\\r", "").trim();
  if (!cleaned) {
    return fallback;
  }

  try {
    return new URL(cleaned).origin;
  } catch {
    return fallback;
  }
}
