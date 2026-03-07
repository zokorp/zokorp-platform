import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { type BenchmarkProvider, getBenchmarkProvider } from "@/lib/architecture-benchmarks";
import { buildPageMetadata } from "@/lib/site";

type PageParams = {
  provider: BenchmarkProvider;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { provider } = await params;
  const providerLibrary = getBenchmarkProvider(provider);

  if (!providerLibrary) {
    return buildPageMetadata({
      title: "Architecture Benchmarks",
      description: "Provider-level architecture benchmark summaries.",
      path: "/software/architecture-diagram-reviewer/benchmarks",
    });
  }

  return buildPageMetadata({
    title: `${providerLibrary.providerLabel} Architecture Benchmarks`,
    description: providerLibrary.description,
    path: `/software/architecture-diagram-reviewer/benchmarks/${providerLibrary.provider}`,
  });
}

export default async function ProviderBenchmarkPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { provider } = await params;
  const providerLibrary = getBenchmarkProvider(provider);

  if (!providerLibrary) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="glass-surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{providerLibrary.providerLabel}</p>
        <h1 className="font-display mt-2 text-3xl font-semibold text-slate-900">
          {providerLibrary.providerLabel} benchmark patterns
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{providerLibrary.description}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {providerLibrary.patterns.map((pattern) => (
          <article key={pattern.slug} className="surface lift-card rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{providerLibrary.providerLabel}</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{pattern.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{pattern.summary}</p>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              Score range: {pattern.scoreRange[0]} to {pattern.scoreRange[1]}
            </p>
            <Link href={`/software/architecture-diagram-reviewer/benchmarks/${providerLibrary.provider}/${pattern.slug}`} className={`${buttonVariants()} mt-4`}>
              Open pattern breakdown
            </Link>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <Link href="/software/architecture-diagram-reviewer" className={buttonVariants({ variant: "secondary" })}>
          Run free architecture review
        </Link>
      </section>
    </div>
  );
}
