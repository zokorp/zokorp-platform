import Link from "next/link";

const serviceItems = [
  {
    title: "AWS Consultation",
    description:
      "Design and optimize AI/ML cloud infrastructure with practical, implementation-focused guidance.",
  },
  {
    title: "APN Consulting",
    description:
      "Get strategic and technical support for AWS partner lifecycle milestones and validations.",
  },
  {
    title: "AWS Products",
    description:
      "Use ZoKorp-built workflows and validation tooling to move faster with less operational friction.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 px-6 py-12 text-white md:px-10">
        <p className="mb-3 text-sm uppercase tracking-wider text-slate-200">ZoKorp</p>
        <h1 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
          AWS AI/ML engineering, validated delivery, and productized tooling.
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Build reliable cloud AI systems and operational readiness with practical services and
          software.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/services"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            Explore Services
          </Link>
          <Link
            href="/software"
            className="rounded-md border border-white/40 px-4 py-2 text-sm font-medium hover:bg-white/10"
          >
            Browse Software
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Core Services</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {serviceItems.map((item) => (
            <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-2xl font-semibold">AI in Education</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          ZoKorp supports practical AI adoption in learning environments with governance-minded
          workflows that help teams use AI responsibly while improving throughput.
        </p>
      </section>
    </div>
  );
}
