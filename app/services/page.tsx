import type { CSSProperties } from "react";
import Link from "next/link";

import { FounderProofBlock } from "@/components/marketing/founder-proof-block";
import { LearnMore } from "@/components/marketing/learn-more";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { MarketingSectionHeading } from "@/components/marketing/section-heading";
import { ServiceOfferRow } from "@/components/marketing/service-offer-row";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import {
  PRIMARY_CONSULTING_OFFERS,
  SECONDARY_CONSULTING_OFFERS,
  SERVICES_INCLUDED_ITEMS,
  SERVICES_PAGE_CONTENT,
  SPECIALIST_ADVISORY,
} from "@/lib/marketing-content";
import { FOUNDER_PROOF_PAGE_CONTENT } from "@/lib/marketing-proof";
import { getConsultationCta } from "@/lib/marketing-cta";
import { PUBLIC_LAUNCH_CONTACT, PUBLIC_LAUNCH_POLICY_NOTES } from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata } from "@/lib/site";

export const metadata = buildMarketingPageMetadata({
  title: "Services",
  description:
    "Scoped cloud reviews, cost work, setup, and advisory for SMB teams that need a clear next move.",
  path: "/services",
});

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.email);
  const primaryCta = getConsultationCta({
    signedIn,
    utmMedium: "services-page",
  });
  const followUpColumns = {
    "--table-columns": "minmax(0,0.82fr) minmax(0,1.08fr) auto",
  } as CSSProperties;
  const serviceTableColumns = {
    "--table-columns": "minmax(0,1.12fr) minmax(15rem,0.86fr) minmax(18rem,0.9fr) minmax(6.5rem,auto)",
  } as CSSProperties;

  return (
    <div className="marketing-stack">
      <MarketingHero
        mode="poster"
        eyebrow={SERVICES_PAGE_CONTENT.hero.eyebrow}
        title={SERVICES_PAGE_CONTENT.hero.title}
        lede={SERVICES_PAGE_CONTENT.hero.lede}
        supportingBullets={SERVICES_PAGE_CONTENT.hero.supportingBullets}
        primaryAction={primaryCta}
        secondaryAction={{ href: "/pricing", label: "See pricing", variant: "secondary" }}
        rail={
          <div className="grid gap-4">
            <section className="table-band rounded-[2rem] p-4 md:p-5">
              <div className="grid gap-3 text-sm text-card-foreground sm:grid-cols-3">
                <div className="border-t border-border/70 pt-3">
                  <p className="table-kicker">Starting points</p>
                  <p className="mt-2">4 scoped offers</p>
                </div>
                <div className="border-t border-border/70 pt-3">
                  <p className="table-kicker">Response</p>
                  <p className="mt-2">{PUBLIC_LAUNCH_CONTACT.responseWindowLabel}</p>
                </div>
                <div className="border-t border-border/70 pt-3">
                  <p className="table-kicker">Scope</p>
                  <p className="mt-2">Estimate first when broader delivery is still fuzzy.</p>
                </div>
              </div>
            </section>
          </div>
        }
      />

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Primary services"
          title={SERVICES_PAGE_CONTENT.primaryTitle}
          description={SERVICES_PAGE_CONTENT.primaryIntro}
        />

        <p className="max-w-[58ch] text-sm leading-7 text-card-foreground">
          Not sure where to start? The{" "}
          <Link
            href="#architecture-review"
            className="underline decoration-border underline-offset-4 transition hover:text-brand"
          >
            Architecture Review ($249)
          </Link>{" "}
          is designed to answer exactly that.
        </p>

        <div className="table-band px-5 py-5 md:px-6" style={serviceTableColumns}>
          <div className="table-head">
            <span>Offer</span>
            <span>Best for</span>
            <span>What you get</span>
            <span className="text-right">Price</span>
          </div>
          {PRIMARY_CONSULTING_OFFERS.map((service, index) => (
            <ServiceOfferRow
              key={service.slug}
              id={service.slug}
              eyebrow={service.eyebrow}
              title={service.title}
              priceAnchor={service.priceAnchor}
              summary={service.summary}
              bullets={service.bullets}
              included={service.included}
              index={index + 1}
            />
          ))}
        </div>
      </section>

      <FounderProofBlock
        mode="section"
        eyebrow={FOUNDER_PROOF_PAGE_CONTENT.services.eyebrow}
        title={FOUNDER_PROOF_PAGE_CONTENT.services.title}
        support={FOUNDER_PROOF_PAGE_CONTENT.services.support}
        statement={FOUNDER_PROOF_PAGE_CONTENT.services.statement}
      >
        <div className="grid gap-5 md:grid-cols-2 md:gap-x-8">
          {FOUNDER_PROOF_PAGE_CONTENT.services.benefits.map((benefit) => (
            <article key={benefit.title} className="space-y-2 border-t border-border/70 pt-4 first:pt-4">
              <p className="table-kicker">{benefit.title}</p>
              <p className="text-sm leading-7 text-card-foreground">{benefit.detail}</p>
            </article>
          ))}
        </div>
      </FounderProofBlock>

      <LearnMore
        title={SERVICES_PAGE_CONTENT.secondaryTitle}
        summary={SERVICES_PAGE_CONTENT.secondarySummary}
      >
        <div className="table-band px-5 py-5 md:px-6" style={serviceTableColumns}>
          <div className="table-head">
            <span>Offer</span>
            <span>Best for</span>
            <span>What you get</span>
            <span className="text-right">Price</span>
          </div>
          {SECONDARY_CONSULTING_OFFERS.map((service, index) => (
            <ServiceOfferRow
              key={service.slug}
              id={service.slug}
              eyebrow={service.eyebrow}
              title={service.title}
              priceAnchor={service.priceAnchor}
              summary={service.summary}
              bullets={service.bullets}
              included={service.included}
              index={index + 1}
            />
          ))}

            <article className="table-row">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <p className="table-kicker">Note</p>
                <p className="enterprise-kicker">Secondary only</p>
              </div>
              <h3 className="font-display max-w-[12ch] text-[1.95rem] font-semibold leading-[1.02] text-card-foreground">
                {SPECIALIST_ADVISORY.title}
              </h3>
              <p className="max-w-[32ch] text-sm leading-7 text-muted-foreground">{SPECIALIST_ADVISORY.summary}</p>
            </div>

              <div className="space-y-3">
                <p className="table-cell-label">Best for</p>
                <ul className="table-list">
                  {SPECIALIST_ADVISORY.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="table-cell-panel space-y-3">
                <p className="table-cell-label">Pricing posture</p>
                <p className="text-sm leading-7 text-card-foreground">{PUBLIC_LAUNCH_POLICY_NOTES.services}</p>
              </div>

              <div className="flex items-start lg:justify-end">
                <span className="metric-chip">{SPECIALIST_ADVISORY.priceAnchor}</span>
            </div>
          </article>
        </div>
      </LearnMore>

      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow="Standards"
          title="What's included in every engagement."
          description="The same delivery floor applies to a $249 review and a multi-week landing zone."
        />

        <div className="section-band px-5 py-6 md:px-6 md:py-7">
          <dl className="grid gap-5 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
            {SERVICES_INCLUDED_ITEMS.map((item) => (
              <div
                key={item.label}
                className="space-y-2 border-t border-border/70 pt-4"
              >
                <dt className="text-[0.98rem] font-semibold leading-6 tracking-[-0.015em] text-card-foreground">
                  {item.label}
                </dt>
                <dd className="text-sm leading-7 text-muted-foreground">{item.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="table-band px-5 py-5 md:px-6">
        <div className="table-row" style={followUpColumns}>
          <div className="space-y-3">
            <p className="enterprise-kicker">{SERVICES_PAGE_CONTENT.requestTitle}</p>
            <h2 className="font-display max-w-[12ch] text-[1.85rem] font-semibold leading-[1.02] text-card-foreground md:text-[2.1rem]">
              {SERVICES_PAGE_CONTENT.requestIntro}
            </h2>
          </div>

          <div className="space-y-3">
            <p className="text-sm leading-7 text-muted-foreground">
              Public requests go through the contact form. Signed-in users can still move straight to a booked call.
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              {PUBLIC_LAUNCH_POLICY_NOTES.services}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/contact" className={buttonVariants()}>
              Request a call
            </Link>
            <a
              href={`mailto:${PUBLIC_LAUNCH_CONTACT.primaryEmail}`}
              className={buttonVariants({ variant: "secondary" })}
              target="_blank"
              rel="noreferrer"
            >
              Email ZoKorp
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
