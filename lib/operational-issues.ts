import type { Instrumentation } from "next";
import type { Prisma } from "@prisma/client";

import { createInternalAuditLog } from "@/lib/internal-route";

type OperationalArea =
  | "auth"
  | "billing"
  | "catalog"
  | "runtime"
  | "security"
  | "service-requests"
  | "tool-run";

type OperationalIssueInput = {
  action: string;
  area: OperationalArea;
  error: unknown;
  metadata?: Prisma.JsonObject;
};

function compactError(error: unknown) {
  if (error instanceof Error) {
    const digest =
      "digest" in error && typeof error.digest === "string" && error.digest.trim()
        ? error.digest.trim()
        : null;

    return {
      errorName: error.name,
      errorMessage: error.message.slice(0, 500),
      errorDigest: digest,
      errorStackPreview: error.stack?.slice(0, 2000) ?? null,
    };
  }

  if (typeof error === "string") {
    return {
      errorName: "Error",
      errorMessage: error.slice(0, 500),
      errorDigest: null,
      errorStackPreview: null,
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: "Unknown operational issue",
    errorDigest: null,
    errorStackPreview: null,
  };
}

function sanitizeHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return sanitizeHeaderValue(value[0]);
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 240) : null;
}

export async function recordOperationalIssue(input: OperationalIssueInput) {
  const errorFields = compactError(input.error);
  const metadata: Prisma.JsonObject = {
    severity: "error",
    area: input.area,
    ...errorFields,
    ...(input.metadata ?? {}),
  };

  console.error(`[${input.action}]`, input.error);
  await createInternalAuditLog(input.action, metadata);
}

export async function recordRequestErrorIssue(
  error: unknown,
  request: Readonly<{
    path: string;
    method: string;
    headers: NodeJS.Dict<string | string[]>;
  }>,
  context: Readonly<Instrumentation.onRequestError extends (...args: infer T) => unknown ? T[2] : never>,
) {
  await recordOperationalIssue({
    action: "runtime.request_error",
    area: "runtime",
    error,
    metadata: {
      path: request.path,
      method: request.method,
      host: sanitizeHeaderValue(request.headers.host),
      userAgent: sanitizeHeaderValue(request.headers["user-agent"]),
      referer: sanitizeHeaderValue(request.headers.referer),
      vercelRequestId: sanitizeHeaderValue(request.headers["x-vercel-id"]),
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      renderSource: context.renderSource ?? null,
      revalidateReason: context.revalidateReason ?? null,
    },
  });
}
