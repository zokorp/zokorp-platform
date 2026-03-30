import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { getSiteUrl } from "@/lib/site";

export type UserEmailPreferenceSnapshot = {
  operationalResultEmails: boolean;
  marketingFollowUpEmails: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type EmailPreferenceTokenPayload = {
  userId: string;
  email: string;
  exp: number;
};

const DEFAULT_EMAIL_PREFERENCES: UserEmailPreferenceSnapshot = {
  operationalResultEmails: true,
  marketingFollowUpEmails: false,
  createdAt: null,
  updatedAt: null,
};

function getEmailPreferenceSecret() {
  return process.env.EMAIL_PREFERENCES_SECRET ?? process.env.NEXTAUTH_SECRET ?? "development-email-preferences-secret";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signToken(payload: string) {
  return createHmac("sha256", getEmailPreferenceSecret()).update(payload).digest("base64url");
}

export function buildEmailPreferencesToken(input: { userId: string; email: string; expiresInDays?: number }) {
  const exp = Date.now() + (input.expiresInDays ?? 180) * 24 * 60 * 60 * 1000;
  const payload = base64UrlEncode(
    JSON.stringify({
      userId: input.userId,
      email: input.email.trim().toLowerCase(),
      exp,
    } satisfies EmailPreferenceTokenPayload),
  );
  const signature = signToken(payload);
  return `${payload}.${signature}`;
}

export function readEmailPreferencesToken(token: string | null | undefined): EmailPreferenceTokenPayload | null {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = signToken(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as EmailPreferenceTokenPayload;
    if (!parsed.userId || !parsed.email || !Number.isFinite(parsed.exp) || parsed.exp < Date.now()) {
      return null;
    }

    return {
      userId: parsed.userId,
      email: parsed.email.trim().toLowerCase(),
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function getUserEmailPreferences(userId: string | null | undefined): Promise<UserEmailPreferenceSnapshot> {
  if (!userId) {
    return DEFAULT_EMAIL_PREFERENCES;
  }

  try {
    const record = await db.userEmailPreference.findUnique({
      where: { userId },
    });

    if (!record) {
      return DEFAULT_EMAIL_PREFERENCES;
    }

    return {
      operationalResultEmails: record.operationalResultEmails,
      marketingFollowUpEmails: record.marketingFollowUpEmails,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return DEFAULT_EMAIL_PREFERENCES;
    }

    throw error;
  }
}

export async function saveUserEmailPreferences(input: {
  userId: string;
  operationalResultEmails: boolean;
  marketingFollowUpEmails: boolean;
}) {
  return db.userEmailPreference.upsert({
    where: {
      userId: input.userId,
    },
    create: {
      userId: input.userId,
      operationalResultEmails: input.operationalResultEmails,
      marketingFollowUpEmails: input.marketingFollowUpEmails,
    },
    update: {
      operationalResultEmails: input.operationalResultEmails,
      marketingFollowUpEmails: input.marketingFollowUpEmails,
    },
  });
}

export async function saveUserEmailPreferencesByToken(input: {
  token: string;
  operationalResultEmails: boolean;
  marketingFollowUpEmails: boolean;
}) {
  const subject = readEmailPreferencesToken(input.token);
  if (!subject) {
    return {
      ok: false as const,
      reason: "INVALID_TOKEN",
    };
  }

  await saveUserEmailPreferences({
    userId: subject.userId,
    operationalResultEmails: input.operationalResultEmails,
    marketingFollowUpEmails: input.marketingFollowUpEmails,
  });

  return {
    ok: true as const,
    subject,
  };
}

export async function getUserEmailPreferencesByToken(token: string | null | undefined) {
  const subject = readEmailPreferencesToken(token);
  if (!subject) {
    return null;
  }

  const preferences = await getUserEmailPreferences(subject.userId);
  return {
    subject,
    preferences,
  };
}

export function buildEmailPreferenceLinks(input: { userId: string | null | undefined; email: string | null | undefined }) {
  const email = input.email?.trim().toLowerCase();
  if (!input.userId || !email) {
    return null;
  }

  const token = buildEmailPreferencesToken({
    userId: input.userId,
    email,
  });
  const siteUrl = getSiteUrl();

  return {
    manageUrl: `${siteUrl}/email-preferences?token=${encodeURIComponent(token)}`,
    marketingUnsubscribeUrl: `${siteUrl}/email-preferences/unsubscribe?token=${encodeURIComponent(token)}`,
  };
}

export function buildEmailPreferenceFooter(input: {
  manageUrl: string;
  marketingUnsubscribeUrl: string;
}) {
  const text = [
    "Email preferences:",
    `Manage operational-result and follow-up email settings: ${input.manageUrl}`,
    `Stop future marketing follow-up emails: ${input.marketingUnsubscribeUrl}`,
  ].join("\n");

  const html = `
    <div style="margin-top:22px;padding-top:16px;border-top:1px solid #dbe3ef;font-size:12px;line-height:1.7;color:#64748b;">
      <div>Manage operational-result and follow-up email settings: <a href="${input.manageUrl}" style="color:#0f5c7a;">Email preferences</a></div>
      <div>Stop future marketing follow-up emails: <a href="${input.marketingUnsubscribeUrl}" style="color:#0f5c7a;">Unsubscribe</a></div>
    </div>
  `;

  return { text, html };
}
