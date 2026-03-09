import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { buildArchitectureReviewReport } from "@/lib/architecture-review/report";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
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
      message: "Document identity, secrets, and encryption controls.",
      fix: "Name IAM boundaries, secret handling, and encryption points for the request path.",
      evidence: "The diagram describes app flow but does not show concrete security controls.",
    },
    {
      ruleId: "REL-RTO-RPO-MISSING",
      category: "reliability",
      pointsDeducted: 8,
      message: "State recovery targets for stateful services.",
      fix: "Add RTO/RPO targets for the primary data stores and queue-backed recovery behavior.",
      evidence: "Stateful services are present without explicit recovery targets.",
    },
    {
      ruleId: "MSFT-COMPONENT-LABEL-COVERAGE",
      category: "clarity",
      pointsDeducted: 6,
      message: "Explain the role of each major component in the paragraph.",
      fix: "State what each service does and how requests move across the boundary lines.",
      evidence: "Multiple services are named but not fully explained in the narrative.",
    },
    {
      ruleId: "MSFT-LAYERING-OPTIONAL",
      category: "clarity",
      pointsDeducted: 0,
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

export default function ArchitectureReviewerSampleReportPage() {
  const positiveFindings = sampleReport.findings.filter((finding) => finding.pointsDeducted > 0);

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

      <section className="grid gap-5 lg:grid-cols-4">
        <article className="surface rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Provider</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{sampleReport.provider.toUpperCase()}</h2>
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

      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Flow Narrative</p>
        <p className="mt-3 text-sm leading-7 text-slate-700">{sampleReport.flowNarrative}</p>
      </section>

      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Top Deductions</p>
        <div className="mt-4 space-y-4">
          {positiveFindings.map((finding) => (
            <article key={finding.ruleId} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">{finding.ruleId}</h2>
                <Badge variant="secondary">-{finding.pointsDeducted} points</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{finding.message}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">Fix: {finding.fix}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">Estimated fix-effort driver: ${finding.fixCostUSD}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How ZoKorp handles the next step</p>
        <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
          <p>The free report points out the likely issues and recommends the next paid step.</p>
          <p>The diagnostic call stays fixed and lightweight. Larger delivery work is only quoted when the evidence is clear enough and the scope is actually safe for a solo operator to commit to.</p>
          <p>Regulated or complex environments move toward manual scoping rather than an auto-approved implementation quote.</p>
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
