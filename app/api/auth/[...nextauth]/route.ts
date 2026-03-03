import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);
type NextAuthRouteContext = {
  params: Promise<{ nextauth: string[] }>;
};

function parseEnvInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeEmail(input: string | null) {
  if (!input) {
    return null;
  }

  const email = input.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return null;
  }

  return email;
}

function tooManyRequestsResponse(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({
      error: "Too many sign-in requests. Please wait a few minutes and try again.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

export async function POST(request: Request, context: NextAuthRouteContext) {
  const pathname = new URL(request.url).pathname;

  if (pathname.endsWith("/signin/email")) {
    const ipFingerprint = getRequestFingerprint(request);
    const ipLimiter = consumeRateLimit({
      key: `auth:magic:ip:${ipFingerprint}`,
      limit: parseEnvInt("AUTH_MAGIC_LINK_MAX_PER_IP_10M", 5),
      windowMs: 10 * 60 * 1000,
    });

    if (!ipLimiter.allowed) {
      return tooManyRequestsResponse(ipLimiter.retryAfterSeconds);
    }

    let email: string | null = null;

    try {
      const formData = await request.clone().formData();
      const value = formData.get("email");
      email = normalizeEmail(typeof value === "string" ? value : null);
    } catch {
      email = null;
    }

    if (email) {
      const emailLimiter = consumeRateLimit({
        key: `auth:magic:email:${email}`,
        limit: parseEnvInt("AUTH_MAGIC_LINK_MAX_PER_EMAIL_1H", 6),
        windowMs: 60 * 60 * 1000,
      });

      if (!emailLimiter.allowed) {
        return tooManyRequestsResponse(emailLimiter.retryAfterSeconds);
      }
    }
  }

  return handler(request, context);
}

export function GET(request: Request, context: NextAuthRouteContext) {
  return handler(request, context);
}
