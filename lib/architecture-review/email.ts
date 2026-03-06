import type { ArchitectureReviewReport } from "@/lib/architecture-review/types";

function providerLabel(provider: ArchitectureReviewReport["provider"]) {
  return provider.toUpperCase();
}

function findingLine(index: number, finding: ArchitectureReviewReport["findings"][number]) {
  return `${index + 1}. pointsDeducted=${finding.pointsDeducted} | message=${finding.message} | fix=${finding.fix} | ruleId=${finding.ruleId} | estFixCost=$${finding.fixCostUSD}`;
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
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EngagementPackage = {
  name: string;
  timeline: string;
  priceUSD: number;
  summary: string;
  recommended: boolean;
};

function buildEngagementPackages(report: ArchitectureReviewReport): EngagementPackage[] {
  const mandatoryFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const severeFindings = mandatoryFindings.filter((finding) => finding.pointsDeducted >= 8).length;
  const moderateFindings = mandatoryFindings.filter(
    (finding) => finding.pointsDeducted >= 4 && finding.pointsDeducted < 8,
  ).length;

  const riskMultiplier = report.overallScore < 70 ? 1.18 : report.overallScore < 85 ? 1.0 : 0.9;
  const baseQuote = report.consultationQuoteUSD;

  const rapidPrice = roundToNearest(clamp(Math.round(baseQuote * 0.9 * riskMultiplier), 450, 2500), 25);
  const implementationPrice = roundToNearest(
    clamp(Math.round(baseQuote * 1.55 + severeFindings * 90 + moderateFindings * 45), 1200, 7500),
    25,
  );
  const partnerPrice = roundToNearest(
    clamp(Math.round(baseQuote * 2.2 + mandatoryFindings.length * 85), 2200, 12000),
    25,
  );

  const recommendedTier = report.overallScore < 70 ? "partner" : report.overallScore < 85 ? "implementation" : "rapid";

  return [
    {
      name: "Rapid Remediation Sprint",
      timeline: "1-2 weeks",
      priceUSD: rapidPrice,
      summary: "Fix top-risk findings, update diagram set, and deliver a close-out review call.",
      recommended: recommendedTier === "rapid",
    },
    {
      name: "Implementation Package",
      timeline: "3-5 weeks",
      priceUSD: implementationPrice,
      summary: "Remediate major findings across security/reliability/operations with validation checkpoints.",
      recommended: recommendedTier === "implementation",
    },
    {
      name: "Architecture Partner Track",
      timeline: "6-10 weeks",
      priceUSD: partnerPrice,
      summary: "Lead full redesign, staged rollout plan, and team enablement for sustained ownership.",
      recommended: recommendedTier === "partner",
    },
  ];
}

function buildHtmlEmail(report: ArchitectureReviewReport) {
  const mandatoryFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const optionalRecommendations = report.findings.filter((finding) => finding.pointsDeducted === 0);
  const packages = buildEngagementPackages(report);
  const generatedAt = new Date(report.generatedAtISO).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  const mandatoryHtml =
    mandatoryFindings.length > 0
      ? mandatoryFindings
          .map(
            (finding, index) => `
              <tr>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;">${index + 1}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;vertical-align:top;color:#0f172a;font-size:13px;">
                  <div style="font-weight:700;">-${finding.pointsDeducted} points | ${escapeHtml(finding.ruleId)}</div>
                  <div style="margin-top:4px;">${escapeHtml(finding.message)}</div>
                  <div style="margin-top:4px;color:#334155;">Fix: ${escapeHtml(finding.fix)}</div>
                  <div style="margin-top:4px;color:#64748b;">Estimated fix effort: ${toUsd(finding.fixCostUSD)}</div>
                </td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="2" style="padding:10px 12px;color:#0f172a;font-size:13px;">No mandatory findings.</td></tr>`;

  const optionalHtml =
    optionalRecommendations.length > 0
      ? optionalRecommendations
          .map(
            (finding) => `
              <li style="margin-bottom:8px;">
                <span style="font-weight:700;">${escapeHtml(finding.ruleId)}:</span>
                ${escapeHtml(finding.message)}
              </li>
            `,
          )
          .join("")
      : `<li>No optional recommendations.</li>`;

  const packageHtml = packages
    .map(
      (pkg) => `
        <div style="border:1px solid ${pkg.recommended ? "#1d4ed8" : "#cbd5e1"};border-radius:10px;padding:14px;background:${pkg.recommended ? "#eff6ff" : "#ffffff"};">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <div style="font-weight:700;color:#0f172a;">${escapeHtml(pkg.name)}</div>
            <div style="font-weight:800;color:#0f172a;">${toUsd(pkg.priceUSD)}</div>
          </div>
          <div style="margin-top:4px;color:#334155;font-size:13px;">Timeline: ${escapeHtml(pkg.timeline)}</div>
          <div style="margin-top:8px;color:#334155;font-size:13px;">${escapeHtml(pkg.summary)}</div>
          ${pkg.recommended ? '<div style="margin-top:10px;font-size:12px;font-weight:700;color:#1e40af;">Recommended based on score and risk profile</div>' : ""}
        </div>
      `,
    )
    .join("");

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:840px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ef;border-radius:14px;overflow:hidden;">
      <div style="padding:18px 22px;background:linear-gradient(90deg,#0f172a,#1d4ed8);color:#ffffff;">
        <div style="font-size:12px;letter-spacing:0.1em;text-transform:uppercase;opacity:0.86;">ZoKorp Architecture Review</div>
        <h1 style="margin:8px 0 0 0;font-size:28px;line-height:1.2;">${providerLabel(report.provider)} Score ${report.overallScore}/100</h1>
      </div>
      <div style="padding:20px 22px;">
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
          <div style="border:1px solid #dbe3ef;border-radius:10px;padding:10px 12px;">
            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Overall Score</div>
            <div style="margin-top:4px;font-size:24px;font-weight:800;">${report.overallScore}/100</div>
          </div>
          <div style="border:1px solid #dbe3ef;border-radius:10px;padding:10px 12px;">
            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Core Quote</div>
            <div style="margin-top:4px;font-size:24px;font-weight:800;">${toUsd(report.consultationQuoteUSD)}</div>
          </div>
          <div style="border:1px solid #dbe3ef;border-radius:10px;padding:10px 12px;">
            <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Generated</div>
            <div style="margin-top:4px;font-size:13px;font-weight:700;">${escapeHtml(generatedAt)}</div>
          </div>
        </div>

        <div style="margin-top:18px;padding:14px;border:1px solid #dbe3ef;border-radius:10px;background:#f8fafc;">
          <div style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.07em;">Flow Narrative</div>
          <p style="margin:8px 0 0 0;line-height:1.5;font-size:14px;color:#0f172a;">${escapeHtml(report.flowNarrative)}</p>
        </div>

        <h2 style="margin:22px 0 10px 0;font-size:18px;">Actionable Findings</h2>
        <table style="width:100%;border-collapse:collapse;border:1px solid #dbe3ef;border-radius:10px;overflow:hidden;">
          <tbody>
            ${mandatoryHtml}
          </tbody>
        </table>

        <h2 style="margin:22px 0 10px 0;font-size:18px;">Recommended Engagement Options</h2>
        <div style="display:grid;gap:10px;">
          ${packageHtml}
        </div>
        <p style="margin:10px 0 0 0;font-size:12px;color:#64748b;">
          Quote method: $249 review call + deterministic remediation effort by finding category, with score-based cap.
        </p>

        <h2 style="margin:22px 0 10px 0;font-size:18px;">Optional Recommendations</h2>
        <ul style="margin:0;padding-left:18px;color:#334155;font-size:14px;">
          ${optionalHtml}
        </ul>
      </div>
    </div>
  </body>
</html>
  `.trim();
}

export function buildArchitectureReviewEmailContent(report: ArchitectureReviewReport) {
  const mandatoryFindings = report.findings.filter((finding) => finding.pointsDeducted > 0);
  const optionalRecommendations = report.findings.filter((finding) => finding.pointsDeducted === 0);
  const engagementPackages = buildEngagementPackages(report);

  const lines = [
    `Architecture Diagram Review (${providerLabel(report.provider)})`,
    `Generated: ${report.generatedAtISO}`,
    `Email: ${report.userEmail}`,
    "",
    `Overall score: ${report.overallScore}/100`,
    `Consultation quote: $${report.consultationQuoteUSD}`,
    "",
    "Flow narrative:",
    report.flowNarrative,
    "",
    "Engagement options (deterministic):",
    ...engagementPackages.map(
      (pkg, index) =>
        `${index + 1}. ${pkg.name} | ${pkg.timeline} | ${toUsd(pkg.priceUSD)} | ${pkg.summary}${pkg.recommended ? " | RECOMMENDED" : ""}`,
    ),
    "",
    "Quote basis:",
    "- $249 review call + per-finding remediation estimate.",
    "- Category-specific fix-cost mapping and score-band quote cap are applied deterministically.",
    "",
    "Findings (single-line, deterministic format):",
    ...(mandatoryFindings.length > 0
      ? mandatoryFindings.map((finding, index) => findingLine(index, finding))
      : ["No mandatory findings."]),
    "",
    "Optional recommendations (0 points deducted):",
    ...(optionalRecommendations.length > 0
      ? optionalRecommendations.map((finding, index) => findingLine(index, finding))
      : ["No optional recommendations."]),
  ];

  const subject = `[ZoKorp] ${providerLabel(report.provider)} architecture review score ${report.overallScore}/100`;
  const text = lines.join("\n");
  const html = buildHtmlEmail(report);

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
