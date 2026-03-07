import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v1";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

export type ArchitectureReviewCtaType = "book-call" | "remediation-plan";

type CtaPayload = {
  leadId: string;
  ctaType: ArchitectureReviewCtaType;
  exp: number;
};

function base64urlEncode(input: string) {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function base64urlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function sign(payloadEncoded: string, secret: string) {
  return createHmac("sha256", secret).update(`${TOKEN_VERSION}.${payloadEncoded}`).digest("base64url");
}

export function createArchitectureReviewCtaToken(
  input: {
    leadId: string;
    ctaType: ArchitectureReviewCtaType;
    ttlSeconds?: number;
  },
  secret: string,
) {
  const payload: CtaPayload = {
    leadId: input.leadId,
    ctaType: input.ctaType,
    exp: Math.floor(Date.now() / 1000) + Math.max(60, input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
  };

  const encoded = base64urlEncode(JSON.stringify(payload));
  const signature = sign(encoded, secret);
  return `${TOKEN_VERSION}.${encoded}.${signature}`;
}

export function verifyArchitectureReviewCtaToken(token: string, secret: string): CtaPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("INVALID_CTA_TOKEN");
  }

  const [version, encoded, signature] = parts;
  if (version !== TOKEN_VERSION) {
    throw new Error("INVALID_CTA_TOKEN");
  }

  const expectedSignature = sign(encoded, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new Error("INVALID_CTA_TOKEN");
  }

  let payload: CtaPayload;
  try {
    payload = JSON.parse(base64urlDecode(encoded)) as CtaPayload;
  } catch {
    throw new Error("INVALID_CTA_TOKEN");
  }

  if (!payload.leadId || !payload.ctaType || !payload.exp) {
    throw new Error("INVALID_CTA_TOKEN");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("EXPIRED_CTA_TOKEN");
  }

  if (payload.ctaType !== "book-call" && payload.ctaType !== "remediation-plan") {
    throw new Error("INVALID_CTA_TOKEN");
  }

  return payload;
}
