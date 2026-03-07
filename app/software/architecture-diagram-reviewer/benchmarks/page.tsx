import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ARCHITECTURE_BENCHMARK_LIBRARY, getBenchmarkFaqItems } from "@/lib/architecture-benchmarks";
import { buildPageMetadata, getSiteUrl } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Architecture Diagram Benchmarks",
  description:
    "Provider-level architecture benchmark ranges, common deductions, and remediation snippets from anonymized ZoKorp Architecture Diagram Reviewer submissions.",
  path: "/software/architecture-diagram-reviewer/benchmarks",
});

export default function ArchitectureBenchmarkLibraryPage() {
  const faqItems = getBenchmarkFaqItems();

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const howToStructuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Run ZoKorp Architecture Diagram Reviewer",
    description: "Submit an architecture diagram and receive deterministic findings by email.",
    totalTime: "PT2M",
    step: [
      {
        "@type": "HowToStep",
        name: "Upload a diagram file",
        text: "Upload a PNG or SVG architecture diagram.",
      },
      {
        "@type": "HowToStep",
        name: "Describe architecture flow",
        text: "Write one paragraph describing component and data flow.",
      },
      {
        "@type": "HowToStep",
        name: "Receive report by email",
        text: "Get score, findings, and quote options by email only.",
      },
    ],
  };

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToStructuredData) }} />

      <section className="hero-surface animate-fade-up px-6 py-8 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Benchmark Library</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Architecture Diagram Benchmarks</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 md:text-base">
          Compare common architecture patterns by provider, see recurring deductions, and identify remediation priorities
          before your next review.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-100">
          <Badge className="border-white/30 bg-white/10 text-white">Anonymized aggregates</Badge>
          <Badge className="border-white/30 bg-white/10 text-white">Deterministic scoring</Badge>
          <Badge className="border-white/30 bg-white/10 text-white">Email-only detailed results</Badge>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {ARCHITECTURE_BENCHMARK_LIBRARY.map((provider) => (
          <article key={provider.provider} className="surface lift-card rounded-2xl p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{provider.providerLabel}</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{provider.providerLabel} patterns</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{provider.description}</p>
            <ul className="mt-4 space-y-1 text-sm text-slate-700">
              {provider.patterns.map((pattern) => (
                <li key={pattern.slug}>
                  <Link
                    href={`/software/architecture-diagram-reviewer/benchmarks/${provider.provider}/${pattern.slug}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {pattern.title}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/software/architecture-diagram-reviewer/benchmarks/${provider.provider}`} className={`${buttonVariants()} mt-5`}>
              Open {provider.providerLabel} benchmarks
            </Link>
          </article>
        ))}
      </section>

      <section className="surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Monthly Summary</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">Score movement and recurring gaps</h2>
          </div>
          <Link href="/software/architecture-diagram-reviewer/benchmarks/monthly" className={buttonVariants({ variant: "secondary" })}>
            View monthly benchmark digest
          </Link>
        </div>
      </section>

      <section className="surface rounded-2xl p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">FAQ</p>
        <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">Architecture benchmark FAQ</h2>
        <div className="mt-4 space-y-4">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Run your own review</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Benchmark pages are directional aggregates. For deterministic findings and quote options, run your own
          architecture review.
        </p>
        <Link href="/software/architecture-diagram-reviewer" className={`${buttonVariants()} mt-5`}>
          Open Architecture Diagram Reviewer
        </Link>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Architecture Diagram Benchmarks",
            url: `${getSiteUrl()}/software/architecture-diagram-reviewer/benchmarks`,
          }),
        }}
      />
    </div>
  );
}
