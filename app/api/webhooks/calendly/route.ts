import { Prisma, ServiceRequestStatus, ServiceRequestType } from "@prisma/client";

import {
  calendlyBookedAt,
  calendlyExternalEventId,
  normalizeCalendlyEmail,
  parseCalendlyWebhookPayload,
  verifyCalendlyWebhookSignature,
} from "@/lib/calendly";
import { db } from "@/lib/db";
import { jsonNoStore, methodNotAllowedJson } from "@/lib/internal-route";
import { recordLeadInteraction, upsertLead } from "@/lib/privacy-leads";
import { createServiceRequest } from "@/lib/service-requests";

export const runtime = "nodejs";

async function ensureServiceRequestForBookedCall(input: {
  interactionId: string;
  userId: string;
  bookedAtIso: string | null;
  estimateReferenceCode: string | null;
}) {
  const request = await createServiceRequest({
    userId: input.userId,
    type: ServiceRequestType.CONSULTATION,
    title: "Architecture Review Follow-up",
    summary: [
      "Calendly booking confirmed for architecture review follow-up.",
      input.bookedAtIso ? `Booked time: ${input.bookedAtIso}` : null,
      input.estimateReferenceCode ? `Estimate reference: ${input.estimateReferenceCode}` : null,
      "Provider: Calendly",
    ]
      .filter(Boolean)
      .join(" "),
  });

  await db.serviceRequest.update({
    where: { id: request.id },
    data: {
      status: ServiceRequestStatus.SCHEDULED,
    },
  });

  await db.leadInteraction.update({
    where: { id: input.interactionId },
    data: {
      serviceRequestId: request.id,
    },
  });

  return request;
}

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

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  const lead = await upsertLead({
    userId: user?.id ?? null,
    email,
    name: payload.payload?.name ?? user?.name ?? null,
  });

  let interaction = await db.leadInteraction.findUnique({
    where: {
      externalEventId,
    },
    select: {
      id: true,
      serviceRequestId: true,
    },
  });

  if (!interaction) {
    try {
      const created = await recordLeadInteraction({
        leadId: lead.id,
        userId: user?.id ?? null,
        source: "architecture-review",
        action: "call_booked",
        provider: "calendly",
        externalEventId,
        estimateReferenceCode,
      });
      interaction = {
        id: created.id,
        serviceRequestId: created.serviceRequestId,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        interaction = await db.leadInteraction.findUnique({
          where: {
            externalEventId,
          },
          select: {
            id: true,
            serviceRequestId: true,
          },
        });
      } else {
        throw error;
      }
    }
  }

  let serviceRequestId = interaction?.serviceRequestId ?? null;
  if (user?.id && interaction && !serviceRequestId) {
    const serviceRequest = await ensureServiceRequestForBookedCall({
      interactionId: interaction.id,
      userId: user.id,
      bookedAtIso,
      estimateReferenceCode,
    });
    serviceRequestId = serviceRequest.id;
  }

  await db.auditLog.create({
    data: {
      userId: user?.id ?? null,
      action: "integration.calendly_call_booked",
      metadataJson: {
        email,
        source: "architecture-review",
        provider: "calendly",
        externalEventId,
        bookedAtIso,
        estimateReferenceCode,
        createdServiceRequest: Boolean(serviceRequestId),
      },
    },
  });

  return jsonNoStore({
    status: "ok",
    serviceRequestId,
  });
}

export async function GET(_request: Request) {
  void _request;
  return methodNotAllowedJson("POST");
}
