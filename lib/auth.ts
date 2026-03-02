import { Role, type User } from "@prisma/client";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import EmailProvider from "next-auth/providers/email";

import { db } from "@/lib/db";
import { parseAdminEmails } from "@/lib/security";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
  },
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? "587"),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
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
    async signIn({ user }) {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "auth.sign_in",
          metadataJson: { email: user.email },
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
