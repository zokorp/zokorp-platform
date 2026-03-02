import Link from "next/link";

const mediaItems = [
  {
    type: "Article",
    title: "Practical Patterns for AI Validation Workflows",
    status: "Draft in progress",
    description:
      "A field guide for reducing operational overhead in recurring AI delivery validation and review cycles.",
  },
  {
    type: "Playbook",
    title: "AWS Partner Readiness Checklist Framework",
    status: "Draft in progress",
    description:
      "A structured approach to evidence preparation and process alignment for AWS partner milestones.",
  },
  {
    type: "Product Note",
    title: "ZoKorpValidator Usage Guide",
    status: "Planned",
    description:
      "Quick-start workflow for running validation inputs, interpreting output, and tracking purchased credits.",
  },
];

export default function MediaPage() {
  return (
    <div className="space-y-8">
      <section className="surface rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Media</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold text-slate-900">
          Insights, guides, and platform updates
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          This section will host ZoKorp articles, educational media, and product release notes.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {mediaItems.map((item) => (
          <article key={item.title} className="surface rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.type}</p>
            <h2 className="font-display mt-2 text-2xl font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            <span className="mt-4 inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-slate-700">
              {item.status}
            </span>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-300 bg-slate-900 px-6 py-8 text-white md:px-8">
        <h2 className="font-display text-3xl font-semibold">Want updates tied to software releases?</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
          Sign in and monitor account activity as software capabilities and billing flows continue to
          expand through the MVP cycle.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/login"
            className="focus-ring inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Sign in
          </Link>
          <Link
            href="/software"
            className="focus-ring inline-flex rounded-md border border-slate-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Browse software
          </Link>
        </div>
      </section>
    </div>
  );
}
