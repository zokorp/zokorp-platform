import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildPageMetadata } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "About",
  description: "Learn how ZoKorp combines software, delivery, and billing into one operating platform.",
  path: "/about",
});

const principles = [
  {
    title: "Software should remove repetitive review work",
    detail:
      "ZoKorp turns repeatable delivery tasks into productized workflows instead of treating every engagement as custom forever.",
  },
  {
    title: "Customer context should not get lost between products and services",
    detail:
      "The platform links software access, service requests, and billing history under the same account so follow-up work is cleaner.",
  },
  {
    title: "Operational trust matters as much as visual design",
    detail:
      "Clear support paths, security expectations, and billing behavior are part of the product, not post-purchase cleanup.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <section className="hero-surface animate-fade-up px-6 py-9 text-white md:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">About</p>
        <h1 className="font-display mt-2 text-balance text-4xl font-semibold">ZoKorp is built for practical delivery work</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-100 md:text-base">
          ZoKorp combines AWS-focused advisory work, productized validation tooling, and account-linked
          software delivery so customers can move from discovery to execution without changing systems.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {principles.map((principle) => (
          <article key={principle.title} className="surface lift-card rounded-2xl p-6">
            <h2 className="font-display text-2xl font-semibold text-slate-900">{principle.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{principle.detail}</p>
          </article>
        ))}
      </section>

      <section className="surface soft-grid rounded-2xl p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">What the platform does</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-2xl font-semibold text-slate-900">Software</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Self-serve tools for validation, architecture review, and future delivery workflows with
              account-linked access and billing controls.
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-display text-2xl font-semibold text-slate-900">Services</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Consultation and delivery support for teams that need architecture depth, readiness structure,
              or implementation guidance beyond what self-serve tooling can handle.
            </p>
          </article>
        </div>
      </section>

      <Card tone="glass" className="rounded-2xl p-6">
        <h2 className="font-display text-2xl font-semibold text-slate-900">Where to go next</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/pricing" className={buttonVariants()}>
            View pricing
          </Link>
          <Link href="/case-studies" className={buttonVariants({ variant: "secondary" })}>
            View case studies
          </Link>
        </div>
      </Card>
    </div>
  );
}
