import { z } from "zod";

import { ingestArchitectureBookedCall } from "@/lib/calendly-bookings";
import {
  createInternalAuditLog,
  jsonNoStore,
  methodNotAllowedJson,
  safeSecretEqual,
} from "@/lib/internal-route";

export const runtime = "nodejs";

const bookedCallSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(160).nullable().optional(),
  externalEventId: z.string().trim().min(1).max(320),
  bookedAtIso: z.string().datetime({ offset: true }).nullable().optional(),
  estimateReferenceCode: z.string().trim().max(40).nullable().optional(),
  provider: z.string().trim().min(1).max(40).nullable().optional(),
});

function providedSecret(request: Request) {
  return (
    request.headers.get("x-calendly-sync-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

export async function POST(request: Request) {
  const configuredSecret = process.env.CALENDLY_SYNC_SECRET ?? "";
  const receivedSecret = providedSecret(request);

  if (!configuredSecret) {
    await createInternalAuditLog("internal.calendly_booked_call.not_configured");
    return jsonNoStore(
      { error: "Calendly sync secret is not configured." },
      { status: 503 },
    );
  }

  if (!receivedSecret || !safeSecretEqual(configuredSecret, receivedSecret)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
  }

  let payload;
  try {
    payload = bookedCallSchema.parse(await request.json());
  } catch {
    return jsonNoStore({ error: "Invalid request payload." }, { status: 400 });
  }

  const result = await ingestArchitectureBookedCall({
    email: payload.email,
    name: payload.name ?? null,
    externalEventId: payload.externalEventId,
    bookedAtIso: payload.bookedAtIso ?? null,
    estimateReferenceCode: payload.estimateReferenceCode ?? null,
    provider: payload.provider ?? "calendly",
  });

  return jsonNoStore(result);
}

export async function GET(_request: Request) {
  void _request;
  return methodNotAllowedJson("POST");
}
