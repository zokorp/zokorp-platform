import { CONSULTATION_CTA_PATH, READINESS_CATEGORY_LABELS } from "@/lib/landing-zone-readiness/config";
import type {
  LandingZoneReadinessAnswers,
  LandingZoneReadinessReport,
  ReadinessCategory,
} from "@/lib/landing-zone-readiness/types";
import { getSiteUrl } from "@/lib/site";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toUsdRange(low: number, high: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(low) +
    " - " +
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(high);
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "there";
}

function buildCategoryLines(report: LandingZoneReadinessReport) {
  return (Object.keys(report.categoryScores) as ReadinessCategory[])
    .map((category) => `${READINESS_CATEGORY_LABELS[category]}: ${report.categoryScores[category]}/100`);
}

function buildTopFixes(report: LandingZoneReadinessReport) {
  return [...new Set(report.findings.map((finding) => finding.fix))].slice(0, 5);
}

function consultationUrl() {
  return new URL(CONSULTATION_CTA_PATH, getSiteUrl()).toString();
}

function buildTextEmail(input: {
  answers: LandingZoneReadinessAnswers;
  report: LandingZoneReadinessReport;
}) {
  const fixes = buildTopFixes(input.report);
  const lines = [
    `Hi ${firstName(input.answers.fullName)},`,
    "",
    `Your Landing Zone Readiness Checker results for ${input.answers.companyName} are ready.`,
    "",
    `Overall score: ${input.report.overallScore}/100`,
    `Maturity band: ${input.report.maturityBand}`,
    `Suggested engagement: ${input.report.quote.quoteTier}`,
    `Estimated quote range: ${toUsdRange(input.report.quote.quoteLow, input.report.quote.quoteHigh)}`,
    "",
    "Category snapshot:",
    ...buildCategoryLines(input.report).map((line) => `- ${line}`),
    "",
    "Top findings:",
    ...(input.report.findings.length > 0
      ? input.report.findings.map((finding) => `- ${finding.finding} Fix: ${finding.fix}`)
      : ["- No major gaps detected in the submitted answers."]),
    "",
    "Top fixes:",
    ...fixes.map((fix) => `- ${fix}`),
  ];

  if (input.answers.biggestChallenge?.trim()) {
    lines.push("");
    lines.push(`You said your biggest cloud challenge is: "${input.answers.biggestChallenge.trim()}"`);
  }

  lines.push("");
  lines.push(...input.report.quote.rationaleLines.map((line) => `- ${line}`));
  lines.push("");
  lines.push(`Book a consultation: ${consultationUrl()}`);
  lines.push("Reply to this email if you want the remediation scope tightened before booking.");

  return lines.join("\n");
}

function buildHtmlEmail(input: {
  answers: LandingZoneReadinessAnswers;
  report: LandingZoneReadinessReport;
}) {
  const fixes = buildTopFixes(input.report);

  return `
    <div style="background:#f3f6fb;padding:28px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #d7e2ef;border-radius:14px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0b1f3a,#145c79);padding:24px 24px 22px;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#d8e8ff;">ZoKorp Software</p>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">Landing Zone Readiness Results</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(firstName(input.answers.fullName))}, here is the condensed result for ${escapeHtml(input.answers.companyName)}.</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
            <tr>
              <td style="padding:0 8px 8px 0;">
                <div style="border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Overall score</div>
                  <div style="margin-top:6px;font-size:28px;font-weight:800;color:#0f172a;">${input.report.overallScore}/100</div>
                </div>
              </td>
              <td style="padding:0 8px 8px 8px;">
                <div style="border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Maturity band</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:800;color:#0f172a;">${escapeHtml(input.report.maturityBand)}</div>
                </div>
              </td>
              <td style="padding:0 0 8px 8px;">
                <div style="border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Quote range</div>
                  <div style="margin-top:6px;font-size:18px;font-weight:800;color:#0f172a;">${escapeHtml(toUsdRange(input.report.quote.quoteLow, input.report.quote.quoteHigh))}</div>
                </div>
              </td>
            </tr>
          </table>

          <div style="border:1px solid #d7e2ef;border-radius:12px;padding:14px;background:#f8fbff;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Category snapshot</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${buildCategoryLines(input.report)
                .map((line) => `<li>${escapeHtml(line)}</li>`)
                .join("")}
            </ul>
          </div>

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Top findings</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#0f172a;font-size:14px;line-height:1.6;">
              ${
                input.report.findings.length > 0
                  ? input.report.findings
                      .map(
                        (finding) =>
                          `<li><strong>${escapeHtml(finding.finding)}</strong><br /><span style="color:#475569;">Fix: ${escapeHtml(finding.fix)}</span></li>`,
                      )
                      .join("")
                  : "<li>No major gaps detected in the submitted answers.</li>"
              }
            </ul>
          </div>

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Top fixes</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${fixes.map((fix) => `<li>${escapeHtml(fix)}</li>`).join("")}
            </ul>
          </div>

          ${
            input.answers.biggestChallenge?.trim()
              ? `<div style="margin-top:18px;border-left:4px solid #145c79;padding:10px 0 10px 14px;color:#334155;font-size:14px;line-height:1.6;">
                  Biggest stated challenge: ${escapeHtml(input.answers.biggestChallenge.trim())}
                </div>`
              : ""
          }

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;background:#fbfcfe;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Why this quote range fits</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${input.report.quote.rationaleLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
            </ul>
          </div>

          <div style="margin-top:20px;">
            <a href="${escapeHtml(consultationUrl())}" style="display:inline-block;padding:12px 18px;background:#0f1f3f;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Book a consultation</a>
          </div>
          <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Reply to this email if you want the remediation scope tightened before booking.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildLandingZoneReadinessEmailContent(input: {
  answers: LandingZoneReadinessAnswers;
  report: LandingZoneReadinessReport;
}) {
  return {
    subject: `Landing Zone Readiness Results for ${input.answers.companyName}`,
    text: buildTextEmail(input),
    html: buildHtmlEmail(input),
  };
}
