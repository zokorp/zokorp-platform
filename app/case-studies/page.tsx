import type { Metadata } from "next";
import Link from "next/link";

import { MarketingSectionHeading } from "@/components/marketing/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { CASE_STUDIES } from "@/lib/case-studies";
import { PUBLIC_LAUNCH_CONTACT } from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildMarketingPageMetadata({
  title: "Case Studies",
  description:
    "Sanitized case studies from ZoKorp's founder background — AI infrastructure, Well-Architected delivery, and production LLMOps.",
  path: "/case-studies",
});

export const revalidate = 3600;

export default function CaseStudiesPage() {
  return (
    <div className="marketing-stack">
      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Case Studies"
          title="Selected work, sanitized."
          description="Public summaries of prior engagements. Outcomes are quantified, client-confidential details are not published."
          titleAs="h1"
        />

        <div className="section-band px-5 py-6 md:px-6 md:py-7">
          <ul className="divide-y divide-border/70">
            {CASE_STUDIES.map((study, index) => (
              <li key={study.slug} className="grid gap-4 py-6 md:grid-cols-[6ch_minmax(0,1fr)_auto] md:items-center md:gap-6">
                <p className="table-kicker">{`0${index + 1}`}</p>
                <div className="space-y-2">
                  <Link
                    href={`/case-studies/${study.slug}`}
                    className="font-display block max-w-[36ch] text-[1.35rem] font-semibold leading-[1.15] tracking-[-0.02em] text-card-foreground transition hover:text-brand md:text-[1.55rem]"
                  >
                    {study.title}
                  </Link>
                  <p className="max-w-[60ch] text-sm leading-7 text-muted-foreground">
                    {study.summary}
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--z-ink-label))]">
                    {study.outcomeStat}
                  </p>
                </div>
                <Link
                  href={`/case-studies/${study.slug}`}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                >
                  Read study
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section-band px-5 py-6 md:px-6 md:py-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-8">
          <div className="space-y-2">
            <p className="enterprise-kicker">Next step</p>
            <p className="font-display text-[1.6rem] font-semibold leading-[1.02] text-card-foreground md:text-[1.95rem]">
              Work like this, applied to your situation.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm leading-7 text-muted-foreground">
              Start with a $249 Architecture Review or book a 15-minute fit check for larger scope.
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
