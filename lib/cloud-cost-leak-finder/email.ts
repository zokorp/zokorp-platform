import { CONSULTATION_CTA_PATH, WASTE_CATEGORY_LABELS } from "@/lib/cloud-cost-leak-finder/config";
import { formatUsdRange } from "@/lib/cloud-cost-leak-finder/savings";
import type {
  CloudCostLeakFinderAnswers,
  CloudCostLeakFinderReport,
  WasteCategory,
} from "@/lib/cloud-cost-leak-finder/types";
import { getSiteUrl } from "@/lib/site";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "there";
}

function consultationUrl() {
  return new URL(CONSULTATION_CTA_PATH, getSiteUrl()).toString();
}

function scoreLines(report: CloudCostLeakFinderReport) {
  return [
    `Waste risk: ${report.scores.wasteRiskScore}/100`,
    `FinOps maturity: ${report.scores.finopsMaturityScore}/100`,
    `Savings confidence: ${report.scores.savingsConfidenceScore}/100`,
    `Implementation complexity: ${report.scores.implementationComplexityScore}/100`,
    `ROI plausibility: ${report.scores.roiPlausibilityScore}/100`,
    `Input confidence: ${report.scores.confidenceScore}/100`,
  ];
}

function categoryLines(categories: WasteCategory[]) {
  return categories.map((category) => WASTE_CATEGORY_LABELS[category]);
}

function quoteLineItems(report: CloudCostLeakFinderReport) {
  return report.quote.lineItems.map(
    (item) => `${item.label}: ${formatUsdRange(item.amountLow, item.amountHigh)}. ${item.reason}`,
  );
}

function buildTextEmail(input: {
  answers: CloudCostLeakFinderAnswers;
  report: CloudCostLeakFinderReport;
}) {
  const lines = [
    `Hi ${firstName(input.answers.fullName)},`,
    "",
    input.report.verdictHeadline,
    "",
    input.report.shortSummary,
    "",
    "Score snapshot:",
    ...scoreLines(input.report).map((line) => `- ${line}`),
    "",
    `Likely monthly savings: ${input.report.savingsEstimate.estimatedMonthlySavingsRange}`,
    `Likely annual savings: ${input.report.savingsEstimate.estimatedAnnualSavingsRange}`,
    "",
    "Likely waste categories:",
    ...categoryLines(input.report.likelyWasteCategories).map((line) => `- ${line}`),
    "",
    "Top findings:",
    ...input.report.topFindings.map((finding) => `- ${finding.finding} Fix: ${finding.fix}`),
    "",
    "Top actions:",
    ...input.report.topActions.map((action) => `- ${action}`),
    "",
    `What is probably causing the spend: ${input.report.primaryCauseLine}`,
    `What to do first: ${input.report.firstStepLine}`,
    "",
    `Suggested engagement: ${input.report.quote.engagementType}`,
    `Deterministic quote range: ${formatUsdRange(input.report.quote.quoteLow, input.report.quote.quoteHigh)}`,
    "Quote breakdown:",
    ...quoteLineItems(input.report).map((line) => `- ${line}`),
    ...input.report.quote.rationaleLines.map((line) => `- ${line}`),
    "",
    `Book a consultation: ${consultationUrl()}`,
    "Reply to this email if you want the scope tightened against a real billing export.",
  ];

  return lines.join("\n");
}

function buildHtmlEmail(input: {
  answers: CloudCostLeakFinderAnswers;
  report: CloudCostLeakFinderReport;
}) {
  return `
    <div style="background:#f3f6fb;padding:28px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d7e2ef;border-radius:14px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0b1f3a,#145c79);padding:24px 24px 22px;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#d8e8ff;">ZoKorp Software</p>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">Cloud Cost Leak Finder</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0;font-size:15px;line-height:1.6;">Hi ${escapeHtml(firstName(input.answers.fullName))},</p>
          <h2 style="margin:12px 0 8px;font-size:26px;line-height:1.25;color:#0f172a;">${escapeHtml(input.report.verdictHeadline)}</h2>
          <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${escapeHtml(input.report.shortSummary)}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;">
            <tr>
              <td style="padding:0 8px 8px 0;">
                <div style="border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Monthly savings</div>
                  <div style="margin-top:6px;font-size:24px;font-weight:800;color:#0f172a;">${escapeHtml(input.report.savingsEstimate.estimatedMonthlySavingsRange)}</div>
                </div>
              </td>
              <td style="padding:0 0 8px 8px;">
                <div style="border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Quote range</div>
                  <div style="margin-top:6px;font-size:22px;font-weight:800;color:#0f172a;">${escapeHtml(formatUsdRange(input.report.quote.quoteLow, input.report.quote.quoteHigh))}</div>
                </div>
              </td>
            </tr>
          </table>

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;background:#fbfcfe;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Score snapshot</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${scoreLines(input.report).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
            </ul>
          </div>

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;background:#f8fbff;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Likely waste categories</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${categoryLines(input.report.likelyWasteCategories).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
            </ul>
          </div>

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Top findings</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#0f172a;font-size:14px;line-height:1.6;">
              ${input.report.topFindings.map((finding) => `<li><strong>${escapeHtml(finding.finding)}</strong><br /><span style="color:#475569;">Fix: ${escapeHtml(finding.fix)}</span></li>`).join("")}
            </ul>
          </div>

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Top actions</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${input.report.topActions.map((action) => `<li>${escapeHtml(action)}</li>`).join("")}
            </ul>
          </div>

          <div style="margin-top:18px;border-left:4px solid #145c79;padding:10px 0 10px 14px;color:#334155;font-size:14px;line-height:1.7;">
            <strong>What is probably causing the spend:</strong> ${escapeHtml(input.report.primaryCauseLine)}<br />
            <strong>What to do first:</strong> ${escapeHtml(input.report.firstStepLine)}
          </div>

          <div style="margin-top:18px;border:1px solid #d7e2ef;border-radius:12px;padding:14px;background:#fbfcfe;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Suggested engagement</div>
            <p style="margin:10px 0 0;color:#0f172a;font-size:18px;font-weight:800;">${escapeHtml(input.report.quote.engagementType)}</p>
            <p style="margin:8px 0 0;color:#334155;font-size:14px;line-height:1.6;">Deterministic quote range: ${escapeHtml(formatUsdRange(input.report.quote.quoteLow, input.report.quote.quoteHigh))}</p>
            <div style="margin-top:12px;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Quote breakdown</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${quoteLineItems(input.report).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
            </ul>
            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.6;">
              ${input.report.quote.rationaleLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
            </ul>
          </div>

          <div style="margin-top:20px;">
            <a href="${escapeHtml(consultationUrl())}" style="display:inline-block;padding:12px 18px;background:#0f1f3f;border-radius:8px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Book a consultation</a>
          </div>
          <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Reply with a cleaner top-services billing export if you want the next pass narrowed further.</p>
        </div>
      </div>
    </div>
  `;
}

export function buildCloudCostLeakFinderEmailContent(input: {
  answers: CloudCostLeakFinderAnswers;
  report: CloudCostLeakFinderReport;
}) {
  return {
    subject: `Cloud Cost Leak Finder results for ${input.answers.companyName}`,
    text: buildTextEmail(input),
    html: buildHtmlEmail(input),
  };
}
