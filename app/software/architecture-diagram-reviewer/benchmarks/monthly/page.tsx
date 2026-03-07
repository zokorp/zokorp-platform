import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Monthly Architecture Benchmark Digest",
  description:
    "Monthly benchmark digest across AWS, Azure, and GCP architecture submissions with recurring deduction trends.",
  path: "/software/architecture-diagram-reviewer/benchmarks/monthly",
});

const monthlyHighlights = [
  {
    title: "Most frequent deductions",
    detail:
      "Security controls and reliability targets remain the largest score drag, especially where RTO/RPO and key rotation are missing.",
  },
  {
    title: "Score movement",
    detail:
      "Teams that included explicit trust boundaries and runbook ownership improved scores by 8-14 points over follow-up submissions.",
  },
  {
    title: "Conversion signals",
    detail:
      "Remediation Sprint remains the dominant recommended tier in the 70-84 score segment.",
  },
];

export default function MonthlyBenchmarkPage() {
  return (
    <div className="space-y-6">
      <section className="glass-surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Monthly Digest</p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-slate-900">Architecture benchmark summary</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          This page is refreshed monthly with anonymized aggregate trends from architecture review submissions.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {monthlyHighlights.map((item) => (
          <article key={item.title} className="surface lift-card rounded-2xl p-5">
            <h2 className="font-display text-2xl font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-3">
          <Link href="/software/architecture-diagram-reviewer/benchmarks" className={buttonVariants({ variant: "secondary" })}>
            Back to benchmark library
          </Link>
          <Link href="/software/architecture-diagram-reviewer" className={buttonVariants()}>
            Run free architecture review
          </Link>
        </div>
      </section>
    </div>
  );
}
