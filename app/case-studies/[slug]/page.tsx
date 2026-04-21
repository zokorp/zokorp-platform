import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CASE_STUDIES, getCaseStudy } from "@/lib/case-studies";
import { PUBLIC_LAUNCH_CONTACT } from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata } from "@/lib/site";

export const revalidate = 3600;

type PageParams = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return CASE_STUDIES.map((study) => ({ slug: study.slug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);

  if (!study) {
    return buildMarketingPageMetadata({
      title: "Case Study",
      description: "ZoKorp case study.",
      path: `/case-studies/${slug}`,
    });
  }

  return buildMarketingPageMetadata({
    title: study.title,
    description: study.summary,
    path: `/case-studies/${study.slug}`,
  });
}

export default async function CaseStudyDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const study = getCaseStudy(slug);

  if (!study) {
    notFound();
  }

  return (
    <div className="marketing-stack">
      <section className="hero-bleed hero-poster py-8 md:py-10 lg:py-12">
        <div className="marketing-container px-4 md:px-6 xl:px-8">
          <div
            data-surface="hero-copy"
            style={{ backgroundColor: "rgba(250, 252, 255, 0.96)" }}
            className="space-y-5 py-2 text-card-foreground lg:pr-10"
          >
            <Link
              href="/case-studies"
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
            >
              <span aria-hidden>←</span>
              All case studies
            </Link>
            <Badge
              variant="secondary"
              className="w-fit rounded-full bg-white/80 px-3.5 py-1.5 text-muted-foreground normal-case tracking-[0.18em]"
            >
              Case Study
            </Badge>
            <h1 className="font-display max-w-[22ch] text-balance text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.045em] text-card-foreground md:text-[3.4rem] lg:text-[3.8rem]">
              {study.title}
            </h1>
            <p className="max-w-[58ch] text-base leading-8 text-muted-foreground md:text-[1.05rem]">
              {study.summary}
            </p>
          </div>
        </div>
      </section>

      <section className="section-band px-5 py-6 md:px-6 md:py-7">
        <dl className="grid gap-6 md:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)] md:gap-x-10">
          <dt className="enterprise-kicker pt-1">Context</dt>
          <dd className="max-w-[58ch] text-base leading-8 text-card-foreground border-t border-border/70 pt-3 md:border-none md:pt-0">
            {study.context}
          </dd>

          <dt className="enterprise-kicker border-t border-border/70 pt-6 md:pt-8">Challenge</dt>
          <dd className="max-w-[58ch] border-t border-border/70 pt-3 text-base leading-8 text-card-foreground md:pt-8">
            {study.challenge}
          </dd>

          <dt className="enterprise-kicker border-t border-border/70 pt-6 md:pt-8">Approach</dt>
          <dd className="max-w-[58ch] border-t border-border/70 pt-3 text-base leading-8 text-card-foreground md:pt-8">
            {study.approach}
          </dd>

          <dt className="enterprise-kicker border-t border-border/70 pt-6 md:pt-8">Outcome</dt>
          <dd className="max-w-[58ch] border-t border-border/70 pt-3 md:pt-8">
            <p className="text-base font-semibold leading-8 text-card-foreground">
              {study.outcome}
            </p>
          </dd>

          <dt className="enterprise-kicker border-t border-border/70 pt-6 md:pt-8">Technologies</dt>
          <dd className="border-t border-border/70 pt-3 md:pt-8">
            <ul className="flex flex-wrap gap-2">
              {study.technologies.map((tech) => (
                <li key={tech}>
                  <Badge variant="secondary" className="normal-case tracking-normal">
                    {tech}
                  </Badge>
                </li>
              ))}
            </ul>
          </dd>
        </dl>
      </section>

      <section className="section-band px-5 py-6 md:px-6 md:py-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-8">
          <div className="space-y-2">
            <p className="enterprise-kicker">Apply this</p>
            <p className="font-display text-[1.6rem] font-semibold leading-[1.02] text-card-foreground md:text-[1.95rem]">
              See how this applies to your situation.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm leading-7 text-muted-foreground">
              Start with a $249 Architecture Review or book a 15-minute fit check.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/services#architecture-review" className={buttonVariants()}>
                Start with an Architecture Review — $249
              </Link>
              <a
                href={PUBLIC_LAUNCH_CONTACT.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "secondary" })}
              >
                Book a fit check
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
