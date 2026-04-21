import type { Metadata } from "next";

import { FounderProofBlock } from "@/components/marketing/founder-proof-block";
import { MarketingSectionHeading } from "@/components/marketing/section-heading";
import { ServiceRequestPanel } from "@/components/service-request-panel";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { CONTACT_PAGE_CONTENT } from "@/lib/marketing-content";
import { FOUNDER_PROOF_PAGE_CONTENT } from "@/lib/marketing-proof";
import { PUBLIC_LAUNCH_CONTACT } from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata } from "@/lib/site";

export const metadata: Metadata = buildMarketingPageMetadata({
  title: "Contact",
  description: "Public requests go to consulting@zokorp.com. Initial response within one business day.",
  path: "/contact",
});

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const session = await auth();

  return (
    <div className="marketing-stack">
      <section className="space-y-6">
        <MarketingSectionHeading
          eyebrow={CONTACT_PAGE_CONTENT.eyebrow}
          title={CONTACT_PAGE_CONTENT.title}
          description={CONTACT_PAGE_CONTENT.lede}
          titleAs="h1"
        />

        <div className="section-band px-5 py-5 md:px-6 md:py-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center lg:gap-8">
            <div className="space-y-2">
              <p className="enterprise-kicker">Fastest path</p>
              <p className="font-display text-[1.6rem] font-semibold leading-[1.02] text-card-foreground md:text-[1.95rem]">
                Book a 15-minute fit check.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm leading-7 text-muted-foreground">
                Pick a time directly on the calendar. No form, no back-and-forth.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={PUBLIC_LAUNCH_CONTACT.bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ size: "lg" })}
                >
                  Book now
                </a>
                <a
                  href={`mailto:${PUBLIC_LAUNCH_CONTACT.primaryEmail}`}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  Email direct
                </a>
              </div>
            </div>
          </div>
        </div>

        <FounderProofBlock
          mode="micro"
          statement={FOUNDER_PROOF_PAGE_CONTENT.contact.statement}
        />

        <ServiceRequestPanel
          signedIn={Boolean(session?.user?.email)}
          currentEmail={session?.user?.email ?? null}
          loginHref="/login?callbackUrl=/contact"
          registerHref="/register"
          accountHref="/account"
        />
      </section>
    </div>
  );
}
