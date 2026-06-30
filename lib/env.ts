import "server-only";
import { z } from "zod";

// TYPE-04: this schema was previously dead code (zero callers) while the app read raw `process.env`
// everywhere with no boot-time validation. It is now the single source of truth for server env shape,
// validated at server start by instrumentation.register() (see validateServerEnv below).
//
// Secrets/config that MUST be present for the server to run safely in production. Boot validation
// fails fast on these so a misconfigured deploy crashes at startup instead of silently degrading or
// (after SEC-01/02/08, PRIV-02 removed the cross-secret fallbacks) reusing the wrong secret.
// ARCHIVE_ENCRYPTION_SECRET is required here precisely because its NEXTAUTH/hardcoded-literal fallback
// was removed — production must now supply a distinct value.
const requiredServerEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  ARCHIVE_ENCRYPTION_SECRET: z.string().min(1),
});

// Optional/feature-specific config. Validated for shape when present, never required at boot. The
// email providers (ZeptoMail/Resend/SMTP) and the arch-review signing secrets degrade gracefully when
// unset, so requiring them at boot would crash otherwise-valid deploys.
const optionalServerEnvSchema = z.object({
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().optional(),
  MARKETING_SITE_URL: z.string().url().optional(),
  APP_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  ZEPTOMAIL_TOKEN: z.string().optional(),
  ZEPTOMAIL_FROM_EMAIL: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  ZOKORP_ADMIN_EMAILS: z.string().optional(),
  UPLOAD_MAX_MB: z.coerce.number().int().positive().default(10),

  // Arch-review signing secrets — each must now be its own distinct value (no NEXTAUTH/ZOHO fallback).
  ARCH_REVIEW_EML_SECRET: z.string().optional(),
  ARCH_REVIEW_CTA_SECRET: z.string().optional(),
  ARCH_REVIEW_FOLLOWUP_SECRET: z.string().optional(),
  ZOHO_SYNC_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  STRIPE_PRICE_ID_FTR_SINGLE: z.string().optional(),
  STRIPE_PRICE_ID_SDP_SRP_SINGLE: z.string().optional(),
  STRIPE_PRICE_ID_COMPETENCY_REVIEW: z.string().optional(),
  STRIPE_PRICE_ID_PLATFORM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ID_PLATFORM_ANNUAL: z.string().optional(),
});

const serverEnvSchema = requiredServerEnvSchema.merge(optionalServerEnvSchema);

export const REQUIRED_SERVER_ENV_KEYS = Object.keys(
  requiredServerEnvSchema.shape,
) as Array<keyof z.infer<typeof requiredServerEnvSchema>>;

function formatIssues(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
}

let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${formatIssues(parsed.error)}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

export type ServerEnvValidationResult =
  | { ok: true }
  | { ok: false; missing: string[]; message: string };

// Boot-time validation. Returns the result rather than throwing so the caller chooses the policy
// (fail-fast in production, warn in development — see instrumentation.register). Accepts an explicit
// env object so it can be unit-tested hermetically.
export function validateServerEnv(
  env: Record<string, string | undefined> = process.env,
): ServerEnvValidationResult {
  const parsed = serverEnvSchema.safeParse(env);
  if (parsed.success) {
    return { ok: true };
  }

  const missing = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
  return {
    ok: false,
    missing: [...new Set(missing)],
    message: formatIssues(parsed.error),
  };
}
