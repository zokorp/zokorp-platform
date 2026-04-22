"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { CaseStudy } from "@/lib/case-studies";
import { cn } from "@/lib/utils";

type CaseStudyAccordionProps = {
  studies: readonly CaseStudy[];
  bookingUrl: string;
};

function readSlugFromHash(studies: readonly CaseStudy[]): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace("#", "");
  if (!hash) return null;
  return studies.some((study) => study.slug === hash) ? hash : null;
}

export function CaseStudyAccordion({
  studies,
  bookingUrl,
}: CaseStudyAccordionProps) {
  const [openSlug, setOpenSlug] = useState<string | null>(() =>
    readSlugFromHash(studies),
  );
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Scroll to the currently open item on first render if it was opened via hash.
  useEffect(() => {
    if (!openSlug) return;
    const node = itemRefs.current[openSlug];
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    // Intentionally run only on mount — subsequent opens handle their own scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respond to external hash changes (back/forward, direct #anchor nav).
  useEffect(() => {
    const handleHashChange = () => {
      const nextSlug = readSlugFromHash(studies);
      setOpenSlug(nextSlug);
      if (!nextSlug) return;
      window.requestAnimationFrame(() => {
        const node = itemRefs.current[nextSlug];
        node?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [studies]);

  // Sync hash when the open panel changes (side-effect, not in the updater).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextHash = openSlug ? `#${openSlug}` : "";
    if (nextHash !== window.location.hash) {
      history.replaceState(null, "", nextHash || window.location.pathname);
    }
  }, [openSlug]);

  const toggle = (slug: string) => {
    setOpenSlug((current) => (current === slug ? null : slug));
  };

  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-[calc(var(--radius-panel-lg)-0.1rem)] border border-border bg-gradient-to-b from-white/90 to-[rgba(245,249,253,0.96)] shadow-[var(--shadow-card)]">
      {studies.map((study, index) => {
        const isOpen = openSlug === study.slug;
        const panelId = `case-study-panel-${study.slug}`;
        const buttonId = `case-study-trigger-${study.slug}`;

        return (
          <div
            key={study.slug}
            id={study.slug}
            ref={(node) => {
              itemRefs.current[study.slug] = node;
            }}
            className={cn(
              "accordion-item scroll-mt-28 transition-colors duration-500",
              isOpen && "accordion-item--open bg-[rgba(250,252,255,0.65)]",
            )}
          >
            <h3 className="m-0">
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(study.slug)}
                className="accordion-trigger group block w-full cursor-pointer px-5 py-6 text-left md:px-8 md:py-7"
              >
                <div className="grid gap-5 md:grid-cols-[6ch_minmax(0,1fr)_auto] md:items-center md:gap-8">
                  <span className="table-kicker">{`0${index + 1}`}</span>
                  <span className="block space-y-2">
                    <span className="font-display block max-w-[52ch] text-[1.35rem] font-semibold leading-[1.15] tracking-[-0.02em] text-card-foreground transition-colors duration-300 group-hover:text-brand md:text-[1.55rem]">
                      {study.title}
                    </span>
                    <span className="block max-w-[70ch] text-sm leading-7 text-muted-foreground">
                      {study.summary}
                    </span>
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--z-ink-label))]">
                      {study.outcomeStat}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "accordion-icon inline-flex size-10 items-center justify-center rounded-full border border-border bg-white text-lg font-semibold text-muted-foreground",
                      isOpen && "accordion-icon--open border-brand text-brand",
                    )}
                  >
                    +
                  </span>
                </div>
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="accordion-panel"
              data-state={isOpen ? "open" : "closed"}
            >
              <div className="accordion-panel__inner">
                <div className="space-y-8 border-t border-border/70 px-5 py-8 md:px-8 md:py-10">
                  <GlancePanel study={study} />

                  <StarSection eyebrow="Situation" title="Where the work started">
                    {study.situation.map((paragraph, i) => (
                      <p key={i} className="max-w-[68ch] text-base leading-8 text-card-foreground">
                        {paragraph}
                      </p>
                    ))}
                  </StarSection>

                  <StarSection eyebrow="Task" title="What had to be true at the end">
                    <ul className="max-w-[68ch] space-y-3 text-base leading-8 text-card-foreground">
                      {study.task.map((item, i) => (
                        <li key={i} className="flex gap-3">
                          <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-brand" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </StarSection>

                  <StarSection eyebrow="Action" title="How we delivered it">
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
                  </StarSection>

                  <StarSection eyebrow="Result" title="What actually happened">
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
                  </StarSection>

                  <StarSection eyebrow="What's portable" title="The parts another team can take">
                    <ul className="max-w-[68ch] space-y-3 text-sm leading-7 text-card-foreground">
                      {study.portable.map((item, i) => (
                        <li key={i} className="flex gap-3">
                          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[rgb(var(--z-accent))]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </StarSection>

                  <StackRow technologies={study.technologies} />

                  <div className="border-t border-border/70 pt-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="max-w-[52ch] text-xs leading-6 text-muted-foreground">
                        Public summary. Client-confidential specifics are not published. Figures reflect the
                        engagement outcome as delivered.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href="/services#architecture-review"
                          className={buttonVariants({ size: "md" })}
                        >
                          Start an Architecture Review — $249
                        </Link>
                        <a
                          href={bookingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "secondary", size: "md" })}
                        >
                          Book a 30-min discovery call
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GlancePanel({ study }: { study: CaseStudy }) {
  const rows: { label: string; value: string }[] = [
    { label: "Industry", value: study.glance.industry },
    { label: "Timeframe", value: study.glance.timeframe },
    { label: "Environment", value: study.glance.environment },
  ];

  return (
    <section className="rounded-[1.5rem] border border-border bg-white/80 p-5 md:p-6">
      <p className="enterprise-kicker">At a glance</p>
      <dl className="mt-4 grid gap-4 md:grid-cols-3 md:gap-6">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1 border-t border-border/70 pt-3">
            <dt className="table-kicker">{row.label}</dt>
            <dd className="text-sm leading-7 text-card-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function StarSection({
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
        <h4 className="font-display text-[1.25rem] font-semibold leading-[1.15] tracking-[-0.02em] text-card-foreground md:text-[1.35rem]">
          {title}
        </h4>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function StackRow({ technologies }: { technologies: readonly string[] }) {
  return (
    <section className="space-y-3">
      <p className="enterprise-kicker">Stack</p>
      <ul className="flex flex-wrap gap-2">
        {technologies.map((tech) => (
          <li key={tech}>
            <Badge variant="secondary" className="normal-case tracking-normal">
              {tech}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
