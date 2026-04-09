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
