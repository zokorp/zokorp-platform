import type { LeadLog } from "@prisma/client";

import { buildArchitectureReviewCtaLinks } from "@/lib/architecture-review/cta-links";

export const FOLLOW_UP_DAYS = [2, 7, 14] as const;

type FollowUpCheckpoint = (typeof FOLLOW_UP_DAYS)[number];

type FollowUpStatusMap = Partial<Record<`day${FollowUpCheckpoint}`, string>>;

function parseStatusMap(value: unknown): FollowUpStatusMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const output: FollowUpStatusMap = {};
  for (const day of FOLLOW_UP_DAYS) {
    const key = `day${day}` as const;
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw === "string" && raw.trim()) {
      output[key] = raw;
    }
  }

  return output;
}

export function dueFollowUpCheckpoint(lead: Pick<LeadLog, "createdAt" | "leadStage" | "followUpStatusJson">) {
  if (lead.leadStage === "Call Booked") {
    return null;
  }

  const statusMap = parseStatusMap(lead.followUpStatusJson);
  const ageDays = (Date.now() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24);

  for (const day of FOLLOW_UP_DAYS) {
    const key = `day${day}` as const;
    if (ageDays >= day && !statusMap[key]) {
      return day;
    }
  }

  return null;
}

function checkpointLine(day: FollowUpCheckpoint) {
  if (day === 2) {
    return "Fast follow-up: tighten top security/reliability deductions this week.";
  }

  if (day === 7) {
    return "One-week checkpoint: run a second review after remediation updates to verify score movement.";
  }

  return "Two-week checkpoint: lock ownership and roadmap items to prevent architecture regression.";
}

export async function buildArchitectureFollowUpEmail(input: {
  leadId: string;
  userEmail: string;
  provider: string;
  overallScore: number;
  topIssues: string;
  day: FollowUpCheckpoint;
}) {
  const ctaLinks = await buildArchitectureReviewCtaLinks(input.leadId);
  const provider = input.provider.toUpperCase();
  const subject = `[ZoKorp] ${provider} architecture review follow-up (Day ${input.day})`;

  const bodyLines = [
    `Architecture review follow-up (Day ${input.day})`,
    `Provider: ${provider}`,
    `Score: ${input.overallScore}/100`,
    `Top issues: ${input.topIssues || "n/a"}`,
    "",
    checkpointLine(input.day),
    "",
    `Book architecture call: ${ctaLinks.bookArchitectureCallUrl}`,
    `Request remediation plan: ${ctaLinks.requestRemediationPlanUrl}`,
  ];

  const html = `
    <html>
      <body style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;background:#f8fafc;padding:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:700px;background:#fff;border:1px solid #dbe3ef;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:16px 20px;background:#0f2f5f;color:#fff;">
              <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.9;">ZoKorp Follow-up</div>
              <div style="margin-top:6px;font-size:24px;font-weight:700;">Day ${input.day} architecture checkpoint</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 20px;">
              <p style="margin:0;font-size:15px;line-height:1.6;">${checkpointLine(input.day)}</p>
              <p style="margin:12px 0 0 0;font-size:14px;color:#334155;">Provider: ${provider} · Score: ${input.overallScore}/100</p>
              <p style="margin:8px 0 0 0;font-size:13px;color:#475569;">Top issues: ${input.topIssues || "n/a"}</p>
              <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
                <a href="${ctaLinks.bookArchitectureCallUrl}" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">Book architecture call</a>
                <a href="${ctaLinks.requestRemediationPlanUrl}" style="display:inline-block;background:#fff;color:#0f172a;padding:10px 14px;border-radius:8px;border:1px solid #cbd5e1;font-size:13px;font-weight:700;text-decoration:none;">Request remediation plan</a>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return {
    to: input.userEmail,
    subject,
    text: bodyLines.join("\n"),
    html,
    statusKey: `day${input.day}` as const,
  };
}
