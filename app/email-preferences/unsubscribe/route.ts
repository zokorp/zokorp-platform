import { NextResponse } from "next/server";

import { getUserEmailPreferencesByToken, saveUserEmailPreferencesByToken } from "@/lib/email-preferences";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/email-preferences?status=invalid", url.origin), { status: 302 });
  }

  const current = await getUserEmailPreferencesByToken(token);
  if (!current) {
    return NextResponse.redirect(new URL("/email-preferences?status=invalid", url.origin), { status: 302 });
  }

  const result = await saveUserEmailPreferencesByToken({
    token,
    operationalResultEmails: current.preferences.operationalResultEmails,
    marketingFollowUpEmails: false,
  });

  if (!result.ok) {
    return NextResponse.redirect(new URL("/email-preferences?status=invalid", url.origin), { status: 302 });
  }

  return NextResponse.redirect(
    new URL(`/email-preferences?token=${encodeURIComponent(token)}&updated=1`, url.origin),
    { status: 302 },
  );
}
