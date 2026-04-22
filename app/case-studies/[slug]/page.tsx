import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CASE_STUDIES, getCaseStudy, type CaseStudy } from "@/lib/case-studies";
import { PUBLIC_LAUNCH_CONTACT } from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata, getMarketingSiteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

type PageParams = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return CASE_STUDIES.map((study) => ({ slug: study.slug }));
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);

  if (!study) {
    return buildMarketingPageMetadata({
      title: "Case Studies",
      description: "ZoKorp case studies.",
      path: "/case-studies",
    });
  }

  return buildMarketingPageMetadata({
    title: study.title,
    description: study.outcomeHeadline,
    path: `/case-studies/${study.slug}`,
    type: "article",
  });
}

export default async function CaseStudyDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const study = getCaseStudy(slug);

  if (!study) {
    notFound();
  }

  const canonicalUrl = new URL(`/case-studies/${study.slug}`, getMarketingSiteUrl()).toString();
  const pdfUrl = new URL(study.pdfPath, getMarketingSiteUrl()).toString();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: study.title,
    description: study.outcomeHeadline,
    articleSection: "Case Studies",
    keywords: study.tags.join(", "),
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    author: {
      "@type": "Organization",
      name: "ZoKorp",
      url: getMarketingSiteUrl(),
    },
    publisher: {
      "@type": "Organization",
      name: "ZoKorp",
      url: getMarketingSiteUrl(),
    },
    about: study.technologies,
  } as const;

  return (
    <div className="marketing-stack">
      <script
        type="application/ld+json"
        // JSON-LD; controlled object, not user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="-mb-4 text-sm">
        <Link
          href="/case-studies"
          className="text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-brand"
        >
          ← All case studies
        </Link>
      </nav>

      <Reveal as="section" variant="copy" className="space-y-6">
        <header className="space-y-5">
          <div className="space-y-2">
            <p className="enterprise-kicker">{study.role}</p>
            <h1 className="font-display max-w-[22ch] text-balance text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.035em] text-card-foreground md:text-[3.25rem]">
              {study.title}
            </h1>
          </div>

          <p className="max-w-[62ch] text-base leading-7 text-muted-foreground md:text-[1.05rem]">
            {study.outcomeHeadline}
          </p>

          <dl className="grid grid-cols-2 gap-4 border-t border-border/70 pt-5 sm:grid-cols-4 sm:gap-6">
            <StatBlock label="Duration" value={study.duration} />
            {study.result.metrics.slice(0, 3).map((metric) => (
              <StatBlock key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </dl>

          <ul className="flex flex-wrap gap-2">
            {study.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="secondary" className="normal-case tracking-normal">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        </header>
      </Reveal>

      <Reveal variant="copy">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
          <article className="space-y-10">
            <BodySection eyebrow="The Setup" title="Where the work started">
              {study.situation.map((paragraph, i) => (
                <p key={i} className="max-w-[68ch] text-base leading-8 text-card-foreground">
                  {paragraph}
                </p>
              ))}
              <div className="space-y-3 border-t border-border/70 pt-5">
                <p className="enterprise-kicker">What had to be true</p>
                <ul className="max-w-[68ch] space-y-3 text-base leading-8 text-card-foreground">
                  {study.task.map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-brand" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </BodySection>

            <BodySection eyebrow="What I Did" title="The architecture">
              <p className="max-w-[68ch] text-base leading-8 text-card-foreground">
                {study.action.intro}
              </p>
              <ol className="grid gap-4 md:grid-cols-2 md:gap-5">
                {study.action.moves.map((move, i) => (
                  <li
                    key={move.heading}
                    className="space-y-2 rounded-[1.35rem] border border-border bg-white/80 p-5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
                  >
                    <p className="table-kicker">{`0${i + 1}`}</p>
                    <p className="text-[0.98rem] font-semibold leading-6 tracking-[-0.015em] text-card-foreground">
                      {move.heading}
                    </p>
                    <p className="text-sm leading-7 text-muted-foreground">{move.detail}</p>
                  </li>
                ))}
              </ol>
            </BodySection>

            <BodySection eyebrow="Outcome" title="What actually happened">
              <p className="max-w-[68ch] rounded-[1.35rem] border border-brand/30 bg-[rgba(27,84,242,0.06)] px-5 py-4 text-base font-semibold leading-8 text-card-foreground">
                {study.result.primary}
              </p>
              <dl className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {study.result.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="space-y-1 border-t border-border/70 pt-3"
                  >
                    <dt className="font-display text-[1.25rem] font-semibold leading-[1.02] tracking-[-0.025em] text-card-foreground md:text-[1.45rem]">
                      {metric.value}
                    </dt>
                    <dd className="text-xs leading-5 text-muted-foreground md:text-[0.8rem]">
                      {metric.label}
                    </dd>
                  </div>
                ))}
              </dl>
              <ul className="max-w-[68ch] space-y-3 text-sm leading-7 text-card-foreground">
                {study.result.secondary.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[rgb(var(--z-ink-label))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </BodySection>

            <BodySection eyebrow="Why it matters" title="The parts another team can take">
              <ul className="max-w-[68ch] space-y-3 text-base leading-8 text-card-foreground">
                {study.portable.map((item, i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-[rgb(var(--z-accent))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </BodySection>

            <section className="space-y-3 border-t border-border/70 pt-5">
              <p className="enterprise-kicker">Stack</p>
              <ul className="flex flex-wrap gap-2">
                {study.technologies.map((tech) => (
                  <li key={tech}>
                    <Badge variant="secondary" className="normal-case tracking-normal">
                      {tech}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <DetailSidebarCard study={study} pdfUrl={pdfUrl} />
          </aside>
        </div>
      </Reveal>

      <Reveal variant="copy">
        <section className="section-band px-5 py-6 md:px-6 md:py-7">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-8">
            <div className="space-y-2">
              <p className="enterprise-kicker">Next step</p>
              <p className="font-display text-[1.6rem] font-semibold leading-[1.02] text-card-foreground md:text-[1.95rem]">
                Want a similar read on your stack?
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm leading-7 text-muted-foreground">
                Start with a $249 Architecture Review, or book a 30-min discovery call for larger scope.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/services#architecture-review" className={buttonVariants()}>
                  Book a $249 Architecture Review
                </Link>
                <a
                  href={PUBLIC_LAUNCH_CONTACT.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "secondary" })}
                >
                  Book a 30-min discovery call
                </a>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <p className="text-xs leading-6 text-muted-foreground">
        Public summary. Client-confidential specifics are not published. Figures reflect the
        engagement outcome as delivered.
      </p>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="table-kicker">{label}</dt>
      <dd className="font-display text-[1.25rem] font-semibold leading-[1.02] tracking-[-0.025em] text-card-foreground md:text-[1.45rem]">
        {value}
      </dd>
    </div>
  );
}

function BodySection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="enterprise-kicker">{eyebrow}</p>
        <h2 className="font-display text-[1.35rem] font-semibold leading-[1.15] tracking-[-0.02em] text-card-foreground md:text-[1.5rem]">
          {title}
        </h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function DetailSidebarCard({ study, pdfUrl }: { study: CaseStudy; pdfUrl: string }) {
  return (
    <div className="rounded-[calc(var(--radius-panel-lg)-0.1rem)] border border-border bg-gradient-to-b from-white/92 to-[rgba(245,249,253,0.96)] p-5 shadow-[var(--shadow-card)] md:p-6">
      <p className="enterprise-kicker">At a glance</p>
      <dl className="mt-3 space-y-3 border-t border-border/70 pt-3">
        <div className="space-y-1">
          <dt className="table-kicker">Industry</dt>
          <dd className="text-sm leading-6 text-card-foreground">{study.glance.industry}</dd>
        </div>
        <div className="space-y-1">
          <dt className="table-kicker">Timeframe</dt>
          <dd className="text-sm leading-6 text-card-foreground">{study.glance.timeframe}</dd>
        </div>
        <div className="space-y-1">
          <dt className="table-kicker">Environment</dt>
          <dd className="text-sm leading-6 text-card-foreground">{study.glance.environment}</dd>
        </div>
      </dl>
      <div className="mt-5 border-t border-border/70 pt-4">
        <p className="enterprise-kicker">PDF</p>
        <a
          href={pdfUrl}
          className={cn(buttonVariants({ size: "sm", fullWidth: true }), "mt-3")}
          target="_blank"
          rel="noreferrer"
        >
          Download the PDF version
        </a>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The same case study in printable format.
        </p>
      </div>
    </div>
  );
}
