import type {
  ArchitectureEstimateSnapshot,
  ArchitectureQuoteTier,
  ArchitectureReviewReport,
} from "@/lib/architecture-review/types";
import { buildFallbackArchitectureEstimateSnapshot } from "@/lib/architecture-review/rule-catalog";
import { buildEmailPreferenceFooter } from "@/lib/email-preferences";
import { getSiteUrl } from "@/lib/site";

function providerLabel(provider: ArchitectureReviewReport["provider"]) {
  return provider.toUpperCase();
}

function confidenceLabel(confidence: ArchitectureReviewReport["analysisConfidence"]) {
  if (confidence === "high") {
    return "High confidence";
  }

  if (confidence === "medium") {
    return "Medium confidence";
  }

  return "Low confidence";
}

function quoteTierLabel(quoteTier: ArchitectureQuoteTier) {
  if (quoteTier === "advisory-review") {
    return "Advisory Review";
  }

  if (quoteTier === "remediation-sprint") {
    return "Remediation Sprint";
  }

  return "Implementation Partner";
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

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailCtaLinks = {
  bookArchitectureCallUrl: string;
};

function resolveDefaultCtaLinks() {
  const siteUrl = getSiteUrl();
  return {
    bookArchitectureCallUrl: process.env.ARCH_REVIEW_BOOK_CALL_URL ?? `${siteUrl}/services#service-request`,
  } satisfies EmailCtaLinks;
}

function confidenceStyles(confidence: ArchitectureReviewReport["analysisConfidence"]) {
  if (confidence === "high") {
    return {
      border: "#16a34a",
      text: "#166534",
      bg: "#f0fdf4",
    };
  }

  if (confidence === "medium") {
    return {
      border: "#2563eb",
      text: "#1d4ed8",
      bg: "#eff6ff",
    };
  }

  return {
    border: "#ea580c",
    text: "#9a3412",
    bg: "#fff7ed",
  };
}

function nextStepNote(report: ArchitectureReviewReport, estimateSnapshot: ArchitectureEstimateSnapshot) {
  if (estimateSnapshot.policy.band === "consultation-only") {
    return estimateSnapshot.policy.nextStep;
  }

  if (report.analysisConfidence === "low") {
    return "The estimate below is limited to the issues visible in the submitted material. Use the booking link to confirm whether any hidden dependencies would change scope.";
  }

  if (report.quoteTier === "implementation-partner") {
    return "The estimate below covers the fixes visible in this review. If the follow-up uncovers a broader redesign or rollout program, that extra scope is handled separately.";
  }

  return estimateSnapshot.policy.nextStep;
}

function estimateSectionTitle(estimateSnapshot: ArchitectureEstimateSnapshot) {
  if (estimateSnapshot.policy.band === "consultation-only") {
    return "Consultation Path";
  }

  if (estimateSnapshot.policy.band === "optional-polish") {
    return "Optional Polish Scope";
  }

  return "Implementation Estimate";
}

function estimateSectionTextLabel(estimateSnapshot: ArchitectureEstimateSnapshot) {
  if (estimateSnapshot.policy.band === "consultation-only") {
    return "Consultation path";
  }

  return "Implementation estimate";
}

function ctaLabel(estimateSnapshot: ArchitectureEstimateSnapshot) {
  if (estimateSnapshot.policy.band === "consultation-only") {
    return "Book consultation";
  }

  if (estimateSnapshot.policy.band === "optional-polish") {
    return "Book polish follow-up";
  }

  return "Book implementation follow-up";
}

function buildHtmlEmail(
  report: ArchitectureReviewReport,
  estimateSnapshot: ArchitectureEstimateSnapshot,
  ctaLinks: EmailCtaLinks,
  officialEstimateReference?: string | null,
  emailPreferenceFooterHtml?: string,
) {
  const mandatoryFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const optionalRecommendations = report.findings.filter((finding) => finding.pointsDeducted === 0);
  const generatedAt = new Date(report.generatedAtISO).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  const confidence = confidenceStyles(report.analysisConfidence);
  const snapshotByRuleId = new Map(estimateSnapshot.lineItems.map((lineItem) => [lineItem.ruleId, lineItem]));

  const topDeductionsHtml =
    mandatoryFindings.length > 0
      ? mandatoryFindings
          .slice(0, 6)
          .map(
            (finding, index) => {
              const lineItem = snapshotByRuleId.get(finding.ruleId);

              return `
                <tr>
                  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;width:44px;">${index + 1}</td>
                  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;">
                    <div style="font-weight:700;">-${finding.pointsDeducted} points | ${escapeHtml(finding.ruleId)}</div>
                    <div style="margin-top:4px;">${escapeHtml(finding.message)}</div>
                    <div style="margin-top:4px;color:#334155;">Fix: ${escapeHtml(finding.fix)}</div>
                    ${
                      lineItem
                        ? `<div style="margin-top:4px;color:#334155;">Quoted line: ${escapeHtml(lineItem.serviceLineLabel)} · ${escapeHtml(toUsd(lineItem.amountUsd))} · ${escapeHtml(formatHours(lineItem.estimatedHours))}</div>`
                        : ""
                    }
                  </td>
                </tr>
              `;
            },
          )
          .join("")
      : `<tr><td colspan="2" style="padding:10px 12px;color:#0f172a;font-size:13px;">No mandatory deductions were found.</td></tr>`;

  const quoteRows =
    estimateSnapshot.lineItems.length > 0
      ? estimateSnapshot.lineItems
          .map(
            (lineItem) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;">
                      <div style="font-weight:700;">${escapeHtml(lineItem.ruleId)} · ${escapeHtml(lineItem.serviceLineLabel)}</div>
                      <div style="margin-top:4px;color:#334155;">${escapeHtml(lineItem.publicFixSummary)}</div>
                      ${
                        lineItem.officialSourceLinks.length > 0
                          ? `<div style="margin-top:4px;color:#475569;">Official references: ${lineItem.officialSourceLinks
                              .map(
                                (link) =>
                                  `<a href="${escapeHtml(link.url)}" style="color:#0f5c7a;text-decoration:none;">${escapeHtml(link.label)}</a>`,
                              )
                              .join(" · ")}</div>`
                          : ""
                      }
                    </td>
                <td align="right" style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:14px;font-weight:800;white-space:nowrap;">
                  ${escapeHtml(toUsd(lineItem.amountUsd))}
                  <div style="margin-top:4px;font-size:11px;font-weight:600;color:#475569;">${escapeHtml(formatHours(lineItem.estimatedHours))}</div>
                </td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="2" style="padding:10px 12px;color:#334155;font-size:13px;">${
          estimateSnapshot.policy.band === "consultation-only"
            ? "No payable remediation quote is attached at this score band. Use the booking link to move into consultation."
            : "No implementation estimate was produced because no mandatory fix scope was detected."
        }</td></tr>`;

  const optionalRows =
    optionalRecommendations.length > 0
      ? optionalRecommendations
          .map(
            (finding, index) => `
              <tr>
                <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#334155;font-size:13px;width:28px;">${index + 1}.</td>
                <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#334155;font-size:13px;">
                  <span style="font-weight:700;color:#0f172a;">${escapeHtml(finding.ruleId)}:</span>
                  ${escapeHtml(finding.message)}
                </td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="2" style="padding:9px 12px;color:#334155;font-size:13px;">No optional recommendations.</td></tr>`;

  const assumptionsHtml = estimateSnapshot.assumptions.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const exclusionsHtml = estimateSnapshot.exclusions.map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef3f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f9;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:860px;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:18px 22px;background:#0f2f5f;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.9;">ZoKorp Architecture Review</div>
                <div style="margin-top:8px;font-size:28px;line-height:1.2;font-weight:700;">
                  ${providerLabel(report.provider)} Score ${report.overallScore}/100
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 22px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="25%" valign="top" style="padding:0 8px 10px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;">
                        <tr>
                          <td style="padding:10px 12px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Overall Score</div>
                            <div style="margin-top:4px;font-size:24px;font-weight:800;color:#0f172a;">${report.overallScore}/100</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="25%" valign="top" style="padding:0 4px 10px 4px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;">
                        <tr>
                          <td style="padding:10px 12px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">${escapeHtml(
                              estimateSectionTitle(estimateSnapshot),
                            )}</div>
                      <div style="margin-top:4px;font-size:24px;font-weight:800;color:#0f172a;">${escapeHtml(
                              estimateSnapshot.policy.payableQuoteEnabled ? toUsd(estimateSnapshot.totalUsd) : "Consultation first",
                            )}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="25%" valign="top" style="padding:0 4px 10px 4px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;">
                        <tr>
                          <td style="padding:10px 12px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Estimate Reference</div>
                            <div style="margin-top:4px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(
                              estimateSnapshot.referenceCode,
                            )}</div>
                            ${
                              officialEstimateReference
                                ? `<div style="margin-top:8px;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Formal Estimate</div>
                            <div style="margin-top:4px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(officialEstimateReference)}</div>`
                                : ""
                            }
                            <div style="margin-top:8px;font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Recommended Work Path</div>
                            <div style="margin-top:4px;font-size:16px;font-weight:800;color:#0f172a;">${escapeHtml(
                              quoteTierLabel(report.quoteTier),
                            )}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="25%" valign="top" style="padding:0 0 10px 8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${confidence.border};border-radius:10px;background:${confidence.bg};">
                        <tr>
                          <td style="padding:10px 12px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Analysis Confidence</div>
                            <div style="margin-top:4px;font-size:16px;font-weight:800;color:${confidence.text};">${escapeHtml(
                              confidenceLabel(report.analysisConfidence),
                            )}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;">
                  <tr>
                    <td style="padding:14px;">
                      <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Flow Narrative</div>
                      <div style="margin-top:8px;line-height:1.5;font-size:14px;color:#0f172a;">${escapeHtml(report.flowNarrative)}</div>
                      <div style="margin-top:8px;color:#64748b;font-size:12px;">Generated: ${escapeHtml(generatedAt)}</div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;">
                  <tr>
                    <td style="padding:14px;">
                      <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Next Step</div>
                      <div style="margin-top:8px;line-height:1.5;font-size:14px;color:#0f172a;">${escapeHtml(nextStepNote(report, estimateSnapshot))}</div>
                      <div style="margin-top:12px;">
                        <a href="${escapeHtml(ctaLinks.bookArchitectureCallUrl)}" style="display:inline-block;border-radius:8px;background:#0f172a;color:#ffffff;padding:10px 14px;font-size:13px;font-weight:700;text-decoration:none;">${escapeHtml(
                          ctaLabel(estimateSnapshot),
                        )}</a>
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">Top Deductions</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
                  <tr>
                    <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#334155;width:44px;">#</td>
                    <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#334155;">Finding</td>
                  </tr>
                  ${topDeductionsHtml}
                </table>

                <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(estimateSectionTitle(estimateSnapshot))}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
                  <tr>
                    <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#334155;">Service Line</td>
                    <td align="right" style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#334155;width:120px;">Amount</td>
                  </tr>
                  ${quoteRows}
                  <tr>
                    <td style="padding:12px;font-size:14px;font-weight:800;color:#0f172a;">Estimated total (based on submitted materials)</td>
                    <td align="right" style="padding:12px;font-size:16px;font-weight:900;color:#0f172a;">${escapeHtml(
                      estimateSnapshot.policy.payableQuoteEnabled ? toUsd(estimateSnapshot.totalUsd) : "Consultation first",
                    )}</td>
                  </tr>
                </table>

                <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">Assumptions and Exclusions</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
                  <tr>
                    <td width="50%" valign="top" style="padding-right:8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;">
                        <tr>
                          <td style="padding:14px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Assumptions</div>
                            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:13px;line-height:1.6;">
                              ${assumptionsHtml}
                            </ul>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="50%" valign="top" style="padding-left:8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;">
                        <tr>
                          <td style="padding:14px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Exclusions</div>
                            <ul style="margin:10px 0 0;padding-left:18px;color:#334155;font-size:13px;line-height:1.6;">
                              ${exclusionsHtml}
                            </ul>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">Optional Recommendations</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
                  ${optionalRows}
                </table>
                ${emailPreferenceFooterHtml ?? ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export function buildArchitectureReviewEmailContent(
  report: ArchitectureReviewReport,
  options?: {
    ctaLinks?: Partial<EmailCtaLinks>;
    estimateSnapshot?: ArchitectureEstimateSnapshot;
    officialEstimateReference?: string | null;
    emailPreferenceLinks?: {
      manageUrl: string;
      marketingUnsubscribeUrl: string;
    } | null;
  },
) {
  const defaults = resolveDefaultCtaLinks();
  const ctaLinks: EmailCtaLinks = {
    bookArchitectureCallUrl: options?.ctaLinks?.bookArchitectureCallUrl ?? defaults.bookArchitectureCallUrl,
  };
  const estimateSnapshot =
    options?.estimateSnapshot ??
    buildFallbackArchitectureEstimateSnapshot(report, {
      bookingUrl: ctaLinks.bookArchitectureCallUrl,
    }).snapshot;
  const mandatoryFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const optionalRecommendations = report.findings.filter((finding) => finding.pointsDeducted === 0);
  const officialEstimateReference =
    typeof options?.officialEstimateReference === "string" && options.officialEstimateReference.trim()
      ? options.officialEstimateReference.trim()
      : null;
  const emailPreferenceFooter = options?.emailPreferenceLinks
    ? buildEmailPreferenceFooter(options.emailPreferenceLinks)
    : null;

  const lines = [
    `Architecture Diagram Review (${providerLabel(report.provider)})`,
    `Generated: ${report.generatedAtISO}`,
    `Email: ${report.userEmail}`,
    "",
    `Overall score: ${report.overallScore}/100`,
    `Analysis confidence: ${confidenceLabel(report.analysisConfidence)}`,
    `Recommended work path: ${quoteTierLabel(report.quoteTier)}`,
    `Estimate reference: ${estimateSnapshot.referenceCode}`,
    ...(officialEstimateReference ? [`Formal estimate reference: ${officialEstimateReference}`] : []),
    `${estimateSectionTextLabel(estimateSnapshot)}: ${
      estimateSnapshot.policy.payableQuoteEnabled ? toUsd(estimateSnapshot.totalUsd) : "Consultation first"
    }`,
    "",
    "Flow narrative:",
    report.flowNarrative,
    "",
    "Next step:",
    nextStepNote(report, estimateSnapshot),
    `${ctaLabel(estimateSnapshot)}: ${ctaLinks.bookArchitectureCallUrl}`,
    "",
    "Top deductions:",
    ...(mandatoryFindings.length > 0
      ? mandatoryFindings.slice(0, 6).map((finding) => `- ${finding.ruleId} | -${finding.pointsDeducted} points | ${finding.message}`)
      : ["No mandatory deductions."]),
    "",
    `${estimateSectionTextLabel(estimateSnapshot)}:`,
    ...(estimateSnapshot.lineItems.length > 0
      ? estimateSnapshot.lineItems.map(
          (lineItem) =>
            `- ${lineItem.ruleId} | ${lineItem.serviceLineLabel} | ${toUsd(lineItem.amountUsd)} | ${formatHours(lineItem.estimatedHours)} | ${lineItem.publicFixSummary}${
              lineItem.officialSourceLinks.length > 0
                ? ` | References: ${lineItem.officialSourceLinks.map((link) => `${link.label} (${link.url})`).join(", ")}`
                : ""
            }`,
        )
      : estimateSnapshot.policy.band === "consultation-only"
        ? ["No payable remediation quote is attached at this score band. Use the consultation link to confirm the real target-state scope."]
        : ["No implementation estimate was produced because no mandatory fix scope was detected."]),
    `Estimated total (based on submitted materials): ${
      estimateSnapshot.policy.payableQuoteEnabled ? toUsd(estimateSnapshot.totalUsd) : "Consultation first"
    }`,
    "",
    "Estimate assumptions:",
    ...estimateSnapshot.assumptions.map((line) => `- ${line}`),
    "",
    "Estimate exclusions:",
    ...estimateSnapshot.exclusions.map((line) => `- ${line}`),
    "",
    "Optional recommendations:",
    ...(optionalRecommendations.length > 0
      ? optionalRecommendations.map((finding) => `- ${finding.ruleId} | ${finding.message}`)
      : ["No optional recommendations."]),
    ...(emailPreferenceFooter ? ["", emailPreferenceFooter.text] : []),
  ];

  const subject =
    estimateSnapshot.policy.band === "consultation-only"
      ? `[ZoKorp] ${providerLabel(report.provider)} architecture review ${report.overallScore}/100`
      : `[ZoKorp] ${providerLabel(report.provider)} architecture estimate ${report.overallScore}/100`;
  const text = lines.join("\n");
  const html = buildHtmlEmail(report, estimateSnapshot, ctaLinks, officialEstimateReference, emailPreferenceFooter?.html);

  return {
    subject,
    text,
    html,
  };
}

export function buildMailtoUrl(input: { to: string; subject: string; body: string; maxLength?: number }) {
  const maxLength = input.maxLength ?? 1800;
  const encodedSubject = encodeURIComponent(input.subject);
  const encodedBody = encodeURIComponent(input.body);
  const mailto = `mailto:${encodeURIComponent(input.to)}?subject=${encodedSubject}&body=${encodedBody}`;

  if (mailto.length > maxLength) {
    return null;
  }

  return mailto;
}

export function buildEmlDocument(input: { to: string; subject: string; body: string }) {
  const utcDate = new Date().toUTCString();
  const escapedBody = input.body.replace(/\r?\n/g, "\r\n");

  return [
    `From: ZoKorp Platform <no-reply@zokorp.local>`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    `Date: ${utcDate}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    escapedBody,
    "",
  ].join("\r\n");
}
