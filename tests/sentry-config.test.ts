import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getBrowserSentryOptions,
  getServerSentryOptions,
  shouldUploadSentrySourceMaps,
} from "@/lib/sentry-config";

function withEnv(values: Record<string, string | undefined>) {
  const original = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    original.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return () => {
    for (const [key, value] of original.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

describe("sentry config helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps browser capture disabled until a public DSN exists", () => {
    const restore = withEnv({
      NEXT_PUBLIC_SENTRY_DSN: undefined,
      NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: undefined,
      NODE_ENV: "production",
    });

    try {
      expect(getBrowserSentryOptions()).toMatchObject({
        dsn: undefined,
        enabled: false,
        tracesSampleRate: 0,
      });
    } finally {
      restore();
    }
  });

  it("uses the explicit server DSN and clamps sample rates", () => {
    const restore = withEnv({
      SENTRY_DSN: "https://server@example.ingest.sentry.io/1",
      NEXT_PUBLIC_SENTRY_DSN: "https://browser@example.ingest.sentry.io/2",
      SENTRY_TRACES_SAMPLE_RATE: "2.4",
      NODE_ENV: "production",
    });

    try {
      expect(getServerSentryOptions()).toMatchObject({
        dsn: "https://server@example.ingest.sentry.io/1",
        enabled: true,
        tracesSampleRate: 1,
      });
    } finally {
      restore();
    }
  });

  it("requires auth token, org, and project before source map upload is considered ready", () => {
    const restore = withEnv({
      SENTRY_AUTH_TOKEN: "token",
      SENTRY_ORG: "zokorp",
      SENTRY_PROJECT: "website",
    });

    try {
      expect(shouldUploadSentrySourceMaps()).toBe(true);
    } finally {
      restore();
    }

    const restoreMissing = withEnv({
      SENTRY_AUTH_TOKEN: "token",
      SENTRY_ORG: "zokorp",
      SENTRY_PROJECT: undefined,
    });

    try {
      expect(shouldUploadSentrySourceMaps()).toBe(false);
    } finally {
      restoreMissing();
    }
  });
});
