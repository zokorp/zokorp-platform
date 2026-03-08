import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { db } from "@/lib/db";
import { hashPassword, hashOpaqueToken, validatePasswordStrength } from "@/lib/password-auth";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { parseAdminEmails } from "@/lib/security";
import { ensureUserAuthSchemaReady } from "@/lib/user-auth-schema";

const resetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isPasswordAuthEnabled()) {
      return NextResponse.json({ error: "Password reset is currently disabled." }, { status: 503 });
    }

    const limiter = await consumeRateLimit({
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
        user: {
          select: {
            email: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!userAuth) {
      return NextResponse.json({ error: "Reset token is invalid or expired." }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const now = new Date();
    const normalizedEmail = userAuth.user.email?.trim().toLowerCase() ?? null;
    const shouldAutoVerify = Boolean(normalizedEmail && !userAuth.user.emailVerified);
    const shouldPromoteToAdmin =
      Boolean(normalizedEmail) && parseAdminEmails(process.env.ZOKORP_ADMIN_EMAILS).has(normalizedEmail!);
    const verificationIdentifier = normalizedEmail ? `verify-email:${normalizedEmail}` : null;

    await db.$transaction(async (tx) => {
      await tx.userAuth.update({
        where: { userId: userAuth.userId },
        data: {
          passwordHash,
          passwordUpdatedAt: now,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      if (shouldAutoVerify) {
        await tx.user.update({
          where: { id: userAuth.userId },
          data: {
            emailVerified: now,
            ...(shouldPromoteToAdmin ? { role: Role.ADMIN } : {}),
          },
        });
      }

      if (verificationIdentifier) {
        await tx.verificationToken.deleteMany({
          where: {
            identifier: verificationIdentifier,
          },
        });
      }
    });

    await db.auditLog.create({
      data: {
        userId: userAuth.userId,
        action: "auth.password_reset_completed",
        metadataJson: {
          autoVerifiedEmail: shouldAutoVerify,
        },
      },
    });

    return NextResponse.json({
      message: shouldAutoVerify
        ? "Password updated and email verified. You can sign in now."
        : "Password updated successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to reset password." }, { status: 500 });
  }
}
