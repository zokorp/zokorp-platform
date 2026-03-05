import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { hashPassword, validatePasswordStrength } from "@/lib/password-auth";
import { isBusinessEmail, parseAdminEmails } from "@/lib/security";
import { ensureUserAuthSchemaReady } from "@/lib/user-auth-schema";

const registerSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email(),
  password: z.string(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const limiter = consumeRateLimit({
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
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const adminEmails = parseAdminEmails(process.env.ZOKORP_ADMIN_EMAILS);
    const role = adminEmails.has(email) ? Role.ADMIN : Role.USER;
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
        role,
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
        },
      },
    });

    return NextResponse.json({ status: "created" }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to create account." }, { status: 500 });
  }
}
