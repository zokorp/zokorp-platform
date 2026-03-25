import {
  calendlyBookedAt,
  calendlyExternalEventId,
  normalizeCalendlyEmail,
  parseCalendlyWebhookPayload,
  verifyCalendlyWebhookSignature,
} from "@/lib/calendly";
import { ingestArchitectureBookedCall } from "@/lib/calendly-bookings";
import { jsonNoStore, methodNotAllowedJson } from "@/lib/internal-route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY ?? "";
  if (!signingKey) {
    return jsonNoStore(
      { error: "Calendly webhook signing key is not configured." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signatureHeader =
    request.headers.get("Calendly-Webhook-Signature") ??
    request.headers.get("calendly-webhook-signature");

  if (
    !verifyCalendlyWebhookSignature({
      rawBody,
      signatureHeader,
      signingKey,
    })
  ) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = parseCalendlyWebhookPayload(rawBody);
  } catch {
    return jsonNoStore({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (payload.event !== "invitee.created") {
    return jsonNoStore({
      status: "ignored",
      reason: "unsupported_event",
    });
  }

  const email = normalizeCalendlyEmail(payload);
  if (!email) {
    return jsonNoStore({
      status: "ignored",
      reason: "missing_email",
    });
  }

  const externalEventId =
    calendlyExternalEventId(payload) ??
    `calendly:${email}:${calendlyBookedAt(payload) ?? "unknown"}`;
  const bookedAtIso = calendlyBookedAt(payload);
  const estimateReferenceCode = payload.payload?.tracking?.utm_content?.trim() || null;
  const result = await ingestArchitectureBookedCall({
    email,
    name: payload.payload?.name ?? null,
    externalEventId,
    bookedAtIso,
    estimateReferenceCode,
    provider: "calendly",
  });

  return jsonNoStore(result);
}

export async function GET(_request: Request) {
  void _request;
  return methodNotAllowedJson("POST");
}
