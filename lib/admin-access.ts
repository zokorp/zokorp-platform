import { Role, type User } from "@prisma/client";

import { db } from "@/lib/db";
import { parseAdminEmails } from "@/lib/security";

type AdminAccessRecord = Pick<User, "id" | "email" | "emailVerified" | "role">;

export function isAdminEmailAllowlisted(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return parseAdminEmails(process.env.ZOKORP_ADMIN_EMAILS).has(email.trim().toLowerCase());
}

export function hasVerifiedAdminAccess(user: Pick<User, "email" | "emailVerified">) {
  return Boolean(user.emailVerified && isAdminEmailAllowlisted(user.email));
}

export function expectedAdminRole(user: Pick<User, "email" | "emailVerified">) {
  return hasVerifiedAdminAccess(user) ? Role.ADMIN : Role.USER;
}

export async function syncAdminRoleForUser<T extends AdminAccessRecord>(user: T): Promise<T> {
  const nextRole = expectedAdminRole(user);

  if (user.role === nextRole) {
    return user;
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { role: nextRole },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      role: true,
    },
  });

  return updated as T;
}

export async function loadAndSyncAdminUserById(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      role: true,
    },
  });

  if (!user) {
    return null;
  }

  return syncAdminRoleForUser(user);
}

export async function hasAdminEntitlementBypass(userId: string) {
  const user = await loadAndSyncAdminUserById(userId);
  return Boolean(user && hasVerifiedAdminAccess(user));
}
