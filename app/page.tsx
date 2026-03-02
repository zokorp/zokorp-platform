import Link from "next/link";

const serviceItems = [
  {
    title: "AWS Consultation",
    description:
      "Architecture reviews, execution plans, and reliability controls for cloud AI programs that need clean delivery.",
  },
  {
    title: "APN Consulting",
    description:
      "Partner-readiness support for evidence, process, and technical milestones tied to AWS engagement goals.",
  },
  {
    title: "Productized Tooling",
    description:
      "Validation tools that convert repeatable delivery tasks into faster, lower-friction software workflows.",
  },
];

const metrics = [
  { label: "Primary Focus", value: "AWS AI/ML Delivery" },
  { label: "Platform Model", value: "Services + Software" },
  { label: "Billing Models", value: "Free, Credits, Subscription" },
];

const caseStudyTeasers = [
  {
    title: "Validation Readiness",
    summary: "Cut checklist preparation overhead by standardizing review steps across teams.",
  },
  {
    title: "Governed AI Adoption",
    summary: "Improve throughput while preserving security and operational control boundaries.",
  },
  {
    title: "Delivery Acceleration",
    summary: "Move from advisory-only work to reusable software-backed delivery assets.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10 md:space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-[#091b36] via-[#103059] to-[#176d88] px-6 py-12 text-white shadow-2xl md:px-10 md:py-14">
        <div className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-amber-300/25 blur-3xl" />

        <p className="text-sm uppercase tracking-[0.2em] text-slate-100/90">ZoKorp Platform</p>
        <h1 className="font-display mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight md:text-6xl">
          Build cloud AI systems that are practical to operate, validate, and scale.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-100/95 md:text-lg">
          ZoKorp combines AWS architecture execution with productized software so teams can deliver
          outcomes faster without sacrificing governance or reliability.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/services"
            className="focus-ring rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Explore Services
          </Link>
          <Link
            href="/software"
            className="focus-ring rounded-md border border-white/45 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Browse Software
          </Link>
          <Link
            href="/software/zokorp-validator"
            className="focus-ring pulse-accent rounded-md border border-teal-200/80 bg-teal-500/20 px-5 py-2.5 text-sm font-semibold text-teal-100 transition hover:bg-teal-500/30"
          >
            Try ZoKorpValidator
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="surface rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{metric.label}</p>
            <p className="mt-2 font-display text-xl font-semibold text-slate-900">{metric.value}</p>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Core Services</p>
            <h2 className="font-display mt-1 text-3xl font-semibold text-slate-900">Delivery with depth</h2>
          </div>
          <Link href="/services" className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">
            View full services page
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {serviceItems.map((item) => (
            <article key={item.title} className="surface rounded-2xl p-6">
              <h3 className="font-display text-xl font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="surface rounded-2xl p-6 md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Featured Software</p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-slate-900">ZoKorpValidator</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Upload PDF or Excel validation inputs and receive structured text output. Designed for
            FTR, SDP/SRP, and Competency review workflows.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1">$50 FTR</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">$150 SDP/SRP</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">$500 Competency</span>
          </div>
          <div className="mt-6">
            <Link
              href="/software/zokorp-validator"
              className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open ZoKorpValidator
            </Link>
          </div>
        </article>

        <article className="surface-muted rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pipeline</p>
          <h3 className="font-display mt-2 text-2xl font-semibold text-slate-900">What launches next</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            <li>Unified account billing and invoice visibility via hosted Stripe portal</li>
            <li>Subscription-tier software tools under authenticated entitlements</li>
            <li>Usage-based billing hooks for future metered platform products</li>
          </ul>
        </article>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Case Study Themes</p>
          <Link href="/case-studies" className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline">
            View case studies page
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {caseStudyTeasers.map((item, index) => (
            <article key={item.title} className="surface rounded-2xl p-5">
              <p className="text-xs font-semibold text-teal-700">0{index + 1}</p>
              <h3 className="font-display mt-2 text-xl font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-slate-900 px-6 py-8 text-white md:px-8">
        <h2 className="font-display text-3xl font-semibold">Ready to move from concept to validated delivery?</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
          Start with AWS consultation or directly evaluate ZoKorp software tooling based on your
          validation workflow needs.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/services"
            className="focus-ring rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            View Services
          </Link>
          <Link
            href="/software"
            className="focus-ring rounded-md border border-slate-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View Software
          </Link>
        </div>
      </section>
    </div>
  );
}
