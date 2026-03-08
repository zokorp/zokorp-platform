import Link from "next/link";

import { ServiceRequestPanel } from "@/components/service-request-panel";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Services",
  description: "Request AWS consultation, readiness support, or software-backed delivery work from ZoKorp.",
  path: "/services",
});

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
    title: "Productized Delivery",
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
    title: "Track",
    detail: "Follow request status and delivery updates from your account timeline.",
  },
];

const serviceFaq = [
  {
    question: "How are engagements tracked?",
    answer:
      "Every request receives a tracking code and lifecycle status. You can view updates from your account page.",
  },
  {
    question: "Can service work connect to software products?",
    answer:
      "Yes. Delivery engagements can include setup for ZoKorp software tools and subscription handoff workflows.",
  },
  {
    question: "Do consultations require a subscription?",
    answer:
      "No. Consultations are handled as service requests and can be scoped independently from SaaS subscriptions.",
  },
];

export default function ServicesPage() {
  return (
    <div className="space-y-10">
      <section className="hero-surface animate-fade-up px-6 py-8 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Services</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">Build with confidence, not guesswork</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 md:text-base">
          ZoKorp combines architecture depth and delivery execution for teams that need real AWS AI/ML
          progress with evidence they can trust.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="#service-request" className={buttonVariants({ variant: "secondary" })}>
            Request service
          </Link>
          <Link
            href="/account"
            className={cn(buttonVariants({ variant: "ghost" }), "border border-white/30 text-white hover:bg-white/10")}
          >
            Track in account
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {serviceTracks.map((service) => (
          <article key={service.title} className="surface lift-card rounded-2xl p-6">
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

      <section className="surface soft-grid rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Engagement Flow</p>
        <h2 className="font-display mt-2 text-3xl font-semibold text-slate-900">How engagements run</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {engagementSteps.map((step, index) => (
            <article key={step.title} className="lift-card rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700">
                <span>Step</span>
                <span className="rounded-full bg-teal-50 px-2 py-1 font-mono tracking-[0.18em] text-teal-800">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </p>
              <h3 className="font-display mt-1 text-xl font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <ServiceRequestPanel />

      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <article className="surface lift-card rounded-2xl p-6">
          <h2 className="font-display text-2xl font-semibold text-slate-900">Need software-backed delivery?</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            ZoKorp software tools support the same delivery patterns used in consulting engagements,
            starting with validation workflows and account-based usage tracking.
          </p>
          <Link href="/software" className={`${buttonVariants()} mt-5`}>
            Explore software catalog
          </Link>
        </article>

        <article className="glass-surface lift-card rounded-2xl p-6">
          <h3 className="font-display text-xl font-semibold text-slate-900">Service FAQ</h3>
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {serviceFaq.map((item) => (
              <li key={item.question}>
                <p className="font-semibold text-slate-900">{item.question}</p>
                <p className="mt-1 text-slate-600">{item.answer}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
