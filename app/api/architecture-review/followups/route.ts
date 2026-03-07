import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { buildArchitectureFollowUpEmail, dueFollowUpCheckpoint } from "@/lib/architecture-review/followup";
import { sendArchitectureReviewEmail } from "@/lib/architecture-review/sender";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";

export const runtime = "nodejs";

function safeSecretEqual(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  const configuredSecret = process.env.ARCH_REVIEW_FOLLOWUP_SECRET ?? process.env.ZOHO_SYNC_SECRET ?? "";
  const providedSecret =
    request.headers.get("x-arch-followup-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!configuredSecret || !providedSecret || !safeSecretEqual(configuredSecret, providedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const candidates = await db.leadLog.findMany({
      where: {
        architectureProvider: {
          in: ["aws", "azure", "gcp"],
        },
        emailSentAt: {
          not: null,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 150,
      select: {
        id: true,
        userEmail: true,
        architectureProvider: true,
        overallScore: true,
        topIssues: true,
        createdAt: true,
        leadStage: true,
        followUpStatusJson: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const lead of candidates) {
      const dueDay = dueFollowUpCheckpoint({
        createdAt: lead.createdAt,
        leadStage: lead.leadStage,
        followUpStatusJson: lead.followUpStatusJson,
      });

      if (!dueDay) {
        skipped += 1;
        continue;
      }

      const email = await buildArchitectureFollowUpEmail({
        leadId: lead.id,
        userEmail: lead.userEmail,
        provider: lead.architectureProvider,
        overallScore: lead.overallScore,
        topIssues: lead.topIssues,
        day: dueDay,
      });

      const sendResult = await sendArchitectureReviewEmail({
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      if (!sendResult.ok) {
        failed += 1;
        await db.leadLog.update({
          where: { id: lead.id },
          data: {
            followUpStatusJson: {
              ...(typeof lead.followUpStatusJson === "object" && lead.followUpStatusJson && !Array.isArray(lead.followUpStatusJson)
                ? lead.followUpStatusJson
                : {}),
              [email.statusKey]: `failed:${new Date().toISOString()}`,
            },
          },
        });
        continue;
      }

      sent += 1;
      await db.leadLog.update({
        where: { id: lead.id },
        data: {
          followUpStatusJson: {
            ...(typeof lead.followUpStatusJson === "object" && lead.followUpStatusJson && !Array.isArray(lead.followUpStatusJson)
              ? lead.followUpStatusJson
              : {}),
            [email.statusKey]: `sent:${new Date().toISOString()}`,
          },
        },
      });
    }

    return NextResponse.json({
      status: "ok",
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    if (isSchemaDriftError(error)) {
      return NextResponse.json({
        status: "ok",
        sent: 0,
        skipped: 0,
        failed: 0,
        message: "Lead follow-up schema is unavailable.",
      });
    }

    return NextResponse.json(
      {
        error: "Architecture follow-up run failed.",
        details: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
