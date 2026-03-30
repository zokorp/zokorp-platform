"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { saveUserEmailPreferences } from "@/lib/email-preferences";

export async function saveAccountEmailPreferencesAction(formData: FormData) {
  const user = await requireUser();

  await saveUserEmailPreferences({
    userId: user.id,
    operationalResultEmails: formData.get("operationalResultEmails") === "on",
    marketingFollowUpEmails: formData.get("marketingFollowUpEmails") === "on",
  });

  revalidatePath("/account");
  revalidatePath("/email-preferences");
}
