const DEFAULT_CALLBACK_URL = "/account";

export function sanitizeCallbackUrl(raw: string | undefined, fallback = DEFAULT_CALLBACK_URL) {
  if (!raw) {
    return fallback;
  }

  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }

  if (/[\r\n\t]/.test(raw)) {
    return fallback;
  }

  return raw;
}

export { DEFAULT_CALLBACK_URL };
