import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getRelatedCaseStudy } from "@/lib/architecture-review/case-study-links";
import {
  getCounterfactualCost,
  SAMPLE_COUNTERFACTUAL_COST,
} from "@/lib/architecture-review/counterfactual-costs";
import { buildArchitectureObservation } from "@/lib/architecture-review/observation";
import { getArchitectureReviewPricingCatalogEntry } from "@/lib/architecture-review/pricing-catalog";
import {
  buildReviewerSynthesisLines,
  calculatePillarScores,
  configuredArchitectureRemediationRateUsdPerHour,
  getFindingSeverityLabel,
  selectQuickWins,
  type FindingSeverityLabel,
  type PillarScoreTone,
} from "@/lib/architecture-review/quote";
import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";
import { reviewScopeLabel } from "@/lib/architecture-review/scope";
import { buildMarketingPageMetadata } from "@/lib/site";

export const metadata = buildMarketingPageMetadata({
  title: "Architecture Diagram Reviewer Sample Report",
  description:
    "Synthetic sample output for the ZoKorp Architecture Diagram Reviewer. Review the format before submitting your own diagram.",
  path: "/software/architecture-diagram-reviewer/sample-report",
});

const sampleReport = buildArchitectureReviewReport({
  provider: "aws",
  flowNarrative:
    "Users enter through CloudFront and an ALB, app services process requests in private subnets, and data persists to RDS with background workers consuming queue events.",
  findings: [
    {
      ruleId: "PILLAR-SECURITY",
      category: "security",
      pointsDeducted: 12,
      recommendationType: "fix",
      why: "The request path is visible, but concrete identity, secret storage, and encryption controls are not stated.",
      evidenceSeen: "“Users enter through CloudFront and an ALB ... data persists to RDS ...”",
      howToFix: "Label the identity boundary for each tier, name the secret store, and mark encryption controls for in-transit and at-rest paths.",
      officialSourceLinks: [
        {
          label: "AWS Well-Architected Security Pillar",
          url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html",
        },
      ],
      ruleVersion: "sample-v2",
      message: "Document identity, secrets, and encryption controls.",
      fix: "Name IAM boundaries, secret handling, and encryption points for the request path.",
      evidence: "The diagram describes app flow but does not show concrete security controls.",
    },
    {
      ruleId: "REL-RTO-RPO-MISSING",
      category: "reliability",
      pointsDeducted: 8,
      recommendationType: "clarify",
      why: "Stateful services are shown, but recovery targets are not explicit in the visible evidence.",
      evidenceSeen: "“... data persists to RDS with background workers consuming queue events.”",
      howToFix: "Add the target RTO/RPO for the primary datastore and the queue-backed recovery behavior expected after failure.",
      officialSourceLinks: [
        {
          label: "AWS Well-Architected Reliability Definitions",
          url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/definitions.html",
        },
      ],
      ruleVersion: "sample-v2",
      message: "State recovery targets for stateful services.",
      fix: "Add RTO/RPO targets for the primary data stores and queue-backed recovery behavior.",
      evidence: "Stateful services are present without explicit recovery targets.",
    },
    {
      ruleId: "MSFT-COMPONENT-LABEL-COVERAGE",
      category: "clarity",
      pointsDeducted: 6,
      recommendationType: "fix",
      why: "The narrative names the major services but does not explain each component’s role or boundary.",
      evidenceSeen: "“CloudFront and an ALB, app services ... RDS with background workers consuming queue events.”",
      howToFix: "Expand the paragraph so each major component has one clear purpose statement and the request/data flow across boundaries is explicit.",
      officialSourceLinks: [],
      ruleVersion: "sample-v2",
      message: "Explain the role of each major component in the paragraph.",
      fix: "State what each service does and how requests move across the boundary lines.",
      evidence: "Multiple services are named but not fully explained in the narrative.",
    },
    {
      ruleId: "MSFT-LAYERING-OPTIONAL",
      category: "clarity",
      pointsDeducted: 0,
      recommendationType: "optional",
      why: "The current view is readable, but a layered variant would help when the live diagram grows.",
      evidenceSeen: "“Users enter through CloudFront and an ALB ... background workers consuming queue events.”",
      howToFix: "Consider separate edge, application, and data views for larger follow-on diagrams.",
      officialSourceLinks: [],
      ruleVersion: "sample-v2",
      message: "A layered diagram view could improve readability.",
      fix: "Split edge, application, and data concerns into separate views if the live diagram grows further.",
      evidence: "The sample system is busy enough that a layered version would be easier to scan.",
    },
  ],
  userEmail: "sample@zokorp.com",
  generatedAtISO: "2026-03-09T00:00:00.000Z",
  quoteContext: {
    tokenCount: 16,
    ocrCharacterCount: 540,
    mode: "rules-only",
    workloadCriticality: "standard",
    desiredEngagement: "hands-on-remediation",
    regulatoryScope: "none",
  },
});

function severityBadgeClasses(label: FindingSeverityLabel) {
  if (label === "CRITICAL") {
    return "border-red-200 bg-red-50 text-red-800";
  }
  if (label === "HIGH") {
    return "border-orange-200 bg-orange-50 text-orange-900";
  }
  if (label === "MEDIUM") {
    return "border-yellow-200 bg-yellow-50 text-yellow-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function pillarBarClasses(tone: PillarScoreTone) {
  if (tone === "critical") {
    return { bar: "bg-red-600", text: "text-red-700", track: "bg-red-100" };
  }
  if (tone === "weak") {
    return { bar: "bg-orange-500", text: "text-orange-700", track: "bg-orange-100" };
  }
  if (tone === "watch") {
    return { bar: "bg-blue-500", text: "text-blue-700", track: "bg-blue-100" };
  }
  return { bar: "bg-emerald-500", text: "text-emerald-700", track: "bg-emerald-100" };
}

function formatHours(value: number) {
  const rounded = Math.round(value * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${label} hr${rounded === 1 ? "" : "s"}`;
}

function toUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ArchitectureReviewerSampleReportPage() {
  const positiveFindings = sampleReport.findings.filter((finding) => finding.pointsDeducted > 0);
  const optionalRecommendations = sampleReport.findings.filter((finding) => finding.pointsDeducted === 0);
  const pillarScores = calculatePillarScores(sampleReport.findings);
  const activePillarScores = pillarScores.filter(
    (pillar) => pillar.findingsCount > 0 || pillar.score < 100,
  );
  const observation = buildArchitectureObservation({
    flowNarrative: sampleReport.flowNarrative,
    provider: sampleReport.provider,
    platforms: sampleReport.reviewScope.platforms,
  });
  const reviewerLines = buildReviewerSynthesisLines({
    findings: sampleReport.findings,
    pillarScores,
    overallScore: sampleReport.overallScore,
    analysisConfidence: sampleReport.analysisConfidence,
  });
  const reviewerSynthesis = reviewerLines.synthesis;
  const reviewerSequencing = reviewerLines.sequencing;
  const quickWins = selectQuickWins(
    positiveFindings.map((finding) => ({
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
          // The sample finding rule IDs don't map to real pricing-catalog
          // entries, so emit a reasonable demo range so the Quick Wins
          // section actually surfaces on the sample page.
          return { low: 1, high: 4 };
        }
        return { low: entry.remediationHoursLow, high: entry.remediationHoursHigh };
      },
    },
  );
  const rateUsdPerHour = configuredArchitectureRemediationRateUsdPerHour();

  return (
    <div className="space-y-8">
      <section className="hero-surface animate-fade-up px-6 py-8 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Sample Output</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Architecture Diagram Reviewer Sample Report</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 md:text-base">
          This is a synthetic example using a made-up system. It exists so buyers can inspect the report shape before
          they sign in and upload a real diagram.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-100">
          <Badge className="border-white/30 bg-white/10 text-white">Synthetic example</Badge>
          <Badge className="border-white/30 bg-white/10 text-white">No customer data</Badge>
          <Badge className="border-white/30 bg-white/10 text-white">Format preview only</Badge>
        </div>
      </section>

      <Alert tone="info">
        <AlertTitle>What this preview is for</AlertTitle>
        <AlertDescription>
          Use this page to understand the review format. Real uploads still require a verified business-email account,
          and real remediation scope is never promised from a sample alone.
        </AlertDescription>
      </Alert>

      {observation.tiersInOrder.length > 0 ? (
        <section className="surface rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">What I saw</p>
          <p className="mt-1 text-xs uppercase tracking-[0.04em] text-slate-400">
            Recognized components extracted from your narrative + diagram
          </p>
          <div className="mt-4 space-y-3">
            {observation.tiersInOrder.map((tier) => (
              <div key={tier.tier} className="grid grid-cols-[180px_1fr] items-start gap-4">
                <p className="text-xs uppercase tracking-[0.05em] text-slate-500">{tier.label}</p>
                <div className="flex flex-wrap gap-2">
                  {tier.services.map((service) => (
                    <span
                      key={service}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Reviewer&apos;s note</p>
        <p className="mt-3 text-base leading-7 text-slate-900">{reviewerSynthesis}</p>
        <p className="mt-3 text-base italic leading-7 text-slate-800">{reviewerSequencing}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.06em] text-slate-500">
          — Zohaib Khawaja · AWS Certified Solutions Architect, Professional · Houston, TX
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Provider</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{reviewScopeLabel(sampleReport.reviewScope)}</h2>
        </article>
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Overall Score</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{sampleReport.overallScore}/100</h2>
        </article>
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Confidence</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{sampleReport.analysisConfidence}</h2>
        </article>
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Recommended Next Step</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{sampleReport.quoteTier}</h2>
        </article>
      </section>

      {activePillarScores.length > 0 ? (
        <section className="surface rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Where the score lands by pillar</p>
          <div className="mt-4 space-y-3">
            {activePillarScores.map((pillar) => {
              const styles = pillarBarClasses(pillar.tone);
              const barWidth = Math.max(2, Math.min(100, pillar.score));
              const findingsLabel =
                pillar.findingsCount === 0
                  ? "No findings"
                  : `${pillar.findingsCount} finding${pillar.findingsCount === 1 ? "" : "s"} · -${pillar.pointsDeducted} pts`;
              return (
                <div key={pillar.category} className="grid grid-cols-[minmax(0,180px)_1fr_72px] items-center gap-3 md:gap-5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{pillar.label}</p>
                    <p className="text-[11px] uppercase tracking-[0.05em] text-slate-500">{findingsLabel}</p>
                  </div>
                  <div className={`h-2 rounded-full ${styles.track}`}>
                    <div className={`h-2 rounded-full ${styles.bar}`} style={{ width: `${barWidth}%` }} />
                  </div>
                  <p className={`text-right text-sm font-bold ${styles.text}`}>{pillar.score}/100</p>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Flow Narrative</p>
        <p className="mt-3 text-sm leading-7 text-slate-700">{sampleReport.flowNarrative}</p>
      </section>

      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top Deductions</p>
        <div className="mt-4 space-y-4">
          {positiveFindings.map((finding) => {
            const severity = getFindingSeverityLabel(finding.pointsDeducted);
            const caseStudy = getRelatedCaseStudy({ ruleId: finding.ruleId, category: finding.category });
            const counterfactual = getCounterfactualCost(finding.ruleId) ?? SAMPLE_COUNTERFACTUAL_COST;
            return (
              <article key={finding.ruleId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-[0.08em] ${severityBadgeClasses(severity)}`}
                    >
                      {severity}
                    </span>
                    <h2 className="text-base font-semibold text-slate-900">{finding.ruleId}</h2>
                  </div>
                  <Badge variant="secondary">-{finding.pointsDeducted} points</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-700"><strong>Why:</strong> {finding.why}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600"><strong>Evidence seen:</strong> {finding.evidenceSeen}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600"><strong>How to fix:</strong> {finding.howToFix}</p>
                {finding.officialSourceLinks.length > 0 ? (
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Official references: {finding.officialSourceLinks.map((link) => link.label).join(" · ")}
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-6 text-slate-500">Estimated fix-effort driver: {toUsd(finding.fixCostUSD)}</p>
                <div className="mt-3 rounded-md border-l-4 border-yellow-600 bg-yellow-50 px-3 py-2 text-sm leading-6 text-slate-800">
                  <span className="font-semibold text-slate-900">Cost of fixing vs not: </span>
                  {counterfactual}
                </div>
                {caseStudy ? (
                  <div className="mt-3 rounded-md border-l-4 border-sky-700 bg-sky-50 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-900">Where I&apos;ve caught this pattern: </span>
                    <Link href={caseStudy.href} className="font-medium text-sky-800 underline underline-offset-2">
                      {caseStudy.title}
                    </Link>
                    <span className="text-slate-600"> — {caseStudy.outcomeStat}</span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {quickWins.length > 0 ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-emerald-800">Quick wins to ship this week</p>
          <p className="mt-2 text-xs text-emerald-700">If you only do 3 things this week — biggest impact-per-hour wins from this review</p>
          <div className="mt-4 space-y-3">
            {quickWins.map((win, index) => (
              <article key={win.ruleId} className="rounded-xl border border-emerald-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{index + 1}. {win.ruleId}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.05em] text-emerald-700">
                  ~{formatHours(win.estimatedHoursLow)}–{formatHours(win.estimatedHoursHigh)} · saves {win.pointsDeducted} pts
                </p>
                {win.why ? <p className="mt-2 text-sm leading-6 text-slate-700"><strong>Why:</strong> {win.why}</p> : null}
                {win.howToFix ? <p className="mt-2 text-sm leading-6 text-slate-600"><strong>How to fix:</strong> {win.howToFix}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {optionalRecommendations.length > 0 ? (
        <section className="surface rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Optional Recommendations</p>
          <div className="mt-4 space-y-3">
            {optionalRecommendations.map((finding, index) => (
              <article key={finding.ruleId} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{index + 1}. {finding.ruleId}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600"><strong>Why:</strong> {finding.why}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600"><strong>How to fix:</strong> {finding.howToFix}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How ZoKorp handles the next step</p>
        <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
          <p>The free report points out the likely issues and recommends the next paid step.</p>
          <p>
            The diagnostic call stays fixed and lightweight. Larger delivery work is only estimated when the evidence is
            clear enough and the scope is actually safe for a solo operator to commit to. The current default remediation
            rate is <strong>{toUsd(rateUsdPerHour)}/hr</strong> — your real quote shows the hour breakdown alongside the
            total so the number is never arbitrary.
          </p>
          <p>Regulated or complex environments move toward manual scoping rather than an auto-approved implementation estimate.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Run your own review</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          The sample page is only a preview. Use the real tool for a verified, account-linked review delivered to your
          business inbox.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/software/architecture-diagram-reviewer" className={buttonVariants()}>
            Open Architecture Diagram Reviewer
          </Link>
          <Link href="/software/architecture-diagram-reviewer/benchmarks" className={buttonVariants({ variant: "secondary" })}>
            Review benchmark patterns
          </Link>
        </div>
      </section>
    </div>
  );
}
