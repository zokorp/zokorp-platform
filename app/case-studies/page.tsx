import type { Metadata } from "next";
import Link from "next/link";

import { CaseStudyAccordion } from "@/components/marketing/case-study-accordion";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingSectionHeading } from "@/components/marketing/section-heading";
import { buttonVariants } from "@/components/ui/button";
import { CASE_STUDIES } from "@/lib/case-studies";
import { PUBLIC_LAUNCH_CONTACT } from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildMarketingPageMetadata({
  title: "Case Studies",
  description:
    "STAR-format case studies from ZoKorp's founder background — AI infrastructure, Well-Architected delivery, and production LLMOps. Public summaries, client-confidential details redacted.",
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
          description="Public summaries of prior engagements, written in STAR format. Outcomes are quantified. Client-confidential specifics are not published."
          titleAs="h1"
        />

        <Reveal variant="copy">
          <CaseStudyAccordion
            studies={CASE_STUDIES}
            bookingUrl={PUBLIC_LAUNCH_CONTACT.bookingUrl}
          />
        </Reveal>
      </section>

      <Reveal variant="copy">
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
                Start with a $249 Architecture Review, or book a 30-min discovery call for larger scope.
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
                  Book a 30-min discovery call
                </a>
              </div>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
