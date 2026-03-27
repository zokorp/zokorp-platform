import { db } from "@/lib/db";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password-auth";

const PASSWORD_RESET_PREFIX = "password-reset:";
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function identifierForEmail(email: string) {
  return `${PASSWORD_RESET_PREFIX}${normalizeEmail(email)}`;
}

function emailFromIdentifier(identifier: string) {
  if (!identifier.startsWith(PASSWORD_RESET_PREFIX)) {
    return null;
  }

  return identifier.slice(PASSWORD_RESET_PREFIX.length) || null;
}

export async function issuePasswordResetToken(input: {
  email: string;
  baseUrl: string;
}) {
  const email = normalizeEmail(input.email);
  const identifier = identifierForEmail(email);
  const token = generateOpaqueToken(32);
  const tokenHash = hashOpaqueToken(token);
  const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await db.verificationToken.deleteMany({
    where: {
      identifier,
      expires: {
        lte: new Date(),
      },
    },
  });

  await db.verificationToken.create({
    data: {
      identifier,
      token: tokenHash,
      expires,
    },
  });

  const resetUrl = new URL("/login/reset-password", input.baseUrl);
  resetUrl.searchParams.set("token", token);

  return {
    email,
    expires,
    resetUrl: resetUrl.toString(),
  };
}

export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken.trim());
  const record = await db.verificationToken.findUnique({
    where: { token: tokenHash },
  });

  if (!record) {
    return { status: "invalid" as const };
  }

  const email = emailFromIdentifier(record.identifier);
  if (!email) {
    return { status: "invalid" as const };
  }

  if (record.expires <= new Date()) {
    await db.verificationToken.delete({
      where: { token: tokenHash },
    });

    return { status: "expired" as const, email };
  }

  const userAuth = await db.userAuth.findFirst({
    where: {
      user: {
        email,
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
    return { status: "invalid" as const };
  }

  return {
    status: "valid" as const,
    email,
    userId: userAuth.userId,
    tokenHash,
    identifier: record.identifier,
    user: userAuth.user,
  };
}
