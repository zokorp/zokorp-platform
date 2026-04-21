import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PrivacyStanceProps = {
  eyebrow?: string;
  title?: string;
  className?: string;
  children?: ReactNode;
};

export const PRIVACY_STANCE_POINTS: readonly {
  heading: string;
  body: string;
}[] = [
  {
    heading: "Your data stays yours",
    body: "Diagrams, architecture details, and validation inputs are not sold, not repackaged, and not used to train outside models. Results go to the signed-in verified email on each run and nowhere else.",
  },
  {
    heading: "Each tool is isolated",
    body: "Architecture Reviewer, ZoKorpValidator, and Forecasting Beta each live in their own tree. A change to one cannot silently alter another. The isolation contract is documented and enforced by tests.",
  },
  {
    heading: "Priced to keep the lights on",
    body: "The free diagnostic stays free. Paid tiers exist to cover compute and delivery cost, not to squeeze a captive customer. If a free run is enough, that is the right answer.",
  },
  {
    heading: "Small practice, on purpose",
    body: "ZoKorp is one founder, direct delivery, no account managers. That is what lets the promises above stay literal — there is no second layer of incentives pulling against them.",
  },
] as const;

export function PrivacyStance({
  eyebrow = "Why I built this",
  title = "In your corner. Not the highest bidder.",
  className,
  children,
}: PrivacyStanceProps) {
  return (
    <section
      className={cn(
        "section-band px-5 py-6 md:px-6 md:py-8",
        className,
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-start lg:gap-10">
        <div className="space-y-3">
          <p className="enterprise-kicker">{eyebrow}</p>
          <h2 className="font-display max-w-[14ch] text-[1.9rem] font-semibold leading-[0.98] tracking-[-0.035em] text-card-foreground md:text-[2.35rem]">
            {title}
          </h2>
          <p className="max-w-[40ch] text-sm leading-7 text-muted-foreground">
            I build this software because I would trust it on my own
            clients&apos; work. Everything below is a stance, not marketing.
          </p>
          {children ? <div className="pt-2">{children}</div> : null}
        </div>

        <dl className="grid gap-5 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
          {PRIVACY_STANCE_POINTS.map((point) => (
            <div
              key={point.heading}
              className="space-y-2 border-t border-border/70 pt-4"
            >
              <dt className="text-[0.98rem] font-semibold leading-6 tracking-[-0.015em] text-card-foreground">
                {point.heading}
              </dt>
              <dd className="text-sm leading-7 text-muted-foreground">
                {point.body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
