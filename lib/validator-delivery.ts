import { sendToolResultEmail } from "@/lib/architecture-review/sender";
import { buildEmailPreferenceFooter } from "@/lib/email-preferences";
import {
  buildValidatorEstimate,
  type ValidatorEstimate,
} from "@/lib/validator-estimate-catalog";
export { buildValidatorEstimate };
export type { ValidatorEstimate };
import type { ValidationReport } from "@/lib/zokorp-validator-engine";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} hour${rounded === 1 ? "" : "s"}`;
}

function emailRows(report: ValidationReport) {
  const failingControls = (report.controlCalibration?.controls ?? [])
    .filter((control) => control.status !== "PASS")
    .slice(0, 5);

  if (failingControls.length > 0) {
    return failingControls
      .map(
        (control) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">
              <div style="font-weight:700;">${escapeHtml(control.controlId)} · ${escapeHtml(control.status)}</div>
              <div style="margin-top:4px;color:#334155;">${escapeHtml(control.requirement)}</div>
              <div style="margin-top:4px;color:#0f172a;">Suggested rewrite: ${escapeHtml(control.suggestedEdit)}</div>
            </td>
          </tr>
        `,
      )
      .join("");
  }

  return report.checks
    .filter((check) => check.status !== "PASS")
    .slice(0, 5)
    .map(
      (check) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">
            <div style="font-weight:700;">${escapeHtml(check.title)} · ${escapeHtml(check.status)}</div>
            <div style="margin-top:4px;color:#334155;">${escapeHtml(check.guidance)}</div>
          </td>
        </tr>
      `,
    )
    .join("");
}

export function buildValidatorEmailContent(input: {
  report: ValidationReport;
  estimate: ValidatorEstimate;
  toEmail: string;
  officialEstimateReference?: string | null;
  emailPreferenceLinks?: {
    manageUrl: string;
    marketingUnsubscribeUrl: string;
  } | null;
}) {
  const { report, estimate } = input;
  const consultationOnlyEstimate = estimate.quoteUsd === 0 && estimate.lineItems.length === 0;
  const officialEstimateReference =
    typeof input.officialEstimateReference === "string" && input.officialEstimateReference.trim()
      ? input.officialEstimateReference.trim()
      : null;
  const emailPreferenceFooter = input.emailPreferenceLinks ? buildEmailPreferenceFooter(input.emailPreferenceLinks) : null;
  const topRows = emailRows(report);
  const subject = `[ZoKorp] ${report.profileLabel} validation result ${report.score}%`;
  const text = [
    `${report.profileLabel} validation result`,
    `Score: ${report.score}%`,
    `Estimate: ${consultationOnlyEstimate ? "Consultation only" : toUsd(estimate.quoteUsd)}`,
    `Estimated effort: ${formatHours(estimate.estimatedHoursTotal)}`,
    ...(officialEstimateReference ? [`Formal estimate reference: ${officialEstimateReference}`] : []),
    `SLA: ${estimate.slaLabel}`,
    "",
    report.summary,
    "",
    estimate.summary,
    estimate.nextStep,
    "",
    ...(estimate.lineItems.length > 0
      ? [
          "Estimated scope:",
          ...estimate.lineItems.map(
            (lineItem) =>
              `- ${lineItem.serviceLineLabel}: ${toUsd(lineItem.amountUsd)} · ${formatHours(lineItem.estimatedHours)} · ${lineItem.publicFixSummary}`,
          ),
        ]
      : ["No payable remediation quote was generated for this run."]),
    ...(emailPreferenceFooter ? ["", emailPreferenceFooter.text] : []),
  ].join("\n");
  const html = `
    <div style="background:#f3f6fb;padding:28px 16px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #d7e2ef;border-radius:14px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0b1f3a,#145c79);padding:24px;color:#ffffff;">
          <p style="margin:0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#d8e8ff;">ZoKorp Validator</p>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;font-weight:700;">${escapeHtml(report.profileLabel)} score ${report.score}%</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(report.summary)}</p>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;">
            <div style="min-width:180px;border:1px solid #dbe3ef;border-radius:10px;padding:12px;">
              <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Estimate</div>
              <div style="margin-top:4px;font-size:${consultationOnlyEstimate ? "18px" : "24px"};font-weight:800;">${escapeHtml(
                consultationOnlyEstimate ? "Consultation only" : toUsd(estimate.quoteUsd),
              )}</div>
            </div>
            <div style="min-width:180px;border:1px solid #dbe3ef;border-radius:10px;padding:12px;">
              <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">SLA</div>
              <div style="margin-top:4px;font-size:20px;font-weight:800;">${escapeHtml(estimate.slaLabel)}</div>
            </div>
            <div style="min-width:180px;border:1px solid #dbe3ef;border-radius:10px;padding:12px;">
              <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Estimated effort</div>
              <div style="margin-top:4px;font-size:20px;font-weight:800;">${escapeHtml(formatHours(estimate.estimatedHoursTotal))}</div>
            </div>
            ${
              officialEstimateReference
                ? `<div style="min-width:180px;border:1px solid #dbe3ef;border-radius:10px;padding:12px;">
              <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Estimate reference</div>
              <div style="margin-top:4px;font-size:20px;font-weight:800;">${escapeHtml(officialEstimateReference)}</div>
            </div>`
                : ""
            }
          </div>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(estimate.summary)}</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#0f172a;font-weight:600;">${escapeHtml(estimate.nextStep)}</p>
          ${
            estimate.lineItems.length > 0
              ? `<div style="font-size:18px;font-weight:700;margin-bottom:8px;">Estimated scope</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
            ${estimate.lineItems
              .map(
                (lineItem) => `
                  <tr>
                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">
                      <div style="font-weight:700;">${escapeHtml(lineItem.serviceLineLabel)}</div>
                      <div style="margin-top:4px;color:#334155;">${escapeHtml(lineItem.publicFixSummary)}</div>
                      <div style="margin-top:4px;color:#475569;">${escapeHtml(lineItem.status)} · ${escapeHtml(toUsd(lineItem.amountUsd))} · ${escapeHtml(formatHours(lineItem.estimatedHours))}</div>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </table>`
              : `<div style="margin:0 0 18px;padding:14px 16px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;font-size:14px;line-height:1.6;color:#334155;">No payable remediation quote was generated for this run. The next step is consultation because the current package is not safe to auto-scope.</div>`
          }
          <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Top issues</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
            ${topRows}
          </table>
          ${emailPreferenceFooter?.html ?? ""}
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

export async function sendValidatorResultsEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const result = await sendToolResultEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (result.ok) {
    return {
      ok: true,
      status: "sent" as const,
    };
  }

  if (result.provider === null) {
    return {
      ok: false,
      status: "not_configured" as const,
      error: result.error ?? "EMAIL_NOT_CONFIGURED",
    };
  }

  return {
    ok: false,
    status: "failed" as const,
    error: result.error ?? "EMAIL_DELIVERY_UNKNOWN",
  };
}
