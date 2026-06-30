import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

function compactError(error: unknown) {
  if (error instanceof Error) {
    const digest =
      "digest" in error && typeof error.digest === "string" && error.digest.trim()
        ? error.digest.trim()
        : null;

    return {
      name: error.name,
      message: error.message,
      digest,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown request error",
    digest: null,
  };
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  await Sentry.captureRequestError(error, request, context);

  const summary = compactError(error);
  console.error("Unhandled request error", {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    errorName: summary.name,
    errorMessage: summary.message,
    errorDigest: summary.digest,
  });

  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const { recordRequestErrorIssue } = await import("@/lib/operational-issues");
  await recordRequestErrorIssue(error, request, context);
};

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // TYPE-04: validate required server env at boot. This runs when the server starts (NOT during
    // `next build`), so it fails fast on a misconfigured production deploy without breaking the build.
    // Production throws (crashing the deploy health check); development only warns so local work isn't
    // blocked by a missing optional secret.
    const { validateServerEnv } = await import("@/lib/env");
    const result = validateServerEnv();
    if (!result.ok) {
      const message = `Invalid or missing required environment variables: ${result.message}`;
      if (process.env.NODE_ENV === "production") {
        throw new Error(message);
      }
      console.warn(`[env] ${message}`);
    }

    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
