import { buildArchitectureFollowUpEmail, dueFollowUpCheckpoint } from "@/lib/architecture-review/followup";
import { sendArchitectureReviewEmail } from "@/lib/architecture-review/sender";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { buildEmailPreferenceLinks, getUserEmailPreferences } from "@/lib/email-preferences";
import {
  createInternalAuditLog,
  jsonNoStore,
  methodNotAllowedJson,
  safeSecretEqual,
} from "@/lib/internal-route";

export const runtime = "nodejs";

function followUpStatusMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function buildFollowUpStatusUpdate(
  current: unknown,
  statusKey: `day${number}`,
  status: "sent" | "failed" | "opted_out",
) {
  return {
    ...followUpStatusMap(current),
    [statusKey]: `${status}:${new Date().toISOString()}`,
  };
}

function providedSecret(request: Request) {
  return (
    request.headers.get("x-arch-followup-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

export async function POST(request: Request) {
  // SEC-02: the follow-up endpoint authenticates with its OWN secret only. The previous fallback to
  // ZOHO_SYNC_SECRET let an unrelated secret authorize this endpoint; it has been removed.
  const configuredSecret = process.env.ARCH_REVIEW_FOLLOWUP_SECRET ?? "";
  const receivedSecret = providedSecret(request);

  if (!configuredSecret) {
    await createInternalAuditLog("internal.architecture_review_followups.not_configured");
    return jsonNoStore(
      { error: "Architecture review follow-up secret is not configured." },
      { status: 503 },
    );
  }

  if (!receivedSecret || !safeSecretEqual(configuredSecret, receivedSecret)) {
    return jsonNoStore({ error: "Unauthorized" }, { status: 401 });
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
        userId: true,
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
    let optedOut = 0;
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

      const preferences = await getUserEmailPreferences(lead.userId);
      if (!preferences.marketingFollowUpEmails) {
        optedOut += 1;
        await db.leadLog.update({
          where: { id: lead.id },
          data: {
            followUpStatusJson: buildFollowUpStatusUpdate(
              lead.followUpStatusJson,
              `day${dueDay}`,
              "opted_out",
            ),
          },
        });
        continue;
      }

      const email = await buildArchitectureFollowUpEmail({
        leadId: lead.id,
        userEmail: lead.userEmail,
        provider: lead.architectureProvider,
        overallScore: lead.overallScore,
        topIssues: lead.topIssues,
        day: dueDay,
        emailPreferenceLinks:
          buildEmailPreferenceLinks({
            userId: lead.userId,
            email: lead.userEmail,
          }) ?? undefined,
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
            followUpStatusJson: buildFollowUpStatusUpdate(lead.followUpStatusJson, email.statusKey, "failed"),
          },
        });
        continue;
      }

      sent += 1;
      await db.leadLog.update({
        where: { id: lead.id },
        data: {
          followUpStatusJson: buildFollowUpStatusUpdate(lead.followUpStatusJson, email.statusKey, "sent"),
        },
      });
    }

    await createInternalAuditLog("internal.architecture_review_followups.run", {
      sent,
      skipped,
      optedOut,
      failed,
    });

    return jsonNoStore({
      status: "ok",
      sent,
      skipped,
      optedOut,
      failed,
    });
  } catch (error) {
    if (isSchemaDriftError(error)) {
      await createInternalAuditLog("internal.architecture_review_followups.schema_unavailable");
      return jsonNoStore(
        {
          error: "Architecture follow-up run is unavailable.",
        },
        { status: 503 },
      );
    }

    console.error("architecture follow-up run failed", error);
    await createInternalAuditLog("internal.architecture_review_followups.failed", {
      errorName: error instanceof Error ? error.name : "unknown_error",
    });

    return jsonNoStore(
      {
        error: "Architecture follow-up run failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(_request: Request) {
  void _request;
  return methodNotAllowedJson("POST");
}
