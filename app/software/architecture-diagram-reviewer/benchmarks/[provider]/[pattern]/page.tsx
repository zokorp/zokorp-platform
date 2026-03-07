import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { type BenchmarkPattern, type BenchmarkProvider, getBenchmarkPattern, getBenchmarkProvider } from "@/lib/architecture-benchmarks";
import { buildPageMetadata } from "@/lib/site";

type PageParams = {
  provider: BenchmarkProvider;
  pattern: BenchmarkPattern["slug"];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { provider, pattern } = await params;
  const providerLibrary = getBenchmarkProvider(provider);
  const patternBenchmark = getBenchmarkPattern(provider, pattern);

  if (!providerLibrary || !patternBenchmark) {
    return buildPageMetadata({
      title: "Architecture Pattern Benchmarks",
      description: "Deterministic architecture benchmark pattern summary.",
      path: "/software/architecture-diagram-reviewer/benchmarks",
    });
  }

  return buildPageMetadata({
    title: `${providerLibrary.providerLabel} ${patternBenchmark.title} benchmark`,
    description: `${patternBenchmark.title} benchmark range and common deductions for ${providerLibrary.providerLabel} diagrams.`,
    path: `/software/architecture-diagram-reviewer/benchmarks/${provider}/${pattern}`,
  });
}

export default async function PatternBenchmarkPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { provider, pattern } = await params;
  const providerLibrary = getBenchmarkProvider(provider);
  const patternBenchmark = getBenchmarkPattern(provider, pattern);

  if (!providerLibrary || !patternBenchmark) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          {providerLibrary.providerLabel} / {patternBenchmark.title}
        </p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-slate-900">{patternBenchmark.title} benchmark</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{patternBenchmark.summary}</p>
        <p className="mt-4 text-sm font-semibold text-slate-900">
          Benchmark score range: {patternBenchmark.scoreRange[0]} to {patternBenchmark.scoreRange[1]}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="surface lift-card rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Common deductions</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">Most frequent rule IDs</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {patternBenchmark.commonDeductions.map((ruleId) => (
              <li key={ruleId} className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold">
                {ruleId}
              </li>
            ))}
          </ul>
        </article>

        <article className="surface lift-card rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Playbook snippet</p>
          <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">High-impact fix direction</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{patternBenchmark.remediationSnippet}</p>
          <Link href="/software/architecture-diagram-reviewer" className={`${buttonVariants()} mt-5`}>
            Run free review on your architecture
          </Link>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap gap-3">
          <Link href={`/software/architecture-diagram-reviewer/benchmarks/${provider}`} className={buttonVariants({ variant: "secondary" })}>
            Back to {providerLibrary.providerLabel} benchmark list
          </Link>
          <Link href="/software/architecture-diagram-reviewer/benchmarks" className={buttonVariants({ variant: "secondary" })}>
            Open benchmark library
          </Link>
        </div>
      </section>
    </div>
  );
}
