import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildPageMetadata, getSiteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: siteConfig.platformName,
  description: "Software, services, and billing workflows for practical AWS AI delivery teams.",
  path: "/",
});

const valueProps = [
  {
    title: "Software that reflects real delivery work",
    detail: "ZoKorp turns repetitive review and readiness tasks into account-linked tools instead of keeping them fully manual.",
  },
  {
    title: "Services that connect to the same account",
    detail: "Customers can move from self-serve software to scoped help without losing billing or workflow context.",
  },
  {
    title: "Operational trust built into the platform",
    detail: "Verified access, Stripe-hosted billing, support paths, and platform policies are visible before you buy.",
  },
];

const startPoints = [
  {
    title: "Architecture Diagram Reviewer",
    summary: "A free entry point for architecture feedback with server-validated scoring and PNG or SVG uploads.",
    cta: "Run the free review",
    href: "/software/architecture-diagram-reviewer",
  },
  {
    title: "ZoKorpValidator",
    summary: "Credit-based validation software for evidence-heavy review workflows that should not stay manual.",
    cta: "Open validator",
    href: "/software/zokorp-validator",
  },
  {
    title: "Scoped AWS delivery help",
    summary: "For teams that need architecture guidance, readiness structure, or implementation follow-through beyond self-serve tooling.",
    cta: "Request services",
    href: "/services#service-request",
  },
];

const trustLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "Security" },
  { href: "/privacy", label: "Privacy" },
  { href: "/support", label: "Support" },
];

const operatingSignals = [
  "Verified business accounts",
  "Stripe-hosted billing",
  "Server-validated uploads",
];

export default function HomePage() {
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.platformName,
      url: getSiteUrl(),
      email: siteConfig.supportEmail,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Houston",
        addressRegion: "TX",
        addressCountry: "US",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.platformName,
      url: getSiteUrl(),
      description: siteConfig.description,
    },
  ];

  return (
    <div className="space-y-12 md:space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="hero-surface animate-fade-up overflow-hidden px-6 py-12 text-white md:px-10 md:py-14">
        <div className="pointer-events-none absolute -right-8 top-4 h-36 w-36 rounded-full border border-white/15 bg-white/10 blur-md animate-float-soft" />
        <div className="pointer-events-none absolute -bottom-16 left-8 h-44 w-44 rounded-full bg-amber-300/25 blur-3xl" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-end">
          <div>
            <Badge variant="brand" className="border-white/15 bg-white/12 text-white shadow-none">
              ZoKorp Platform
            </Badge>
            <h1 className="font-display mt-5 max-w-4xl text-balance text-4xl font-semibold leading-tight md:text-6xl">
              Practical AI delivery software, AWS guidance, and billing in one customer platform.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-100/95 md:text-lg">
              Start with a free review tool, buy self-serve validation software, or request a scoped engagement
              without leaving the same account and billing surface.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/software" className={cn(buttonVariants({ size: "lg" }), "bg-white text-slate-950 hover:bg-slate-100")}>
                Browse Software
              </Link>
              <Link
                href="/pricing"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "border border-white/35 text-white hover:bg-white/10",
                )}
              >
                View Pricing
              </Link>
              <Link
                href="/services#service-request"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "lg" }),
                  "pulse-accent border border-teal-200/80 bg-teal-500/20 text-teal-50 hover:bg-teal-500/30",
                )}
              >
                Request Services
              </Link>
            </div>
          </div>

          <Card
            tone="glass"
            className="rounded-[calc(var(--radius-xl)+0.25rem)] border border-white/15 bg-white/10 p-6 text-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] backdrop-blur"
          >
            <CardHeader className="gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-100/75">Operating Signal</p>
              <h2 className="font-display text-3xl font-semibold">Move from discovery to delivery without switching surfaces</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {operatingSignals.map((signal) => (
                <div key={signal} className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm text-slate-100/92">
                  {signal}
                </div>
              ))}
            </CardContent>
            <CardFooter className="pt-1 text-sm text-slate-100/78">
              Keep tool access, purchases, and service follow-up under one customer account.
            </CardFooter>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {valueProps.map((item, index) => (
          <Card
            key={item.title}
            lift
            className="animate-fade-up rounded-3xl p-6"
            style={{ animationDelay: `${Math.min(index, 3) * 90}ms` }}
          >
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Why teams choose it</p>
              <h2 className="font-display text-2xl font-semibold text-slate-900">{item.title}</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-slate-700">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="surface soft-grid rounded-[calc(var(--radius-xl)+0.25rem)] p-6 md:p-7">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Start Here</p>
            <h2 className="font-display mt-1 text-3xl font-semibold text-slate-900">
              Choose the right entry point
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Start with the software or service path that matches how much structure your team needs right now.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {operatingSignals.map((signal) => (
              <Badge key={signal} variant="secondary" className="bg-white/90 text-slate-700">
                {signal}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {startPoints.map((item) => (
            <Card key={item.title} lift className="rounded-3xl border border-slate-200 bg-white p-6">
              <CardHeader>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Entry point</p>
                <h3 className="font-display text-2xl font-semibold text-slate-900">{item.title}</h3>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">{item.summary}</p>
              </CardContent>
              <CardFooter>
                <Link href={item.href} className={buttonVariants()}>
                  {item.cta}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <Card lift className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6 md:p-7">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Why it converts better</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">
              The platform removes purchase and follow-up friction
            </h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-7 text-slate-600 md:text-base">
              Customers do not need one site for discovery, another workflow for delivery requests, and a separate
              billing portal that feels disconnected. ZoKorp keeps those steps under one account framework.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/about" className={buttonVariants({ variant: "secondary" })}>
              About the platform
            </Link>
            <Link href="/case-studies" className={buttonVariants()}>
              View case studies
            </Link>
          </CardFooter>
        </Card>

        <Card tone="glass" lift className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6 md:p-7">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Trust Center</p>
            <h2 className="font-display text-2xl font-semibold text-slate-900">Read the operating basics first</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {trustLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                <span>{link.label}</span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
