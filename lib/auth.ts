import { Role, type User } from "@prisma/client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { parseAdminEmails, isBusinessEmail } from "@/lib/security";
import { verifyPassword } from "@/lib/password-auth";
import { ensureUserAuthSchemaReady } from "@/lib/user-auth-schema";

const MAX_FAILED_ATTEMPTS = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg$Ew_1IDgSlgy4PVolAXDe0sEaveXXI2aOBCeP_wKCtf9Z0UY67JWx9fQFo3pS_N9-snLJRwJ-UsAyjit3lIKyhw";

function normalizeEmail(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  const email = input.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return null;
  }

  return email;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Email + Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = typeof credentials?.password === "string" ? credentials.password : "";

        if (!email || !password || !isBusinessEmail(email)) {
          await verifyPassword(password || "invalid", DUMMY_PASSWORD_HASH);
          return null;
        }

        const userAuthSchemaReady = await ensureUserAuthSchemaReady();
        if (!userAuthSchemaReady) {
          await verifyPassword(password || "invalid", DUMMY_PASSWORD_HASH);
          return null;
        }

        const user = await db.user.findUnique({
          where: { email },
          include: {
            userAuth: true,
          },
        });

        if (!user?.userAuth) {
          await verifyPassword(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const now = new Date();
        if (user.userAuth.lockedUntil && user.userAuth.lockedUntil > now) {
          return null;
        }

        const validPassword = await verifyPassword(password, user.userAuth.passwordHash);
        if (!validPassword) {
          const nextAttempts = user.userAuth.failedLoginAttempts + 1;
          const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;

          await db.userAuth.update({
            where: { userId: user.id },
            data: {
              failedLoginAttempts: shouldLock ? 0 : nextAttempts,
              lockedUntil: shouldLock ? new Date(now.getTime() + LOCK_DURATION_MS) : null,
            },
          });

          await db.auditLog.create({
            data: {
              userId: user.id,
              action: "auth.password_failed",
              metadataJson: {
                email,
                nextAttempts,
                locked: shouldLock,
              },
            },
          });

          return null;
        }

        if (user.userAuth.failedLoginAttempts > 0 || user.userAuth.lockedUntil) {
          await db.userAuth.update({
            where: { userId: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });

        session.user.id = user.id;
        session.user.role = dbUser?.role ?? Role.USER;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "auth.sign_in",
          metadataJson: {
            email: user.email,
            provider: account?.provider ?? "credentials",
          },
        },
      });

      if (user.email) {
        const adminEmails = parseAdminEmails(process.env.ZOKORP_ADMIN_EMAILS);
        if (adminEmails.has(user.email.toLowerCase())) {
          await db.user.updateMany({
            where: {
              id: user.id,
              role: { not: Role.ADMIN },
            },
            data: { role: Role.ADMIN },
          });
        }
      }
    },
  },
};

export async function auth(): Promise<Session | null> {
  return getServerSession(authOptions);
}

export async function requireUser(): Promise<User> {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();

  if (user.role === Role.ADMIN) {
    return user;
  }

  const adminEmails = parseAdminEmails(process.env.ZOKORP_ADMIN_EMAILS);
  if (user.email && adminEmails.has(user.email.toLowerCase())) {
    const promoted = await db.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
    });

    return promoted;
  }

  throw new Error("FORBIDDEN");
}
