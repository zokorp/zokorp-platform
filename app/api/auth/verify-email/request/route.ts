import { NextResponse } from "next/server";
import { z } from "zod";

import { sendEmailVerificationEmail } from "@/lib/auth-email";
import { db } from "@/lib/db";
import { issueEmailVerificationToken } from "@/lib/email-verification";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { isBusinessEmail } from "@/lib/security";
import { getSiteOriginFromRequest } from "@/lib/site-origin";

const requestSchema = z.object({
  email: z.string().trim().email(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      return crossSiteResponse;
    }

    const limiter = await consumeRateLimit({
      key: `auth:verify-email:${getRequestFingerprint(request)}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return NextResponse.json(
        { error: "Too many verification requests. Please retry later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const genericMessage = "If that account is pending verification, a new email has been sent.";

    if (!isBusinessEmail(email)) {
      return NextResponse.json({ message: genericMessage });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user?.email || user.emailVerified) {
      return NextResponse.json({ message: genericMessage });
    }

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
        userId: user.id,
        action: "auth.email_verification_requested",
        metadataJson: {
          email,
          deliveryOk: sendResult.ok,
          deliveryError: sendResult.ok ? null : sendResult.error,
        },
      },
    });

    return NextResponse.json({
      message: sendResult.ok
        ? genericMessage
        : "Account found, but email delivery is currently unavailable. Retry shortly or contact support.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to process verification request." }, { status: 500 });
  }
}
