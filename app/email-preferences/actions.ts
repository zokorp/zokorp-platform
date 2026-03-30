"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { saveUserEmailPreferencesByToken } from "@/lib/email-preferences";

export async function saveEmailPreferencesByTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const result = await saveUserEmailPreferencesByToken({
    token,
    operationalResultEmails: formData.get("operationalResultEmails") === "on",
    marketingFollowUpEmails: formData.get("marketingFollowUpEmails") === "on",
  });

  if (!result.ok) {
    redirect("/email-preferences?status=invalid");
  }

  revalidatePath("/email-preferences");
  redirect(`/email-preferences?token=${encodeURIComponent(token)}&updated=1`);
}
