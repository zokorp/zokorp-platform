import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { consumeEmailVerificationToken } from "@/lib/email-verification";
import { recordOperationalIssue } from "@/lib/operational-issues";
import { getSiteOriginFromRequest } from "@/lib/site-origin";

function redirectUrl(baseUrl: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, baseUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = getSiteOriginFromRequest(request);
  const token = new URL(request.url).searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.redirect(redirectUrl(origin, "/register/verify-email", { status: "invalid" }));
  }

  try {
    const result = await consumeEmailVerificationToken(token);

    if (result.status === "verified") {
      try {
        await db.auditLog.create({
          data: {
            userId: result.userId,
            action: "auth.email_verified",
            metadataJson: {
              email: result.email,
              role: result.role,
            },
          },
        });
      } catch (error) {
        console.error("Failed to persist email verification audit log", error);
      }

      return NextResponse.redirect(redirectUrl(origin, "/login", { verified: "1" }));
    }

    if (result.status === "expired") {
      return NextResponse.redirect(
        redirectUrl(origin, "/register/verify-email", {
          status: "expired",
          email: result.email,
        }),
      );
    }

    return NextResponse.redirect(redirectUrl(origin, "/register/verify-email", { status: "invalid" }));
  } catch (error) {
    await recordOperationalIssue({
      action: "auth.verify_email_confirm_failed",
      area: "auth",
      error,
      metadata: {
        route: "/api/auth/verify-email/confirm",
      },
    });
    return NextResponse.redirect(redirectUrl(origin, "/register/verify-email", { status: "invalid" }));
  }
}
