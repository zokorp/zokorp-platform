import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { CaseStudy } from "@/lib/case-studies";

type CaseStudyCardProps = {
  study: CaseStudy;
};

export function CaseStudyCard({ study }: CaseStudyCardProps) {
  return (
    <article className="group relative flex h-full flex-col gap-5 rounded-[calc(var(--radius-panel-lg)-0.1rem)] border border-border bg-gradient-to-b from-white/92 to-[rgba(245,249,253,0.96)] p-6 shadow-[var(--shadow-card)] transition-colors duration-300 hover:border-brand/40 md:p-7">
      <div className="space-y-3">
        <p className="enterprise-kicker">{study.role}</p>
        <h2 className="font-display text-[1.35rem] font-semibold leading-[1.15] tracking-[-0.02em] text-card-foreground transition-colors duration-300 group-hover:text-brand md:text-[1.5rem]">
          <Link href={`/case-studies/${study.slug}`} className="outline-none before:absolute before:inset-0 before:content-['']">
            {study.title}
          </Link>
        </h2>
      </div>

      <p className="font-display text-[1.75rem] font-semibold leading-[1.05] tracking-[-0.025em] text-card-foreground md:text-[2rem]">
        {study.outcomeStat}
      </p>

      <p className="text-sm leading-7 text-muted-foreground">{study.summary}</p>

      <ul className="flex flex-wrap gap-2">
        {study.tags.map((tag) => (
          <li key={tag}>
            <Badge variant="secondary" className="normal-case tracking-normal">
              {tag}
            </Badge>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-4 text-sm">
        <span className="text-muted-foreground">{study.duration}</span>
        <span className="relative z-10 font-semibold text-brand transition-transform duration-300 group-hover:translate-x-0.5">
          Read case study →
        </span>
      </div>
    </article>
  );
}
