import { NextResponse } from "next/server";
import { z } from "zod";

import { sendPasswordResetEmail } from "@/lib/auth-email";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { db } from "@/lib/db";
import { issuePasswordResetToken } from "@/lib/password-reset-tokens";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { isBusinessEmail } from "@/lib/security";
import { getSiteOriginFromRequest } from "@/lib/site-origin";
import { ensureUserAuthSchemaReady } from "@/lib/user-auth-schema";

const requestResetSchema = z.object({
  email: z.string().trim().email(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      return crossSiteResponse;
    }

    if (!isPasswordAuthEnabled()) {
      return NextResponse.json({ error: "Password reset is currently disabled." }, { status: 503 });
    }

    const limiter = await consumeRateLimit({
      key: `auth:reset:${getRequestFingerprint(request)}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many reset requests. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = requestResetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    if (!isBusinessEmail(email)) {
      return NextResponse.json({
        message: "If that account exists, a reset email has been sent.",
      });
    }

    const userAuthSchemaReady = await ensureUserAuthSchemaReady();
    if (!userAuthSchemaReady) {
      return NextResponse.json({
        message: "If that account exists, a reset email has been sent.",
      });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        userAuth: true,
      },
    });

    if (!user?.userAuth) {
      return NextResponse.json({
        message: "If that account exists, a reset email has been sent.",
      });
    }

    const resetToken = await issuePasswordResetToken({
      email,
      baseUrl: getSiteOriginFromRequest(request),
    });

    const sendResult = await sendPasswordResetEmail({
      to: email,
      resetUrl: resetToken.resetUrl,
    });

    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "auth.password_reset_requested",
          metadataJson: {
            email,
            deliveryOk: sendResult.ok,
            deliveryError: sendResult.ok ? null : sendResult.error,
          },
        },
      });
    } catch (error) {
      console.error("Failed to persist password reset request audit log", error);
    }

    return NextResponse.json({
      message: "If that account exists, a reset email has been sent.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to process reset request." }, { status: 500 });
  }
}
