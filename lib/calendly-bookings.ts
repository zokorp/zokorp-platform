import { ServiceRequestStatus, ServiceRequestType } from "@prisma/client";

import { db } from "@/lib/db";
import { ensureLeadInteraction, upsertLead } from "@/lib/privacy-leads";
import { isBusinessEmail } from "@/lib/security";
import { createServiceRequest } from "@/lib/service-requests";

async function ensureServiceRequestForBookedCall(input: {
  leadId: string;
  interactionId: string;
  userId: string;
  requesterEmail: string;
  requesterName?: string | null;
  bookedAtIso: string | null;
  estimateReferenceCode: string | null;
  provider: string;
}) {
  const request = await createServiceRequest({
    userId: input.userId,
    requesterEmail: input.requesterEmail,
    requesterName: input.requesterName ?? null,
    requesterSource: "account",
    type: ServiceRequestType.CONSULTATION,
    title: "Architecture Review Follow-up",
    summary: [
      "Calendly booking confirmed for architecture review follow-up.",
      input.bookedAtIso ? `Booked time: ${input.bookedAtIso}` : null,
      input.estimateReferenceCode ? `Estimate reference: ${input.estimateReferenceCode}` : null,
      `Provider: ${input.provider}`,
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

  await ensureLeadInteraction({
    leadId: input.leadId,
    userId: input.userId,
    serviceRequestId: request.id,
    source: "architecture-review",
    action: "service_request_created",
    provider: input.provider,
    externalEventId: `service-request:${request.id}:created`,
    estimateReferenceCode: input.estimateReferenceCode,
  });

  return request;
}

export async function ingestArchitectureBookedCall(input: {
  email: string;
  name?: string | null;
  externalEventId: string;
  bookedAtIso?: string | null;
  estimateReferenceCode?: string | null;
  provider?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const provider = input.provider?.trim() || "calendly";
  const bookedAtIso = input.bookedAtIso?.trim() || null;
  const estimateReferenceCode = input.estimateReferenceCode?.trim() || null;

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!isBusinessEmail(email)) {
    await upsertLead({
      email,
      name: input.name ?? user?.name ?? null,
    });

    await db.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action: "integration.calendly_non_business_email_flagged",
        metadataJson: {
          email,
          source: "architecture-review",
          provider,
          externalEventId: input.externalEventId,
          bookedAtIso,
          estimateReferenceCode,
          matchedAccount: Boolean(user?.id),
        },
      },
    });

    return {
      status: "flagged" as const,
      serviceRequestId: null,
      reason: "business_email_required" as const,
    };
  }

  const lead = await upsertLead({
    userId: user?.id ?? null,
    email,
    name: input.name ?? user?.name ?? null,
  });

  const callBookedResult = await ensureLeadInteraction({
    leadId: lead.id,
    userId: user?.id ?? null,
    source: "architecture-review",
    action: "call_booked",
    provider,
    externalEventId: input.externalEventId,
    estimateReferenceCode,
  });

  const interaction = {
    id: callBookedResult.interaction.id,
    serviceRequestId: callBookedResult.interaction.serviceRequestId,
  };

  let serviceRequestId = interaction?.serviceRequestId ?? null;
  if (user?.id && interaction && !serviceRequestId) {
    const serviceRequest = await ensureServiceRequestForBookedCall({
      leadId: lead.id,
      interactionId: interaction.id,
      userId: user.id,
      requesterEmail: email,
      requesterName: user.name ?? input.name ?? null,
      bookedAtIso,
      estimateReferenceCode,
      provider,
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
        provider,
        externalEventId: input.externalEventId,
        bookedAtIso,
        estimateReferenceCode,
        createdServiceRequest: Boolean(serviceRequestId),
      },
    },
  });

  return {
    status: "ok" as const,
    serviceRequestId,
  };
}
