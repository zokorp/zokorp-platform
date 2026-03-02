import Link from "next/link";

const serviceTracks = [
  {
    title: "AWS Consultation",
    summary:
      "Technical guidance for architecture, model operations, and production reliability.",
    points: [
      "Reference architecture and roadmap reviews",
      "Model lifecycle and MLOps implementation guidance",
      "Security and resiliency baseline recommendations",
    ],
  },
  {
    title: "APN Consulting",
    summary:
      "Support for AWS partner readiness, validation evidence, and execution workflows.",
    points: [
      "Partner program readiness and planning",
      "Validation evidence preparation and review workflows",
      "Operational support for AWS engagement milestones",
    ],
  },
  {
    title: "AWS ML Products",
    summary:
      "Reusable software components to reduce repetitive manual validation and reporting work.",
    points: [
      "Checklist validation tooling for standardized review",
      "Delivery accelerators and implementation templates",
      "Product catalog expansion aligned with platform roadmap",
    ],
  },
];

const engagementSteps = [
  {
    title: "Assess",
    detail: "Map your delivery goals, constraints, and required validation outcomes.",
  },
  {
    title: "Design",
    detail: "Define architecture, operating model, and accountability paths.",
  },
  {
    title: "Implement",
    detail: "Execute with measurable milestones and reusable tooling.",
  },
  {
    title: "Scale",
    detail: "Move repeatable work into software-backed operational workflows.",
  },
];

export default function ServicesPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-300 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-6 py-8 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Services</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Build with confidence, not guesswork</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 md:text-base">
          ZoKorp combines architecture depth and delivery execution for teams that need real AWS
          AI/ML progress with evidence they can trust.
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {serviceTracks.map((service) => (
          <article key={service.title} className="surface rounded-2xl p-6">
            <h2 className="font-display text-2xl font-semibold text-slate-900">{service.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{service.summary}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {service.points.map((point) => (
                <li key={point} className="rounded-md bg-slate-50 px-3 py-2">
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="surface rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Engagement Flow</p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-slate-900">How engagements run</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {engagementSteps.map((step, index) => (
            <article key={step.title} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">Step 0{index + 1}</p>
              <h3 className="font-display mt-1 text-xl font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <article className="surface rounded-2xl p-6">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Need software-backed delivery?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            ZoKorp software tools are designed to support the same delivery patterns used in
            consulting engagements, starting with validation workflows.
          </p>
          <Link
            href="/software"
            className="focus-ring mt-5 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Explore software catalog
          </Link>
        </article>

        <article className="surface-muted rounded-2xl p-6">
          <h3 className="font-display text-xl font-semibold text-slate-900">Delivery baseline</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Clear scope and measurable success criteria</li>
            <li>Pragmatic architecture and implementation sequencing</li>
            <li>Operational documentation for repeatability</li>
            <li>Governance support and risk-aware execution</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
