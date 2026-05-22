import { getAdminOperationsSnapshot, type AdminOperationsSnapshot } from "@/lib/admin-operations";
import { PUBLIC_LAUNCH_CONTACT } from "@/lib/public-launch-contract";
import { sendArchitectureReviewEmail, type SendEmailResult } from "@/lib/architecture-review/sender";

export type DigestSection = {
  label: string;
  description: string;
  count: number;
  examples: string[];
};

export type OperationalDigest = {
  hasIssues: boolean;
  totalCriticalCount: number;
  sections: DigestSection[];
  generatedAt: Date;
  snapshot: AdminOperationsSnapshot;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type AnyOperationsIssue = {
  title?: string | null;
  summary?: string | null;
  details?: string[] | null;
  createdAt?: Date | null;
  statusLabel?: string | null;
};

function describeIssue(issue: AnyOperationsIssue) {
  const parts: string[] = [];
  if (issue.title) {
    parts.push(issue.title);
  }
  if (issue.statusLabel) {
    parts.push(`[${issue.statusLabel}]`);
  }
  if (issue.summary) {
    parts.push(issue.summary);
  }
  if (issue.details && issue.details.length > 0) {
    parts.push(issue.details.join("; "));
  }
  if (issue.createdAt) {
    parts.push(`(${issue.createdAt.toISOString()})`);
  }
  return parts.join(" — ") || "Unspecified issue";
}

export function buildOperationalDigest(snapshot: AdminOperationsSnapshot, now: Date = new Date()): OperationalDigest {
  const sections: DigestSection[] = [];

  if (snapshot.stats.failedArchitectureEmail > 0 || snapshot.stats.pendingArchitectureEmail > 0) {
    sections.push({
      label: "Architecture Reviewer email delivery",
      description:
        "Customer result emails that failed to send or are stuck pending. Resend may need attention or the customer's inbox bounced.",
      count: snapshot.stats.failedArchitectureEmail + snapshot.stats.pendingArchitectureEmail,
      examples: snapshot.architectureEmailIssues.slice(0, 3).map(describeIssue),
    });
  }

  if (snapshot.stats.crmNeedsAttention > 0) {
    sections.push({
      label: "Zoho CRM sync",
      description:
        "Leads or service requests that did not sync to Zoho CRM. Either Zoho credentials need attention or the record has a validation issue.",
      count: snapshot.stats.crmNeedsAttention,
      examples: snapshot.crmSyncIssues.slice(0, 3).map(describeIssue),
    });
  }

  if (snapshot.stats.failedQuoteCompanions > 0) {
    sections.push({
      label: "Zoho Invoice estimates",
      description:
        "Validator quote estimate companions that failed to create in Zoho Invoice. Sales follow-up cannot reference these estimates by number.",
      count: snapshot.stats.failedQuoteCompanions,
      examples: snapshot.estimateCompanionIssues.slice(0, 3).map(describeIssue),
    });
  }

  if (snapshot.stats.followUpAttention > 0) {
    sections.push({
      label: "Architecture follow-up cadence",
      description:
        "Post-review follow-up emails that need attention. The scheduled sender may be falling behind or hitting delivery failures.",
      count: snapshot.stats.followUpAttention,
      examples: snapshot.followUpAttentionIssues.slice(0, 3).map(describeIssue),
    });
  }

  if (snapshot.stats.automationAttention > 0) {
    sections.push({
      label: "Automation health",
      description:
        "Scheduled jobs (worker queue, retention sweep, Zoho syncs, follow-up sender) that are stale or showing failures. A cron may have stopped firing.",
      count: snapshot.stats.automationAttention,
      examples: snapshot.automationHealthSignals.slice(0, 3).map(describeIssue),
    });
  }

  if (snapshot.stats.internalFailures > 0) {
    sections.push({
      label: "Internal operational failures",
      description:
        "Server-side errors recorded in the last day across auth, billing, catalog, runtime, security, service requests, and tool runs.",
      count: snapshot.stats.internalFailures,
      examples: snapshot.internalFailureSignals.slice(0, 3).map(describeIssue),
    });
  }

  if (snapshot.stats.securitySignals > 0) {
    sections.push({
      label: "Security signals",
      description:
        "CSP violations and other security events from the last day. Worth a quick scan even when low volume.",
      count: snapshot.stats.securitySignals,
      examples: snapshot.securitySignals.slice(0, 3).map(describeIssue),
    });
  }

  if (snapshot.stats.publicContractAttention > 0) {
    sections.push({
      label: "Public smoke contract",
      description:
        "Public smoke checks (`/api/internal/audit-results/public-contract`) reported failures. The marketing site may be returning unexpected content.",
      count: snapshot.stats.publicContractAttention,
      examples: snapshot.publicContractSignals.slice(0, 3).map(describeIssue),
    });
  }

  const totalCriticalCount = sections.reduce((sum, section) => sum + section.count, 0);

  return {
    hasIssues: totalCriticalCount > 0,
    totalCriticalCount,
    sections,
    generatedAt: now,
    snapshot,
  };
}

export function renderDigestEmail(digest: OperationalDigest): { subject: string; text: string; html: string } {
  const dateLabel = digest.generatedAt.toISOString().slice(0, 10);
  const subject = digest.hasIssues
    ? `[ZoKorp ops] ${dateLabel} — ${digest.totalCriticalCount} item${digest.totalCriticalCount === 1 ? " needs" : "s need"} attention`
    : `[ZoKorp ops] ${dateLabel} — all clear`;

  const textParts: string[] = [];
  textParts.push(`Daily operational digest for ${dateLabel}`);
  textParts.push("");

  if (!digest.hasIssues) {
    textParts.push("No operational failures detected in the last 24 hours.");
    textParts.push("");
    textParts.push("Recent activity totals:");
    textParts.push(`  Architecture reviewer runs: ${digest.snapshot.stats.recentArchitectureRuns}`);
    textParts.push(`  Validator runs: ${digest.snapshot.stats.recentValidatorRuns}`);
    textParts.push(`  Forecasting Beta runs: ${digest.snapshot.stats.recentMlopsRuns}`);
    textParts.push(`  Calendly bookings: ${digest.snapshot.stats.recentBookedCalls}`);
  } else {
    textParts.push(
      `${digest.totalCriticalCount} item${digest.totalCriticalCount === 1 ? " needs" : "s need"} attention:`,
    );
    textParts.push("");

    for (const section of digest.sections) {
      textParts.push(`[${section.count}] ${section.label}`);
      textParts.push(`  ${section.description}`);
      if (section.examples.length > 0) {
        textParts.push("  Examples:");
        for (const example of section.examples) {
          textParts.push(`    - ${example}`);
        }
      }
      textParts.push("");
    }
  }

  textParts.push("");
  textParts.push("Open the live operations dashboard:");
  textParts.push("  https://app.zokorp.com/admin/operations");
  textParts.push("");
  textParts.push(`Generated at ${digest.generatedAt.toISOString()} UTC.`);

  const text = textParts.join("\n");

  const sectionsHtml = digest.hasIssues
    ? digest.sections
        .map((section) => {
          const examplesHtml =
            section.examples.length > 0
              ? `<ul style="margin:8px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">${section.examples
                  .map((example) => `<li>${escapeHtml(example)}</li>`)
                  .join("")}</ul>`
              : "";

          return `
            <div style="margin-top:14px;border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#ffffff;">
              <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">${section.count} item${section.count === 1 ? "" : "s"}</p>
              <p style="margin:6px 0 0;font-size:16px;font-weight:600;color:#0f172a;">${escapeHtml(section.label)}</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(section.description)}</p>
              ${examplesHtml}
            </div>
          `;
        })
        .join("")
    : `
        <div style="margin-top:14px;border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#f0fdf4;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#15803d;font-weight:600;">No operational failures detected in the last 24 hours.</p>
          <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#475569;">
            Recent activity — architecture runs: ${digest.snapshot.stats.recentArchitectureRuns},
            validator runs: ${digest.snapshot.stats.recentValidatorRuns},
            forecasting beta runs: ${digest.snapshot.stats.recentMlopsRuns},
            calendly bookings: ${digest.snapshot.stats.recentBookedCalls}.
          </p>
        </div>
      `;

  const html = `
    <div style="background:#f3f6fb;padding:28px 16px;font-family:'Plus Jakarta Sans',Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d7e2ef;border-radius:18px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#1d4ed8);padding:24px;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#cbd5f5;">ZoKorp daily ops digest</p>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.2;font-weight:700;">${escapeHtml(dateLabel)} — ${digest.hasIssues ? `${digest.totalCriticalCount} item${digest.totalCriticalCount === 1 ? " needs" : "s need"} attention` : "all clear"}</h1>
        </div>
        <div style="padding:18px 22px 22px;">
          ${sectionsHtml}
          <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
            Open the live operations dashboard:
            <a href="https://app.zokorp.com/admin/operations" style="color:#1d4ed8;">app.zokorp.com/admin/operations</a>
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

export type SendOperationalDigestOptions = {
  recipientOverride?: string;
  skipWhenAllClear?: boolean;
};

export type SendOperationalDigestResult = {
  status: "sent" | "skipped_all_clear" | "skipped_not_configured" | "send_failed";
  email?: SendEmailResult;
  digest: OperationalDigest;
};

export async function runOperationalDigest(
  options: SendOperationalDigestOptions = {},
): Promise<SendOperationalDigestResult> {
  const snapshot = await getAdminOperationsSnapshot();
  const digest = buildOperationalDigest(snapshot);

  if (options.skipWhenAllClear && !digest.hasIssues) {
    return { status: "skipped_all_clear", digest };
  }

  const recipient = options.recipientOverride?.trim() || PUBLIC_LAUNCH_CONTACT.primaryEmail;
  if (!recipient) {
    return { status: "skipped_not_configured", digest };
  }

  const { subject, text, html } = renderDigestEmail(digest);
  const email = await sendArchitectureReviewEmail({
    to: recipient,
    subject,
    text,
    html,
  });

  return {
    status: email.ok ? "sent" : "send_failed",
    email,
    digest,
  };
}
