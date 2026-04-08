import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { buildCalendlyBookingUrl } from "@/lib/calendly";
import { CONSULTING_OFFERS, DELIVERY_PROCESS_STEPS, SOFTWARE_HIGHLIGHTS } from "@/lib/marketing-content";
import {
  PUBLIC_LAUNCH_CONTACT,
  PUBLIC_LAUNCH_FOUNDER_PROFILE,
  PUBLIC_LAUNCH_PROOF_ASSET,
} from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata, getMarketingSiteUrl, siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = buildMarketingPageMetadata({
  title: "AWS Architecture, AI/ML Advisory, and Software",
  description:
    "Founder-led AWS architecture review, readiness support, AI/ML advisory, and software for teams that need clear next steps without forced signup.",
  path: "/",
});

const trustSignals = [
  "Former AWS Partner Solutions Architect",
  "AWS SA Pro, ML Specialty, Security Specialty",
  "Background across AWS, Microsoft, and Nordic Global",
  "Public software and consulting paths with no forced signup",
];

export default function HomePage() {
  const marketingSiteUrl = getMarketingSiteUrl();
  const bookingUrl = buildCalendlyBookingUrl({
    baseUrl: process.env.ARCH_REVIEW_BOOK_CALL_URL ?? `${marketingSiteUrl}/services#service-request`,
    utmMedium: "homepage",
  });

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteConfig.name,
      url: marketingSiteUrl,
      email: PUBLIC_LAUNCH_CONTACT.primaryEmail,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Houston",
        addressRegion: "TX",
        addressCountry: "US",
      },
      sameAs: [PUBLIC_LAUNCH_CONTACT.linkedInUrl],
    },
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: PUBLIC_LAUNCH_FOUNDER_PROFILE.name,
      jobTitle: PUBLIC_LAUNCH_FOUNDER_PROFILE.role,
      worksFor: {
        "@type": "Organization",
        name: siteConfig.name,
      },
      sameAs: [PUBLIC_LAUNCH_CONTACT.linkedInUrl],
    },
  ];

  return (
    <div className="space-y-12 md:space-y-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f5f1_100%)] px-6 py-8 shadow-[0_20px_40px_rgba(15,23,42,0.06)] md:px-8 md:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
          <div>
            <Badge variant="secondary" className="border-slate-200 bg-white text-slate-700">
              Founder-led consultancy + software
            </Badge>
            <h1 className="font-display mt-5 max-w-4xl text-balance text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
              AWS architecture review, remediation, and software for teams that need a credible next step.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 md:text-lg">
              ZoKorp helps teams move from architecture questions to scoped implementation, AWS readiness work,
              AI/ML advisory, and software-backed follow-through without forcing signup just to understand what is
              being sold.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href={bookingUrl} className={buttonVariants({ size: "lg" })}>
                Book a call
              </a>
              <Link href="/services#service-request" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Get a quote
              </Link>
              <Link href="/software" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                Explore software
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {trustSignals.map((signal) => (
                <div
                  key={signal}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
                >
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
              <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
                <div className="relative min-h-[280px] bg-[linear-gradient(180deg,#e7ebf4_0%,#cfd7e7_100%)]">
                  <Image
                    src={PUBLIC_LAUNCH_FOUNDER_PROFILE.headshotPath}
                    alt={PUBLIC_LAUNCH_FOUNDER_PROFILE.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 360px"
                    priority
                  />
                </div>
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Founder</p>
                  <h2 className="font-display mt-2 text-3xl font-semibold text-slate-950">
                    {PUBLIC_LAUNCH_FOUNDER_PROFILE.name}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-700">{PUBLIC_LAUNCH_FOUNDER_PROFILE.role}</p>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{PUBLIC_LAUNCH_FOUNDER_PROFILE.summary}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {PUBLIC_LAUNCH_FOUNDER_PROFILE.credentials.map((credential) => (
                      <Badge key={credential} variant="secondary" className="bg-slate-100 text-slate-700">
                        {credential}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <a
                      href={PUBLIC_LAUNCH_CONTACT.linkedInUrl}
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                      LinkedIn
                    </a>
                    <a href={`mailto:${PUBLIC_LAUNCH_CONTACT.primaryEmail}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                      {PUBLIC_LAUNCH_CONTACT.primaryEmail}
                    </a>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-[0_20px_40px_rgba(15,23,42,0.12)]">
              <CardHeader className="gap-2 px-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Why buyers trust it</p>
                <h2 className="font-display text-2xl font-semibold">{PUBLIC_LAUNCH_PROOF_ASSET.title}</h2>
              </CardHeader>
              <CardContent className="space-y-3 px-0">
                <p className="text-sm leading-7 text-slate-200">{PUBLIC_LAUNCH_PROOF_ASSET.summary}</p>
                {PUBLIC_LAUNCH_PROOF_ASSET.highlights.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-none md:p-8">
          <CardHeader className="gap-2 px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Flagship offer</p>
            <h2 className="font-display text-3xl font-semibold text-slate-950">
              Architecture review first. Remediation when the next step is obvious.
            </h2>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <p className="text-sm leading-7 text-slate-600 md:text-base">
              ZoKorp is built for teams that need a serious technical review, a practical remediation path, and a
              founder-led conversation when the work is worth doing. The first offer is intentionally narrow and
              useful: architecture review, scope, and follow-through.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CONSULTING_OFFERS.slice(0, 3).map((offer) => (
                <div key={offer.slug} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{offer.eyebrow}</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">{offer.title}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-700">{offer.priceAnchor}</p>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="px-0">
            <Link href="/services" className={buttonVariants()}>
              View services
            </Link>
          </CardFooter>
        </Card>

        <Card className="rounded-[1.8rem] border border-slate-200 bg-[#111827] p-6 text-slate-50 shadow-none md:p-8">
          <CardHeader className="gap-2 px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Public pricing posture</p>
            <h2 className="font-display text-3xl font-semibold">Visible anchors without pretending every job is fixed-scope.</h2>
          </CardHeader>
          <CardContent className="space-y-3 px-0">
            {CONSULTING_OFFERS.map((offer) => (
              <div key={offer.slug} className="flex flex-col gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-100">{offer.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{offer.summary}</p>
                </div>
                <p className="text-sm font-semibold text-white sm:max-w-[13rem] sm:text-right">{offer.priceAnchor}</p>
              </div>
            ))}
          </CardContent>
          <CardFooter className="px-0">
            <Link href="/pricing" className={cn(buttonVariants({ variant: "secondary" }), "bg-white text-slate-950 hover:bg-slate-100")}>
              Review pricing
            </Link>
          </CardFooter>
        </Card>
      </section>

      <section className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-none md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Services</p>
            <h2 className="font-display text-3xl font-semibold text-slate-950">A focused consulting catalog, not a vague list of buzzwords.</h2>
          </div>
          <a href={bookingUrl} className={buttonVariants({ variant: "secondary" })}>
            Book a call
          </a>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {CONSULTING_OFFERS.map((offer) => (
            <Card key={offer.slug} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 shadow-none">
              <CardHeader className="gap-2 px-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{offer.eyebrow}</p>
                <h3 className="font-display text-2xl font-semibold text-slate-950">{offer.title}</h3>
                <p className="text-sm font-medium text-slate-700">{offer.priceAnchor}</p>
              </CardHeader>
              <CardContent className="space-y-3 px-0">
                <p className="text-sm leading-7 text-slate-600">{offer.summary}</p>
                <ul className="space-y-2 text-sm text-slate-700">
                  {offer.bullets.map((bullet) => (
                    <li key={bullet} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[1.8rem] border border-slate-200 bg-[#f7f5f1] p-6 shadow-none md:p-8">
          <CardHeader className="gap-2 px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Software</p>
            <h2 className="font-display text-3xl font-semibold text-slate-950">Software stays visible, but it does not replace the consulting story.</h2>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <p className="text-sm leading-7 text-slate-600 md:text-base">
              The software side of ZoKorp is there to remove repetitive review work, not to hide the human operating
              model. Start with the public software catalog if you want a self-serve path before a call.
            </p>
            <div className="space-y-3">
              {SOFTWARE_HIGHLIGHTS.map((item) => (
                <div key={item.href} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
                    </div>
                    <Link href={item.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      {item.cta}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-none md:p-8">
          <CardHeader className="gap-2 px-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How engagements run</p>
            <h2 className="font-display text-3xl font-semibold text-slate-950">Clear process beats vague transformation language.</h2>
          </CardHeader>
          <CardContent className="grid gap-4 px-0 md:grid-cols-2">
            {DELIVERY_PROCESS_STEPS.map((step, index) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Step {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{step.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
