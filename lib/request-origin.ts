import { NextResponse } from "next/server";

import { getSiteOriginFromRequest } from "@/lib/site-origin";

export const CROSS_SITE_REQUEST_ERROR = "Cross-site requests are not allowed.";

function normalizeOriginValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function trustedRequestOrigins(request: Request) {
  const origins = new Set<string>();

  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // Ignore malformed runtime URL values and rely on configured site origin below.
  }

  origins.add(getSiteOriginFromRequest(request));
  return origins;
}

export function extractRequestOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  if (originHeader !== null) {
    return {
      present: true,
      origin: normalizeOriginValue(originHeader),
    };
  }

  if (refererHeader !== null) {
    return {
      present: true,
      origin: normalizeOriginValue(refererHeader),
    };
  }

  return {
    present: false,
    origin: null,
  };
}

export function requireSameOrigin(request: Request) {
  const source = extractRequestOrigin(request);
  if (!source.present || !source.origin) {
    return NextResponse.json(
      { error: CROSS_SITE_REQUEST_ERROR },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (!trustedRequestOrigins(request).has(source.origin)) {
    return NextResponse.json(
      { error: CROSS_SITE_REQUEST_ERROR },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return null;
}
