import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Case Studies",
  description: "Representative delivery patterns showing how ZoKorp combines software and services.",
  path: "/case-studies",
});

const caseStudies = [
  {
    title: "Validation workflow standardization",
    label: "Representative delivery pattern",
    summary:
      "A recurring review process was slowed down by ad hoc checklist handling, inconsistent evidence packaging, and unclear review ownership.",
    response:
      "ZoKorp-style delivery pairs a software-backed validation path with a review workflow that makes evidence quality visible before milestone deadlines.",
    outcomes: [
      "Clearer handoff quality between contributors and reviewers",
      "Less manual checklist rework across repeat cycles",
      "A reusable baseline for future software-backed workflow automation",
    ],
  },
  {
    title: "Governed AI rollout planning",
    label: "Representative delivery pattern",
    summary:
      "A team needed to move quickly on AI adoption without losing sight of ownership, security, and operational guardrails.",
    response:
      "ZoKorp-style delivery starts with architecture clarity, identifies the missing control signals, and then converts repeatable review work into structured operating patterns.",
    outcomes: [
      "Sharper distinction between architecture intent and delivery ownership",
      "Better readiness for policy and security review",
      "A clearer path from advisory work to repeatable internal workflows",
    ],
  },
  {
    title: "Partner-readiness execution support",
    label: "Representative delivery pattern",
    summary:
      "Evidence-heavy milestone work created last-minute pressure because collection, review, and packaging were happening at the same time.",
    response:
      "ZoKorp-style delivery separates artifact collection from review and uses software where repetitive checks should no longer stay manual.",
    outcomes: [
      "More predictable readiness preparation cycles",
      "Cleaner ownership of milestone evidence",
      "Better alignment between consulting effort and productized tooling",
    ],
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="space-y-8">
      <section className="hero-surface animate-fade-up px-6 py-9 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">Case Studies</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Representative delivery patterns</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-100 md:text-base">
          These examples are anonymized platform and delivery patterns that show how ZoKorp connects
          consulting work, validation tooling, and repeatable workflow design.
        </p>
      </section>

      <section className="grid gap-5">
        {caseStudies.map((study) => (
          <article key={study.title} className="surface lift-card rounded-2xl p-6 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{study.label}</p>
                <h2 className="font-display mt-1 text-3xl font-semibold text-slate-900">{study.title}</h2>
              </div>
              <Badge variant="brand">
                Software + services
              </Badge>
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-700 md:text-base">
              <span className="font-semibold text-slate-900">Situation:</span> {study.summary}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700 md:text-base">
              <span className="font-semibold text-slate-900">ZoKorp response:</span> {study.response}
            </p>
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

      <Card tone="glass" className="rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Need the platform version of this work?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Start with the software catalog or request a scoped service conversation for larger delivery needs.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/software" className={buttonVariants()}>
            Browse software
          </Link>
          <Link href="/services" className={buttonVariants({ variant: "secondary" })}>
            Browse services
          </Link>
        </div>
      </Card>
    </div>
  );
}
