const DISABLED_VALUES = new Set(["0", "false", "off", "no", "disabled"]);

function isTruthy(input: string | undefined, fallback = true) {
  if (!input) {
    return fallback;
  }

  return !DISABLED_VALUES.has(input.trim().toLowerCase());
}

export function isPasswordAuthEnabled() {
  return isTruthy(process.env.AUTH_PASSWORD_ENABLED, true);
}

export function isPasswordResetEmailConfigured() {
  return (
    Boolean(process.env.EMAIL_SERVER_HOST) &&
    Boolean(process.env.EMAIL_SERVER_PORT) &&
    Boolean(process.env.EMAIL_SERVER_USER) &&
    Boolean(process.env.EMAIL_SERVER_PASSWORD) &&
    Boolean(process.env.EMAIL_FROM)
  );
}

export function isResultEmailConfigured() {
  return (
    (Boolean(process.env.RESEND_API_KEY) && Boolean(process.env.RESEND_FROM_EMAIL)) ||
    isPasswordResetEmailConfigured()
  );
}
