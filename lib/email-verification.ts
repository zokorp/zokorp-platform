import { expectedAdminRole } from "@/lib/admin-access";
import { db } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password-auth";

const EMAIL_VERIFICATION_PREFIX = "verify-email:";
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function identifierForEmail(email: string) {
  return `${EMAIL_VERIFICATION_PREFIX}${normalizeEmail(email)}`;
}

function emailFromIdentifier(identifier: string) {
  if (!identifier.startsWith(EMAIL_VERIFICATION_PREFIX)) {
    return null;
  }

  return identifier.slice(EMAIL_VERIFICATION_PREFIX.length) || null;
}

export async function issueEmailVerificationToken(input: {
  email: string;
  baseUrl: string;
}) {
  const email = normalizeEmail(input.email);
  const identifier = identifierForEmail(email);
  const token = generateOpaqueToken(32);
  const tokenHash = hashOpaqueToken(token);
  const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await db.verificationToken.deleteMany({
    where: { identifier },
  });

  await db.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires,
    },
  });

  const verifyUrl = new URL("/api/auth/verify-email/confirm", input.baseUrl);
  verifyUrl.searchParams.set("token", token);

  return {
    email,
    expires,
    verifyUrl: verifyUrl.toString(),
  };
}

export async function consumeEmailVerificationToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken.trim());
  const record = await db.verificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record) {
    return { status: "invalid" as const };
  }

  const email = emailFromIdentifier(record.identifier);
  if (!email) {
    await db.verificationToken.delete({
      where: { token: tokenHash },
    });

    return { status: "invalid" as const };
  }

  if (record.expires <= new Date()) {
    await db.verificationToken.delete({
      where: { token: tokenHash },
    });

    return { status: "expired" as const, email };
  }

  const now = new Date();

  const user = await db.$transaction(async (tx) => {
    await tx.verificationToken.deleteMany({
      where: { identifier: record.identifier },
    });

    await tx.user.updateMany({
      where: {
        email,
        emailVerified: null,
      },
      data: {
        emailVerified: now,
        role: expectedAdminRole({
          email,
          emailVerified: now,
        }),
      },
    });

    return tx.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
      },
    });
  });

  if (!user?.email) {
    return { status: "invalid" as const };
  }

  return {
    status: "verified" as const,
    userId: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role,
  };
}
