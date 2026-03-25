import { Prisma, ServiceRequestStatus, ServiceRequestType } from "@prisma/client";

import { db } from "@/lib/db";

export const SERVICE_REQUEST_TYPE_LABEL: Record<ServiceRequestType, string> = {
  CONSULTATION: "Consultation",
  DELIVERY: "Service Delivery",
  SUPPORT: "Support",
};

export const SERVICE_REQUEST_STATUS_LABEL: Record<ServiceRequestStatus, string> = {
  SUBMITTED: "Submitted",
  TRIAGED: "Triaged",
  PROPOSAL_SENT: "Proposal Sent",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
};

export const SERVICE_REQUEST_STATUS_STYLE: Record<ServiceRequestStatus, string> = {
  SUBMITTED: "border-sky-200 bg-sky-50 text-sky-700",
  TRIAGED: "border-sky-200 bg-sky-50 text-sky-700",
  PROPOSAL_SENT: "border-indigo-200 bg-indigo-50 text-indigo-700",
  SCHEDULED: "border-violet-200 bg-violet-50 text-violet-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-700",
  BLOCKED: "border-rose-200 bg-rose-50 text-rose-700",
  DELIVERED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CLOSED: "border-slate-300 bg-slate-100 text-slate-700",
};

function randomSuffix(length = 4) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    value += alphabet[index];
  }

  return value;
}

export function generateServiceTrackingCode(date = new Date()) {
  const y = String(date.getUTCFullYear()).slice(-2);
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");

  return `SR-${y}${m}${d}-${randomSuffix(5)}`;
}

export async function createServiceRequest(input: {
  userId: string;
  type: ServiceRequestType;
  title: string;
  summary: string;
  preferredStart?: Date | null;
  budgetRange?: string | null;
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
          preferredStart: input.preferredStart ?? undefined,
          budgetRange: input.budgetRange ?? undefined,
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
