import { forbidden, redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";

export async function requireAdminPageAccess(callbackUrl: string) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      redirect(`/login?callbackUrl=${callbackUrl}`);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      forbidden();
    }

    throw error;
  }
}
