import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sendEmailVerificationEmail } from "@/lib/auth-email";
import { isPasswordAuthEnabled } from "@/lib/auth-config";
import { db } from "@/lib/db";
import { issueEmailVerificationToken } from "@/lib/email-verification";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { hashPassword, validatePasswordStrength } from "@/lib/password-auth";
import { isBusinessEmail } from "@/lib/security";
import { getSiteOriginFromRequest } from "@/lib/site-origin";
import { ensureUserAuthSchemaReady } from "@/lib/user-auth-schema";

const registerSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email(),
  password: z.string(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!isPasswordAuthEnabled()) {
      return NextResponse.json(
        { error: "Password account registration is currently disabled." },
        { status: 503 },
      );
    }

    const limiter = await consumeRateLimit({
      key: `auth:register:${getRequestFingerprint(request)}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid registration input." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    if (!isBusinessEmail(email)) {
      return NextResponse.json(
        { error: "Personal email domains are not allowed. Use a business email." },
        { status: 400 },
      );
    }

    const passwordCheck = validatePasswordStrength(parsed.data.password);
    if (!passwordCheck.success) {
      return NextResponse.json(
        { error: passwordCheck.error.issues[0]?.message ?? "Password does not meet requirements." },
        { status: 400 },
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        {
          error: existing.emailVerified
            ? "An account with that email already exists."
            : "An account with that email already exists but is not verified. Request a new verification email.",
        },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const userAuthSchemaReady = await ensureUserAuthSchemaReady();

    if (!userAuthSchemaReady) {
      return NextResponse.json(
        { error: "Account setup is temporarily unavailable. Please retry shortly." },
        { status: 503 },
      );
    }

    const createdUser = await db.user.create({
      data: {
        name: parsed.data.name?.trim() || undefined,
        email,
        role: Role.USER,
        userAuth: {
          create: {
            passwordHash,
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: createdUser.id,
        action: "auth.register",
        metadataJson: {
          email,
          emailVerified: false,
        },
      },
    });

    const verification = await issueEmailVerificationToken({
      email,
      baseUrl: getSiteOriginFromRequest(request),
    });
    const sendResult = await sendEmailVerificationEmail({
      to: email,
      verifyUrl: verification.verifyUrl,
    });

    await db.auditLog.create({
      data: {
        userId: createdUser.id,
        action: "auth.email_verification_requested",
        metadataJson: {
          email,
          deliveryOk: sendResult.ok,
          deliveryError: sendResult.ok ? null : sendResult.error,
        },
      },
    });

    return NextResponse.json(
      {
        status: "verification_required",
        verificationEmailSent: sendResult.ok,
        message: sendResult.ok
          ? "Account created. Check your email to verify the address before signing in."
          : "Account created, but email delivery is currently unavailable. Request a new verification email from the verify-email page.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
