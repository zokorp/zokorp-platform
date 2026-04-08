import { ServiceRequestType } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSchemaDriftError, isTransientDatabaseConnectionError } from "@/lib/db-errors";
import { jsonNoStore } from "@/lib/internal-route";
import { upsertLead } from "@/lib/privacy-leads";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { BUSINESS_EMAIL_REQUIRED_MESSAGE, isBusinessEmail } from "@/lib/security";
import { createServiceRequest } from "@/lib/service-requests";
import { upsertZohoLead } from "@/lib/zoho-crm";

const requestSchema = z.object({
  type: z.nativeEnum(ServiceRequestType),
  title: z.string().trim().min(8).max(120),
  summary: z.string().trim().min(30).max(2400),
  preferredStart: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  budgetRange: z.string().trim().max(80).optional(),
  requesterEmail: z.string().trim().email().optional(),
  requesterName: z.string().trim().max(120).optional(),
  requesterCompanyName: z.string().trim().max(120).optional(),
});

function fallbackZohoCompanyName(input: {
  requesterCompanyName?: string | null;
  requesterEmail: string;
}) {
  const explicitCompany = input.requesterCompanyName?.trim();
  if (explicitCompany) {
    return explicitCompany;
  }

  const domain = input.requesterEmail.split("@")[1]?.trim().toLowerCase();
  if (!domain) {
    return "ZoKorp website inquiry";
  }

  return domain;
}

function buildZohoServiceRequestDescription(input: {
  trackingCode: string;
  requesterSource: "account" | "public_form";
  type: ServiceRequestType;
  title: string;
  summary: string;
  requesterEmail: string;
  preferredStart?: string | undefined;
  budgetRange?: string | undefined;
  linkedToAccount: boolean;
}) {
  return [
    `ZoKorp service request ${input.trackingCode}`,
    `Requester source: ${input.requesterSource}`,
    `Linked to account: ${input.linkedToAccount ? "yes" : "no"}`,
    `Type: ${input.type}`,
    `Title: ${input.title}`,
    `Email: ${input.requesterEmail}`,
    input.preferredStart ? `Preferred start: ${input.preferredStart}` : null,
    input.budgetRange ? `Budget range: ${input.budgetRange}` : null,
    `Summary: ${input.summary}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      return crossSiteResponse;
    }

    const session = await auth();
    const signedInUser = session?.user?.email
      ? await db.user.findUnique({
          where: { email: session.user.email },
          select: {
            id: true,
            email: true,
            name: true,
          },
        })
      : null;

    const limiter = await consumeRateLimit({
      key: `service-request:${signedInUser?.id ?? "public"}:${getRequestFingerprint(request)}`,
      limit: 6,
      windowMs: 10 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return jsonNoStore(
        { error: "Too many submissions. Please wait a few minutes and retry." },
        {
          status: 429,
          headers: {
            "Retry-After": String(limiter.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonNoStore({ error: "Invalid service request input." }, { status: 400 });
    }

    const requesterEmail = signedInUser?.email ?? parsed.data.requesterEmail?.trim().toLowerCase();
    if (!requesterEmail) {
      return jsonNoStore(
        { error: "Email is required when submitting without an account." },
        { status: 400 },
      );
    }

    if (!isBusinessEmail(requesterEmail)) {
      return jsonNoStore(
        { error: BUSINESS_EMAIL_REQUIRED_MESSAGE },
        { status: 400 },
      );
    }

    const created = await createServiceRequest({
      userId: signedInUser?.id ?? null,
      requesterEmail,
      requesterName: signedInUser?.name ?? parsed.data.requesterName ?? null,
      requesterCompanyName: parsed.data.requesterCompanyName ?? null,
      requesterSource: signedInUser ? "account" : "public_form",
      type: parsed.data.type,
      title: parsed.data.title,
      summary: parsed.data.summary,
      preferredStart: parsed.data.preferredStart
        ? new Date(`${parsed.data.preferredStart}T00:00:00.000Z`)
        : undefined,
      budgetRange: parsed.data.budgetRange ?? undefined,
    });

    const requesterSource = signedInUser ? "account" : "public_form";
    const requesterName = signedInUser?.name ?? parsed.data.requesterName ?? null;
    const requesterCompanyName = parsed.data.requesterCompanyName ?? null;

    if (!signedInUser) {
      try {
        await upsertLead({
          email: requesterEmail,
          name: requesterName,
          companyName: requesterCompanyName,
        });
      } catch (leadError) {
        console.error("Failed to upsert public service-request lead", leadError);
      }
    }

    try {
      const zohoResult = await upsertZohoLead({
        email: requesterEmail,
        fullName: requesterName?.trim() || requesterEmail,
        companyName: fallbackZohoCompanyName({
          requesterCompanyName,
          requesterEmail,
        }),
        leadSource: "ZoKorp Service Request",
        description: buildZohoServiceRequestDescription({
          trackingCode: created.trackingCode,
          requesterSource,
          type: created.type,
          title: created.title,
          summary: created.summary,
          requesterEmail,
          preferredStart: parsed.data.preferredStart,
          budgetRange: parsed.data.budgetRange ?? undefined,
          linkedToAccount: Boolean(signedInUser),
        }),
      });

      if (zohoResult.status === "failed") {
        console.error("Failed to sync service request to Zoho CRM", zohoResult.error);
      }
    } catch (zohoError) {
      console.error("Failed to sync service request to Zoho CRM", zohoError);
    }

    try {
      await db.auditLog.create({
        data: {
          userId: signedInUser?.id ?? null,
          action: "service.request_submitted",
          metadataJson: {
            trackingCode: created.trackingCode,
            type: created.type,
            title: created.title,
            requesterEmail,
            requesterSource,
          },
        },
      });
    } catch (auditError) {
      console.error("Failed to record service request audit log", auditError);
    }

    return jsonNoStore({
      id: created.id,
      trackingCode: created.trackingCode,
      status: created.status,
      linkedToAccount: Boolean(signedInUser),
    });
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return jsonNoStore(
        { error: "Service request tracking is being enabled. Please retry shortly." },
        { status: 503 },
      );
    }

    if (isTransientDatabaseConnectionError(error)) {
      return jsonNoStore(
        { error: "Service request intake is temporarily busy. Please retry shortly." },
        { status: 503 },
      );
    }

    console.error(error);
    return jsonNoStore({ error: "Unable to submit service request." }, { status: 500 });
  }
}
