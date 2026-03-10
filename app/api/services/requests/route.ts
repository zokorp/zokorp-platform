import { Prisma, ServiceRequestType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { generateServiceTrackingCode } from "@/lib/service-requests";

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
});

async function createServiceRequest(input: {
  userId: string;
  type: ServiceRequestType;
  title: string;
  summary: string;
  preferredStart?: string;
  budgetRange?: string;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const trackingCode = generateServiceTrackingCode();

    try {
      return await db.serviceRequest.create({
        data: {
          userId: input.userId,
          trackingCode,
          type: input.type,
          title: input.title,
          summary: input.summary,
          preferredStart: input.preferredStart ? new Date(`${input.preferredStart}T00:00:00.000Z`) : undefined,
          budgetRange: input.budgetRange,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        typeof error.meta?.target !== "undefined"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("SERVICE_TRACKING_CODE_EXHAUSTED");
}

export async function POST(request: Request) {
  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      return crossSiteResponse;
    }

    const user = await requireUser();

    const limiter = await consumeRateLimit({
      key: `service-request:${user.id}:${getRequestFingerprint(request)}`,
      limit: 6,
      windowMs: 10 * 60 * 1000,
    });

    if (!limiter.allowed) {
      return NextResponse.json(
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
      return NextResponse.json({ error: "Invalid service request input." }, { status: 400 });
    }

    const created = await createServiceRequest({
      userId: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      summary: parsed.data.summary,
      preferredStart: parsed.data.preferredStart,
      budgetRange: parsed.data.budgetRange,
    });

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "service.request_submitted",
        metadataJson: {
          trackingCode: created.trackingCode,
          type: created.type,
          title: created.title,
        },
      },
    });

    return NextResponse.json({
      id: created.id,
      trackingCode: created.trackingCode,
      status: created.status,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isSchemaDriftError(error)) {
      return NextResponse.json(
        { error: "Service request tracking is being enabled. Please retry shortly." },
        { status: 503 },
      );
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to submit service request." }, { status: 500 });
  }
}
