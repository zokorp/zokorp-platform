function parseSampleRate(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
}

function readEnvironment() {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

export function getBrowserSentryOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: readEnvironment(),
    tracesSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === "development" ? 1 : 0,
    ),
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    sendDefaultPii: false,
  };
}

export function getServerSentryOptions() {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || undefined;

  return {
    dsn,
    enabled: Boolean(dsn),
    environment: readEnvironment(),
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === "development" ? 1 : 0,
    ),
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    sendDefaultPii: false,
  };
}

export function shouldUploadSentrySourceMaps() {
  return Boolean(
    process.env.SENTRY_AUTH_TOKEN?.trim() &&
      process.env.SENTRY_ORG?.trim() &&
      process.env.SENTRY_PROJECT?.trim(),
  );
}
