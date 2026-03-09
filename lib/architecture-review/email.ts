import type { ArchitectureQuoteTier, ArchitectureReviewReport } from "@/lib/architecture-review/types";
import { getArchitectureReviewPricingCatalogEntry } from "@/lib/architecture-review/pricing-catalog";
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

function findingLine(index: number, finding: ArchitectureReviewReport["findings"][number]) {
  const serviceLine = getArchitectureReviewPricingCatalogEntry(finding.ruleId)?.serviceLine;
  return `${index + 1}. pointsDeducted=${finding.pointsDeducted} | message=${finding.message} | fix=${finding.fix} | ruleId=${finding.ruleId}${serviceLine ? ` | serviceLine=${serviceLine}` : ""} | estFixCost=$${finding.fixCostUSD}`;
}

function toUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function roundToNearest(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EngagementPackage = {
  name: string;
  timeline: string;
  priceLabel: string;
  summary: string;
  recommended: boolean;
};

type EngagementGuidance = {
  mode: "standard" | "diagnostic-only" | "custom-after-call";
  noteTitle: string;
  noteBody: string;
  quoteBasisHtml: string;
  quoteBasisLines: string[];
  secondaryCtaLabel: string;
};

type EmailCtaLinks = {
  bookArchitectureCallUrl: string;
  requestRemediationPlanUrl: string;
};

function buildEngagementGuidance(report: ArchitectureReviewReport): EngagementGuidance {
  if (report.analysisConfidence === "low") {
    return {
      mode: "diagnostic-only",
      noteTitle: "This review stays diagnostic-first",
      noteBody:
        "The current evidence bundle is too ambiguous to pre-approve a remediation sprint. Start with the fixed advisory review, then scope any delivery work only after the live call confirms the findings.",
      quoteBasisHtml:
        "Quote method: the advisory review stays fixed at $249. Low-confidence reviews do not auto-approve a remediation package from the free submission alone.",
      quoteBasisLines: [
        "- The advisory review stays fixed at $249.",
        "- Low-confidence reviews do not auto-approve remediation scope from the free submission alone.",
        "- serviceLine values identify the consulting work implied by each finding.",
      ],
      secondaryCtaLabel: "Request scoped follow-up",
    };
  }

  if (report.quoteTier === "implementation-partner") {
    return {
      mode: "custom-after-call",
      noteTitle: "This moves to custom scope",
      noteBody:
        "This review points to broader delivery work, higher scoping risk, or constraints that should not be auto-quoted from a free upload. The next step is the fixed advisory review, followed by a custom proposal if the work is a fit.",
      quoteBasisHtml:
        "Quote method: the advisory review stays fixed at $249. Broader or riskier delivery paths move to custom scoping after the advisory call instead of pretending the free review produced a final implementation quote.",
      quoteBasisLines: [
        "- The advisory review stays fixed at $249.",
        "- Broader or riskier delivery paths move to custom scoping after the advisory call.",
        "- serviceLine values identify the consulting work implied by each finding.",
      ],
      secondaryCtaLabel: "Request scoped engagement",
    };
  }

  return {
    mode: "standard",
    noteTitle: "How the next step is chosen",
    noteBody:
      "The core quote is built from deterministic finding-based scope drivers. Remediation Sprint remains a bounded micro-sprint, not an open-ended implementation commitment.",
    quoteBasisHtml:
      "Quote method: $249 advisory baseline plus deterministic finding-based scope drivers, then workload criticality and evidence confidence shape the bounded core quote. Top-finding fix estimates are scope drivers, not separate invoice lines.",
    quoteBasisLines: [
      "- $249 advisory baseline + deterministic per-finding scope drivers.",
      "- Workload criticality and evidence confidence shape the bounded core quote.",
      "- serviceLine values identify the consulting work implied by each finding.",
    ],
    secondaryCtaLabel: "Request remediation plan",
  };
}

function buildEngagementPackages(
  report: ArchitectureReviewReport,
  guidance: EngagementGuidance,
): EngagementPackage[] {
  const remediationLow = roundToNearest(clamp(Math.round(report.consultationQuoteUSD * 0.9), 650, 2200), 25);
  const remediationHigh = roundToNearest(clamp(Math.round(report.consultationQuoteUSD * 1.2), 850, 2800), 25);
  const advisorySummary =
    guidance.mode === "diagnostic-only"
      ? "Required first step to validate the findings, sequence fixes, and decide whether any paid delivery scope is safe to quote."
      : guidance.mode === "custom-after-call"
        ? "Required scoping call to confirm constraints, stakeholders, and the first safe delivery milestone."
        : "Working session to prioritize findings, sequence fixes, and assign clear ownership.";
  const remediationSummary =
    guidance.mode === "diagnostic-only"
      ? "Held until the advisory review confirms the findings and defines a bounded micro-sprint."
      : guidance.mode === "custom-after-call"
        ? "Used only if the advisory call narrows the work into a hard-capped remediation sprint."
        : "Hard-capped fix package for the highest-impact deductions with updated architecture artifacts.";
  const implementationSummary =
    guidance.mode === "diagnostic-only"
      ? "Not quoted from the free report alone. Only discussed if the diagnostic call shows a broader redesign is justified."
      : guidance.mode === "custom-after-call"
        ? "Custom scoped redesign and execution support after the advisory call confirms scope, ownership, and rollout constraints."
        : "End-to-end redesign and execution support with governance and rollout milestones.";

  return [
    {
      name: "Advisory Review",
      timeline: "45 min",
      priceLabel: toUsd(249),
      summary: advisorySummary,
      recommended: report.quoteTier === "advisory-review",
    },
    {
      name: "Remediation Sprint",
      timeline: "1-3 weeks",
      priceLabel: `${toUsd(remediationLow)} - ${toUsd(remediationHigh)}`,
      summary: remediationSummary,
      recommended: report.quoteTier === "remediation-sprint",
    },
    {
      name: "Implementation Partner",
      timeline: "3-8+ weeks",
      priceLabel: "Custom",
      summary: implementationSummary,
      recommended: report.quoteTier === "implementation-partner",
    },
  ];
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

function resolveDefaultCtaLinks() {
  const siteUrl = getSiteUrl();
  return {
    bookArchitectureCallUrl: `${siteUrl}/services#service-request`,
    requestRemediationPlanUrl: `${siteUrl}/services#service-request`,
  } satisfies EmailCtaLinks;
}

function buildHtmlEmail(report: ArchitectureReviewReport, ctaLinks: EmailCtaLinks) {
  const mandatoryFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const topDeductions = mandatoryFindings.slice(0, 5);
  const optionalRecommendations = report.findings.filter((finding) => finding.pointsDeducted === 0);
  const guidance = buildEngagementGuidance(report);
  const packages = buildEngagementPackages(report, guidance);
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

  const topDeductionsHtml =
    topDeductions.length > 0
      ? topDeductions
          .map(
            (finding, index) => {
              const serviceLine = getArchitectureReviewPricingCatalogEntry(finding.ruleId)?.serviceLine;
              return `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;width:44px;">${index + 1}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;">
                  <div style="font-weight:700;">-${finding.pointsDeducted} points | ${escapeHtml(finding.ruleId)}</div>
                  <div style="margin-top:4px;">${escapeHtml(finding.message)}</div>
                  <div style="margin-top:4px;color:#334155;">Fix: ${escapeHtml(finding.fix)}</div>
                  ${serviceLine ? `<div style="margin-top:4px;color:#334155;">Service line: ${escapeHtml(serviceLine)}</div>` : ""}
                  <div style="margin-top:4px;color:#64748b;">Estimated fix effort: ${toUsd(finding.fixCostUSD)}</div>
                </td>
              </tr>
            `;
            },
          )
          .join("")
      : `<tr><td colspan="2" style="padding:10px 12px;color:#0f172a;font-size:13px;">No mandatory deductions were found.</td></tr>`;

  const optionalHtmlRows =
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

  const packageHtmlRows = packages
    .map(
      (pkg) => `
        <tr>
          <td style="padding:0 0 10px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${pkg.recommended ? "#1d4ed8" : "#cbd5e1"};background:${pkg.recommended ? "#eff6ff" : "#ffffff"};border-radius:10px;">
              <tr>
                <td style="padding:12px 14px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align:top;color:#0f172a;">
                        <div style="font-size:16px;font-weight:700;line-height:1.35;">${escapeHtml(pkg.name)}</div>
                        <div style="margin-top:4px;font-size:13px;color:#334155;">Timeline: ${escapeHtml(pkg.timeline)}</div>
                      </td>
                      <td align="right" style="vertical-align:top;color:#0f172a;font-size:18px;font-weight:800;padding-left:10px;white-space:nowrap;">
                        ${escapeHtml(pkg.priceLabel)}
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top:8px;color:#334155;font-size:13px;line-height:1.45;">${escapeHtml(pkg.summary)}</div>
                  ${
                    pkg.recommended
                      ? '<div style="margin-top:10px;font-size:12px;font-weight:700;color:#1e40af;">Recommended for this score profile</div>'
                      : ""
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `,
    )
    .join("");

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
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Core Quote</div>
                            <div style="margin-top:4px;font-size:24px;font-weight:800;color:#0f172a;">${toUsd(report.consultationQuoteUSD)}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="25%" valign="top" style="padding:0 4px 10px 4px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe3ef;border-radius:10px;">
                        <tr>
                          <td style="padding:10px 12px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Recommended Tier</div>
                            <div style="margin-top:4px;font-size:16px;font-weight:800;color:#0f172a;">${escapeHtml(quoteTierLabel(report.quoteTier))}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td width="25%" valign="top" style="padding:0 0 10px 8px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${confidence.border};border-radius:10px;background:${confidence.bg};">
                        <tr>
                          <td style="padding:10px 12px;">
                            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Analysis Confidence</div>
                            <div style="margin-top:4px;font-size:16px;font-weight:800;color:${confidence.text};">${escapeHtml(confidenceLabel(report.analysisConfidence))}</div>
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

                <div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;">
                  <a href="${escapeHtml(ctaLinks.bookArchitectureCallUrl)}" style="display:inline-block;border-radius:8px;background:#0f172a;color:#ffffff;padding:10px 14px;font-size:13px;font-weight:700;text-decoration:none;">Book architecture call</a>
                  <a href="${escapeHtml(ctaLinks.requestRemediationPlanUrl)}" style="display:inline-block;border-radius:8px;border:1px solid #cbd5e1;color:#0f172a;background:#ffffff;padding:10px 14px;font-size:13px;font-weight:700;text-decoration:none;">${escapeHtml(guidance.secondaryCtaLabel)}</a>
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;">
                  <tr>
                    <td style="padding:14px;">
                      <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">${escapeHtml(guidance.noteTitle)}</div>
                      <div style="margin-top:8px;line-height:1.5;font-size:14px;color:#0f172a;">${escapeHtml(guidance.noteBody)}</div>
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

                <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">Engagement Options</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
                  ${packageHtmlRows}
                </table>
                <div style="margin-top:6px;font-size:12px;color:#64748b;line-height:1.45;">
                  ${escapeHtml(guidance.quoteBasisHtml)}
                </div>

                <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">Optional Recommendations</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
                  ${optionalHtmlRows}
                </table>
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
  },
) {
  const mandatoryFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const topDeductions = mandatoryFindings.slice(0, 5);
  const optionalRecommendations = report.findings.filter((finding) => finding.pointsDeducted === 0);
  const guidance = buildEngagementGuidance(report);
  const engagementPackages = buildEngagementPackages(report, guidance);
  const defaults = resolveDefaultCtaLinks();
  const ctaLinks: EmailCtaLinks = {
    bookArchitectureCallUrl: options?.ctaLinks?.bookArchitectureCallUrl ?? defaults.bookArchitectureCallUrl,
    requestRemediationPlanUrl:
      options?.ctaLinks?.requestRemediationPlanUrl ?? defaults.requestRemediationPlanUrl,
  };

  const lines = [
    `Architecture Diagram Review (${providerLabel(report.provider)})`,
    `Generated: ${report.generatedAtISO}`,
    `Email: ${report.userEmail}`,
    "",
    `Overall score: ${report.overallScore}/100`,
    `Analysis confidence: ${confidenceLabel(report.analysisConfidence)}`,
    `Consultation quote: $${report.consultationQuoteUSD}`,
    `Recommended tier: ${quoteTierLabel(report.quoteTier)}`,
    "",
    "Flow narrative:",
    report.flowNarrative,
    "",
    "Top deductions (single-line deterministic format):",
    ...(topDeductions.length > 0 ? topDeductions.map((finding, index) => findingLine(index, finding)) : ["No mandatory deductions."]),
    "",
    "Optional recommendations (0 points deducted):",
    ...(optionalRecommendations.length > 0
      ? optionalRecommendations.map((finding, index) => findingLine(index, finding))
      : ["No optional recommendations."]),
    "",
    "Engagement options:",
    ...engagementPackages.map(
      (pkg, index) =>
        `${index + 1}. ${pkg.name} | ${pkg.timeline} | ${pkg.priceLabel} | ${pkg.summary}${pkg.recommended ? " | RECOMMENDED" : ""}`,
    ),
    "",
    "Next-step policy:",
    `- ${guidance.noteTitle}: ${guidance.noteBody}`,
    "",
    "Primary CTAs:",
    `- Book architecture call: ${ctaLinks.bookArchitectureCallUrl}`,
    `- ${guidance.secondaryCtaLabel}: ${ctaLinks.requestRemediationPlanUrl}`,
    "",
    "Quote basis:",
    ...guidance.quoteBasisLines,
  ];

  const subject = `[ZoKorp] ${providerLabel(report.provider)} architecture review score ${report.overallScore}/100`;
  const text = lines.join("\n");
  const html = buildHtmlEmail(report, ctaLinks);

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
