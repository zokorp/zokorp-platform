import { createHmac, timingSafeEqual } from "node:crypto";

export type CalendlyWebhookPayload = {
  event?: string;
  payload?: {
    email?: string | null;
    name?: string | null;
    uri?: string | null;
    new_invitee?: string | null;
    scheduled_event?: {
      uri?: string | null;
      name?: string | null;
      start_time?: string | null;
      end_time?: string | null;
    } | null;
    tracking?: {
      utm_content?: string | null;
    } | null;
  } | null;
};

function secureCompare(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyCalendlyWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  signingKey: string;
}) {
  if (!input.signatureHeader || !input.signingKey) {
    return false;
  }

  const parts = new Map(
    input.signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key?.trim() ?? "", value?.trim() ?? ""];
    }),
  );

  const timestamp = parts.get("t") ?? "";
  const providedSignature = parts.get("v1") ?? "";
  if (!timestamp || !providedSignature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", input.signingKey)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");

  return secureCompare(expectedSignature, providedSignature);
}

export function parseCalendlyWebhookPayload(rawBody: string) {
  return JSON.parse(rawBody) as CalendlyWebhookPayload;
}

export function normalizeCalendlyEmail(payload: CalendlyWebhookPayload) {
  return payload.payload?.email?.trim().toLowerCase() ?? "";
}

export function calendlyBookedAt(payload: CalendlyWebhookPayload) {
  return payload.payload?.scheduled_event?.start_time?.trim() ?? null;
}

export function calendlyExternalEventId(payload: CalendlyWebhookPayload) {
  return (
    payload.payload?.uri?.trim() ||
    payload.payload?.new_invitee?.trim() ||
    payload.payload?.scheduled_event?.uri?.trim() ||
    null
  );
}

export function buildCalendlyBookingUrl(input: {
  baseUrl: string;
  estimateReferenceCode?: string | null;
}) {
  try {
    const url = new URL(input.baseUrl);
    url.searchParams.set("utm_source", "zokorp");
    url.searchParams.set("utm_medium", "architecture-review-email");
    url.searchParams.set("utm_campaign", "architecture-follow-up");

    if (input.estimateReferenceCode) {
      url.searchParams.set("utm_content", input.estimateReferenceCode);
    }

    return url.toString();
  } catch {
    return input.baseUrl;
  }
}
