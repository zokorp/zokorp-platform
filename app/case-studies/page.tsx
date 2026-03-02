import Link from "next/link";

const caseStudies = [
  {
    title: "Validation Readiness System",
    sector: "Cloud Delivery Operations",
    summary:
      "Standardized cross-team evidence workflows and reduced manual checklist friction in recurring delivery reviews.",
    outcomes: [
      "Faster checklist completion cycles",
      "Clearer handoff quality across teams",
      "Reusable process artifacts for scale",
    ],
  },
  {
    title: "Governed AI in Education",
    sector: "Education",
    summary:
      "Designed practical adoption pathways for AI systems with governance-aware controls and implementation support.",
    outcomes: [
      "Stronger policy alignment for adoption",
      "Improved team throughput with guardrails",
      "Operational rollout plan with measurable checkpoints",
    ],
  },
  {
    title: "Partner Validation Acceleration",
    sector: "AWS Partner Enablement",
    summary:
      "Combined consulting execution with productized tooling to shorten partner validation preparation timelines.",
    outcomes: [
      "Lower prep overhead for milestone evidence",
      "Repeatable preparation templates",
      "Improved confidence in readiness reviews",
    ],
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-300 bg-gradient-to-r from-[#0b1f3a] via-[#123b61] to-[#11607c] px-6 py-9 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">Case Studies</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Delivery outcomes in context</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-100 md:text-base">
          Snapshot examples of how ZoKorp combines cloud AI architecture, operational execution, and
          software-backed workflows to create measurable results.
        </p>
      </section>

      <section className="grid gap-5">
        {caseStudies.map((study) => (
          <article key={study.title} className="surface rounded-2xl p-6 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{study.sector}</p>
                <h2 className="font-display mt-1 text-3xl font-semibold text-slate-900">{study.title}</h2>
              </div>
              <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-teal-700">
                In Progress Portfolio
              </span>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{study.summary}</p>
            <ul className="mt-4 grid gap-2 md:grid-cols-3">
              {study.outcomes.map((outcome) => (
                <li key={outcome} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {outcome}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="surface-muted rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Need a software-backed engagement?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Explore ZoKorp software tools that turn repeatable service workflows into productized execution.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/software"
            className="focus-ring inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Browse software
          </Link>
          <Link
            href="/services"
            className="focus-ring inline-flex rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            Browse services
          </Link>
        </div>
      </section>
    </div>
  );
}
