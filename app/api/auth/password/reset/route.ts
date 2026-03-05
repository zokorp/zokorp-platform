import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword, hashOpaqueToken, validatePasswordStrength } from "@/lib/password-auth";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { ensureUserAuthSchemaReady } from "@/lib/user-auth-schema";

const resetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const limiter = consumeRateLimit({
      key: `auth:reset:complete:${getRequestFingerprint(request)}`,
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many reset attempts. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid reset payload." }, { status: 400 });
    }

    const passwordCheck = validatePasswordStrength(parsed.data.password);
    if (!passwordCheck.success) {
      return NextResponse.json(
        { error: passwordCheck.error.issues[0]?.message ?? "Password does not meet requirements." },
        { status: 400 },
      );
    }

    const userAuthSchemaReady = await ensureUserAuthSchemaReady();
    if (!userAuthSchemaReady) {
      return NextResponse.json({ error: "Unable to reset password." }, { status: 503 });
    }

    const tokenHash = hashOpaqueToken(parsed.data.token);
    const userAuth = await db.userAuth.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: {
          gt: new Date(),
        },
      },
      select: {
        userId: true,
      },
    });

    if (!userAuth) {
      return NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    await db.userAuth.update({
      where: { userId: userAuth.userId },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await db.auditLog.create({
      data: {
        userId: userAuth.userId,
        action: "auth.password_reset_completed",
      },
    });

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
