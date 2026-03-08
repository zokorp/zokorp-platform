import type { User } from "@prisma/client";

import { requireUser } from "@/lib/auth";
import { isBusinessEmail } from "@/lib/security";

function normalizeEmail(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const email = value.trim().toLowerCase();
  return email || null;
}

export class FreeToolAccessError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FreeToolAccessError";
    this.status = status;
  }
}

export function isFreeToolAccessError(error: unknown): error is FreeToolAccessError {
  return error instanceof FreeToolAccessError;
}

export async function requireVerifiedFreeToolAccess(input: {
  toolName: string;
  submittedEmail?: string | null;
}): Promise<{ user: User; email: string }> {
  let user: User;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      throw new FreeToolAccessError(
        `Sign in with your verified business email to run ${input.toolName}.`,
        401,
      );
    }

    throw error;
  }

  const accountEmail = normalizeEmail(user.email);
  if (!accountEmail || !user.emailVerified || !isBusinessEmail(accountEmail)) {
    throw new FreeToolAccessError(
      `Sign in with your verified business email to run ${input.toolName}.`,
      401,
    );
  }

  const submittedEmail = normalizeEmail(input.submittedEmail);
  if (submittedEmail && submittedEmail !== accountEmail) {
    throw new FreeToolAccessError(
      `Results are sent only to the verified business email on your signed-in account (${accountEmail}).`,
      400,
    );
  }

  return {
    user,
    email: accountEmail,
  };
}
