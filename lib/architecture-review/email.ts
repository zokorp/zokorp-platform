import type {
  ArchitectureEstimateSnapshot,
  ArchitectureQuoteTier,
  ArchitectureReviewReport,
} from "@/lib/architecture-review/types";
import { buildFallbackArchitectureEstimateSnapshot } from "@/lib/architecture-review/estimate-snapshot";
import { getRelatedCaseStudy } from "@/lib/architecture-review/case-study-links";
import { getCounterfactualCost } from "@/lib/architecture-review/counterfactual-costs";
import { buildArchitectureObservation } from "@/lib/architecture-review/observation";
import { getArchitectureReviewPricingCatalogEntry } from "@/lib/architecture-review/pricing-catalog";
import { getMarketingSiteUrl } from "@/lib/site";
import {
  buildReviewerSynthesisLines,
  calculatePillarScores,
  configuredArchitectureRemediationRateUsdPerHour,
  getFindingSeverityLabel,
  selectQuickWins,
  type FindingSeverityLabel,
  type PillarScoreTone,
} from "@/lib/architecture-review/quote";
import { reviewScopeLabel } from "@/lib/architecture-review/scope";
import { buildEmailPreferenceFooter } from "@/lib/email-preferences";
import { getArchitectureCallUrl } from "@/lib/marketing-cta";

function providerLabel(report: ArchitectureReviewReport) {
  return reviewScopeLabel(report.reviewScope);
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
  payNowUrl?: string | null;
};

function resolveDefaultCtaLinks() {
  return {
    bookArchitectureCallUrl: getArchitectureCallUrl({
      utmMedium: "architecture-review-email",
    }),
  } satisfies EmailCtaLinks;
}

function severityStyles(label: FindingSeverityLabel) {
  if (label === "CRITICAL") {
    return { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" };
  }

  if (label === "HIGH") {
    return { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412" };
  }

  if (label === "MEDIUM") {
    return { bg: "#fefce8", border: "#fde68a", text: "#854d0e" };
  }

  return { bg: "#f3f4f6", border: "#e5e7eb", text: "#374151" };
}

function pillarStyles(tone: PillarScoreTone) {
  if (tone === "critical") {
    return { bar: "#dc2626", text: "#991b1b", track: "#fee2e2" };
  }

  if (tone === "weak") {
    return { bar: "#ea580c", text: "#9a3412", track: "#ffedd5" };
  }

  if (tone === "watch") {
    return { bar: "#2563eb", text: "#1d4ed8", track: "#dbeafe" };
  }

  return { bar: "#16a34a", text: "#15803d", track: "#dcfce7" };
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
  const pillarScores = calculatePillarScores(report.findings);
  const activePillarScores = pillarScores.filter(
    (pillar) => pillar.findingsCount > 0 || pillar.score < 100,
  );
  const observation = buildArchitectureObservation({
    flowNarrative: report.flowNarrative,
    provider: report.provider,
    platforms: report.reviewScope.platforms,
  });
  const reviewerLines = buildReviewerSynthesisLines({
    findings: report.findings,
    pillarScores,
    overallScore: report.overallScore,
    analysisConfidence: report.analysisConfidence,
  });
  const reviewerSynthesis = reviewerLines.synthesis;
  const reviewerSequencing = reviewerLines.sequencing;
  const remediationRateUsdPerHour = configuredArchitectureRemediationRateUsdPerHour();
  const totalEstimatedHours = estimateSnapshot.lineItems.reduce(
    (sum, item) => sum + item.estimatedHours,
    0,
  );
  const quickWins = selectQuickWins(
    mandatoryFindings.map((finding) => ({
      ruleId: finding.ruleId,
      category: finding.category,
      pointsDeducted: finding.pointsDeducted,
      why: finding.why,
      howToFix: finding.howToFix,
    })),
    {
      ruleHoursLookup: (ruleId) => {
        const entry = getArchitectureReviewPricingCatalogEntry(ruleId);
        if (!entry) {
          return null;
        }
        return { low: entry.remediationHoursLow, high: entry.remediationHoursHigh };
      },
    },
  );

  const marketingBaseUrl = getMarketingSiteUrl();
  const topDeductionsHtml =
    mandatoryFindings.length > 0
      ? mandatoryFindings
          .slice(0, 6)
          .map(
            (finding, index) => {
              const lineItem = snapshotByRuleId.get(finding.ruleId);
              const severity = getFindingSeverityLabel(finding.pointsDeducted);
              const severityColor = severityStyles(severity);
              const severityBadge = `<span style="display:inline-block;padding:2px 8px;margin-right:8px;border-radius:9999px;background:${severityColor.bg};border:1px solid ${severityColor.border};color:${severityColor.text};font-size:11px;font-weight:700;letter-spacing:0.06em;">${severity}</span>`;
              const caseStudy = getRelatedCaseStudy({ ruleId: finding.ruleId, category: finding.category });
              const caseStudyHtml = caseStudy
                ? `<div style="margin-top:6px;padding:8px 10px;background:#f1f5f9;border-left:3px solid #0f5c7a;border-radius:4px;color:#0f172a;font-size:12px;">
                    <span style="font-weight:600;">Where I've caught this pattern:</span>
                    <a href="${escapeHtml(marketingBaseUrl + caseStudy.href)}" style="color:#0f5c7a;text-decoration:underline;">${escapeHtml(caseStudy.title)}</a>
                    — <span style="color:#475569;">${escapeHtml(caseStudy.outcomeStat)}</span>
                  </div>`
                : "";
              const counterfactualNote = getCounterfactualCost(finding.ruleId);
              const counterfactualHtml = counterfactualNote
                ? `<div style="margin-top:6px;padding:8px 10px;background:#fefce8;border-left:3px solid #ca8a04;border-radius:4px;color:#0f172a;font-size:12px;line-height:1.55;">
                    <span style="font-weight:600;">Cost of fixing vs not:</span> ${escapeHtml(counterfactualNote)}
                  </div>`
                : "";

              return `
                <tr>
                  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;width:44px;">${index + 1}</td>
                  <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;">
                    <div style="font-weight:700;">${severityBadge}-${finding.pointsDeducted} points · ${escapeHtml(finding.ruleId)}</div>
                    <div style="margin-top:6px;color:#0f172a;"><strong>Why:</strong> ${escapeHtml(finding.why)}</div>
                    <div style="margin-top:4px;color:#334155;"><strong>Evidence seen:</strong> ${escapeHtml(finding.evidenceSeen)}</div>
                    <div style="margin-top:4px;color:#334155;"><strong>How to fix:</strong> ${escapeHtml(finding.howToFix)}</div>
                    ${
                      finding.officialSourceLinks.length > 0
                        ? `<div style="margin-top:4px;color:#334155;"><strong>Official references:</strong> ${finding.officialSourceLinks
                            .map(
                              (link) =>
                                `<a href="${escapeHtml(link.url)}" style="color:#0f5c7a;text-decoration:none;">${escapeHtml(link.label)}</a>`,
                            )
                            .join(" · ")}</div>`
                        : ""
                    }
                    ${
                      lineItem
                        ? `<div style="margin-top:4px;color:#334155;">Quoted line: ${escapeHtml(lineItem.serviceLineLabel)} · ${escapeHtml(toUsd(lineItem.amountUsd))} · ${escapeHtml(formatHours(lineItem.estimatedHours))}</div>`
                        : ""
                    }
                    ${counterfactualHtml}
                    ${caseStudyHtml}
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
                  <div style="font-weight:700;color:#0f172a;">${escapeHtml(finding.ruleId)}</div>
                  <div style="margin-top:4px;"><strong>Why:</strong> ${escapeHtml(finding.why)}</div>
                  <div style="margin-top:4px;"><strong>Evidence seen:</strong> ${escapeHtml(finding.evidenceSeen)}</div>
                  <div style="margin-top:4px;"><strong>How to fix:</strong> ${escapeHtml(finding.howToFix)}</div>
                </td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="2" style="padding:9px 12px;color:#334155;font-size:13px;">No optional recommendations.</td></tr>`;

  const assumptionsHtml = estimateSnapshot.assumptions.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const exclusionsHtml = estimateSnapshot.exclusions.map((line) => `<li>${escapeHtml(line)}</li>`).join("");

  const observationHtml =
    observation.tiersInOrder.length > 0
      ? `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border:1px solid #cbd5e1;border-radius:10px;background:#ffffff;">
          <tr>
            <td style="padding:14px 16px;">
              <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">What I saw</div>
              <div style="margin-top:6px;font-size:11px;color:#94a3b8;letter-spacing:0.04em;">Recognized components extracted from your narrative + diagram</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;">
                ${observation.tiersInOrder
                  .map(
                    (tier) => `
                <tr>
                  <td style="padding:6px 0;vertical-align:top;font-size:12px;color:#64748b;letter-spacing:0.04em;width:170px;">${escapeHtml(tier.label)}</td>
                  <td style="padding:6px 0;vertical-align:top;font-size:14px;color:#0f172a;">${tier.services
                    .map((service) => `<span style="display:inline-block;margin:2px 6px 2px 0;padding:2px 8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:9999px;font-size:12px;">${escapeHtml(service)}</span>`)
                    .join("")}</td>
                </tr>`,
                  )
                  .join("")}
              </table>
            </td>
          </tr>
        </table>`
      : "";

  const pillarsHtml =
    activePillarScores.length > 0
      ? `
        <div style="margin-top:18px;font-size:18px;font-weight:700;color:#0f172a;">Where the score lands by pillar</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;background:#ffffff;">
          ${activePillarScores
            .map((pillar) => {
              const styles = pillarStyles(pillar.tone);
              const barWidth = Math.max(2, Math.min(100, pillar.score));
              const findingsLabel = pillar.findingsCount === 0
                ? "No findings"
                : `${pillar.findingsCount} finding${pillar.findingsCount === 1 ? "" : "s"} · -${pillar.pointsDeducted} pts`;
              return `
              <tr>
                <td style="padding:10px 14px;border-bottom:1px solid #eef2f7;font-size:13px;color:#0f172a;vertical-align:middle;width:38%;">
                  <div style="font-weight:700;">${escapeHtml(pillar.label)}</div>
                  <div style="margin-top:2px;color:#64748b;font-size:11px;letter-spacing:0.04em;">${escapeHtml(findingsLabel)}</div>
                </td>
                <td style="padding:10px 14px;border-bottom:1px solid #eef2f7;vertical-align:middle;">
                  <div style="height:8px;background:${styles.track};border-radius:9999px;overflow:hidden;">
                    <div style="height:8px;width:${barWidth}%;background:${styles.bar};"></div>
                  </div>
                </td>
                <td align="right" style="padding:10px 14px;border-bottom:1px solid #eef2f7;font-size:14px;font-weight:800;color:${styles.text};width:18%;white-space:nowrap;">
                  ${pillar.score}/100
                </td>
              </tr>`;
            })
            .join("")}
        </table>`
      : "";

  const quickWinsHtml =
    quickWins.length > 0
      ? `
        <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">Quick wins to ship this week</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;border:1px solid #bbf7d0;border-radius:10px;overflow:hidden;background:#f0fdf4;">
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #bbf7d0;font-size:12px;font-weight:700;color:#166534;letter-spacing:0.06em;text-transform:uppercase;">If you only do 3 things this week — biggest impact-per-hour wins from this review</td>
          </tr>
          ${quickWins
            .map((win, index) => `
            <tr>
              <td style="padding:12px 14px;border-bottom:${index === quickWins.length - 1 ? "0" : "1px solid #bbf7d0"};font-size:13px;color:#14532d;vertical-align:top;">
                <div style="font-weight:700;color:#0f172a;">${index + 1}. ${escapeHtml(win.ruleId)}</div>
                <div style="margin-top:4px;color:#166534;font-size:11px;letter-spacing:0.04em;">~${formatHours(win.estimatedHoursLow)}–${formatHours(win.estimatedHoursHigh)} · saves ${win.pointsDeducted} points off the overall score</div>
                ${win.why ? `<div style="margin-top:6px;color:#0f172a;"><strong>Why:</strong> ${escapeHtml(win.why)}</div>` : ""}
                ${win.howToFix ? `<div style="margin-top:4px;color:#14532d;"><strong>How to fix:</strong> ${escapeHtml(win.howToFix)}</div>` : ""}
              </td>
            </tr>`)
            .join("")}
        </table>`
      : "";

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
                  ${providerLabel(report)} Score ${report.overallScore}/100
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

                ${observationHtml}

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border:1px solid #cbd5e1;border-radius:10px;background:#f1f5f9;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Reviewer's note</div>
                      <div style="margin-top:8px;line-height:1.55;font-size:14px;color:#0f172a;">${escapeHtml(reviewerSynthesis)}</div>
                      <div style="margin-top:10px;line-height:1.55;font-size:14px;color:#0f172a;font-style:italic;">${escapeHtml(reviewerSequencing)}</div>
                      <div style="margin-top:10px;font-size:11px;color:#64748b;letter-spacing:0.04em;">— Zohaib Khawaja · AWS Certified Solutions Architect, Professional · Houston, TX</div>
                    </td>
                  </tr>
                </table>

                ${pillarsHtml}

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;">
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
                        ${
                          estimateSnapshot.policy.payableQuoteEnabled && ctaLinks.payNowUrl
                            ? `<a href="${escapeHtml(ctaLinks.payNowUrl)}" style="display:inline-block;margin-left:10px;border-radius:8px;background:#0f766e;color:#ffffff;padding:10px 14px;font-size:13px;font-weight:700;text-decoration:none;">Pay now</a>`
                            : ""
                        }
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

                ${quickWinsHtml}

                <div style="margin-top:22px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(estimateSectionTitle(estimateSnapshot))}</div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-collapse:collapse;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
                  <tr>
                    <td style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#334155;">Service Line</td>
                    <td align="right" style="padding:9px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#334155;width:120px;">Amount</td>
                  </tr>
                  ${quoteRows}
                  <tr>
                    <td style="padding:12px;font-size:14px;font-weight:800;color:#0f172a;">
                      Estimated total (based on submitted materials)
                      ${
                        estimateSnapshot.policy.payableQuoteEnabled && totalEstimatedHours > 0
                          ? `<div style="margin-top:4px;font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.04em;">≈ ${formatHours(totalEstimatedHours)} at ${escapeHtml(toUsd(remediationRateUsdPerHour))}/hr</div>`
                          : ""
                      }
                    </td>
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
    payNowUrl: options?.ctaLinks?.payNowUrl ?? null,
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

  const pillarScoresLocal = calculatePillarScores(report.findings);
  const activePillarScoresLocal = pillarScoresLocal.filter(
    (pillar) => pillar.findingsCount > 0 || pillar.score < 100,
  );
  const quickWinsLocal = selectQuickWins(
    mandatoryFindings.map((finding) => ({
      ruleId: finding.ruleId,
      category: finding.category,
      pointsDeducted: finding.pointsDeducted,
      why: finding.why,
      howToFix: finding.howToFix,
    })),
    {
      ruleHoursLookup: (ruleId) => {
        const entry = getArchitectureReviewPricingCatalogEntry(ruleId);
        if (!entry) {
          return null;
        }
        return { low: entry.remediationHoursLow, high: entry.remediationHoursHigh };
      },
    },
  );

  const observationLocal = buildArchitectureObservation({
    flowNarrative: report.flowNarrative,
    provider: report.provider,
    platforms: report.reviewScope.platforms,
  });
  const marketingBaseUrl = getMarketingSiteUrl();
  const reviewerLinesLocal = buildReviewerSynthesisLines({
    findings: report.findings,
    pillarScores: pillarScoresLocal,
    overallScore: report.overallScore,
    analysisConfidence: report.analysisConfidence,
  });
  const reviewerSynthesisLocal = reviewerLinesLocal.synthesis;
  const reviewerSequencingLocal = reviewerLinesLocal.sequencing;
  const remediationRateUsdPerHourLocal = configuredArchitectureRemediationRateUsdPerHour();
  const totalEstimatedHoursLocal = estimateSnapshot.lineItems.reduce(
    (sum, item) => sum + item.estimatedHours,
    0,
  );

  const lines = [
    `Architecture Diagram Review (${providerLabel(report)})`,
    `Generated: ${report.generatedAtISO}`,
    `Email: ${report.userEmail}`,
    "",
    ...(observationLocal.tiersInOrder.length > 0
      ? [
          "What I saw:",
          ...observationLocal.tiersInOrder.map(
            (tier) => `  ${tier.label}: ${tier.services.join(", ")}`,
          ),
          "",
        ]
      : []),
    "Reviewer's note:",
    reviewerSynthesisLocal,
    "",
    reviewerSequencingLocal,
    "— Zohaib Khawaja, AWS Certified Solutions Architect, Professional, Houston TX",
    "",
    `Overall score: ${report.overallScore}/100`,
    `Analysis confidence: ${confidenceLabel(report.analysisConfidence)}`,
    `Recommended work path: ${quoteTierLabel(report.quoteTier)}`,
    `Estimate reference: ${estimateSnapshot.referenceCode}`,
    ...(officialEstimateReference ? [`Formal estimate reference: ${officialEstimateReference}`] : []),
    `${estimateSectionTextLabel(estimateSnapshot)}: ${
      estimateSnapshot.policy.payableQuoteEnabled ? toUsd(estimateSnapshot.totalUsd) : "Consultation first"
    }`,
    ...(activePillarScoresLocal.length > 0
      ? [
          "",
          "Where the score lands by pillar:",
          ...activePillarScoresLocal.map(
            (pillar) =>
              `- ${pillar.label}: ${pillar.score}/100${
                pillar.findingsCount > 0
                  ? ` (${pillar.findingsCount} finding${pillar.findingsCount === 1 ? "" : "s"}, -${pillar.pointsDeducted} pts)`
                  : ""
              }`,
          ),
        ]
      : []),
    "",
    "Flow narrative:",
    report.flowNarrative,
    "",
    "Next step:",
    nextStepNote(report, estimateSnapshot),
    `${ctaLabel(estimateSnapshot)}: ${ctaLinks.bookArchitectureCallUrl}`,
    ...(estimateSnapshot.policy.payableQuoteEnabled && ctaLinks.payNowUrl ? [`Pay now: ${ctaLinks.payNowUrl}`] : []),
    "",
    "Top deductions:",
    ...(mandatoryFindings.length > 0
      ? mandatoryFindings.slice(0, 6).flatMap((finding) => {
          const cs = getRelatedCaseStudy({ ruleId: finding.ruleId, category: finding.category });
          const counterfactual = getCounterfactualCost(finding.ruleId);
          return [
            `- [${getFindingSeverityLabel(finding.pointsDeducted)}] ${finding.ruleId} | -${finding.pointsDeducted} points | ${finding.recommendationType.toUpperCase()}`,
            `  Why: ${finding.why}`,
            `  Evidence seen: ${finding.evidenceSeen}`,
            `  How to fix: ${finding.howToFix}`,
            `  Official references: ${finding.officialSourceLinks.map((link) => `${link.label} (${link.url})`).join(", ")}`,
            ...(counterfactual ? [`  Cost of fixing vs not: ${counterfactual}`] : []),
            ...(cs
              ? [`  Where I've caught this pattern: ${cs.title} — ${cs.outcomeStat} — ${marketingBaseUrl}${cs.href}`]
              : []),
          ];
        })
      : ["No mandatory deductions."]),
    ...(quickWinsLocal.length > 0
      ? [
          "",
          "Quick wins to ship this week (highest impact-per-hour):",
          ...quickWinsLocal.flatMap((win, index) => [
            `${index + 1}. ${win.ruleId} (~${formatHours(win.estimatedHoursLow)}-${formatHours(win.estimatedHoursHigh)}, saves ${win.pointsDeducted} points)`,
            ...(win.why ? [`   Why: ${win.why}`] : []),
            ...(win.howToFix ? [`   How to fix: ${win.howToFix}`] : []),
          ]),
        ]
      : []),
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
    }${
      estimateSnapshot.policy.payableQuoteEnabled && totalEstimatedHoursLocal > 0
        ? ` (≈ ${formatHours(totalEstimatedHoursLocal)} at ${toUsd(remediationRateUsdPerHourLocal)}/hr)`
        : ""
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
      ? optionalRecommendations.flatMap((finding) => [
          `- ${finding.ruleId} | ${finding.recommendationType.toUpperCase()}`,
          `  Why: ${finding.why}`,
          `  Evidence seen: ${finding.evidenceSeen}`,
          `  How to fix: ${finding.howToFix}`,
        ])
      : ["No optional recommendations."]),
    ...(emailPreferenceFooter ? ["", emailPreferenceFooter.text] : []),
  ];

  const subject =
    estimateSnapshot.policy.band === "consultation-only"
      ? `[ZoKorp] ${providerLabel(report)} architecture review ${report.overallScore}/100`
      : `[ZoKorp] ${providerLabel(report)} architecture estimate ${report.overallScore}/100`;
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
