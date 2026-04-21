import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AboutReveal } from "@/components/marketing/about-reveal";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { getConsultationCta } from "@/lib/marketing-cta";
import { ABOUT_PAGE_CONTENT } from "@/lib/marketing-content";
import { FOUNDER_PROOF_PAGE_CONTENT } from "@/lib/marketing-proof";
import { PUBLIC_LAUNCH_CONTACT, PUBLIC_LAUNCH_FOUNDER_PROFILE } from "@/lib/public-launch-contract";
import { buildMarketingPageMetadata } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = buildMarketingPageMetadata({
  title: "About ZoKorp",
  description:
    "Founder-led cloud architecture and software for SMB teams that need direct technical judgment.",
  path: "/about",
});

export const dynamic = "force-dynamic";

const ABOUT_VIDEO_WATCH_URL =
  "https://youtu.be/bQvrHYfJgl8?si=NyWuv4OgzW0-SQad&t=1320&end=1581";
const ABOUT_VIDEO_EMBED_URL =
  "https://www.youtube-nocookie.com/embed/bQvrHYfJgl8?start=1320&end=1581&rel=0";

const ABOUT_PORTFOLIO_MEDIA = {
  hero: {
    src: "/about/talk-agent-stage.jpeg",
    alt: "Zohaib Khawaja presenting an AI agents talk on stage",
    eyebrow: "Speaking",
    title: "Public technical explanation.",
    caption: "The operating style is visible in the room, not hidden behind positioning.",
    imageClassName: "object-cover object-[center_54%]",
  },
  summit: {
    src: "/about/aws-summit-atrium.jpeg",
    alt: "Zohaib Khawaja at AWS Summit inside the venue atrium",
    eyebrow: "Fieldwork",
    title: "Enterprise context, smaller delivery.",
    caption: "The current scope stays small. The pattern recognition does not.",
    imageClassName: "object-cover object-center",
  },
  nvidia: {
    src: "/about/nvidia-ai-summit.jpeg",
    alt: "Zohaib Khawaja at NVIDIA AI Summit",
    eyebrow: "Events",
    title: "Signal over theater.",
    caption: "The point is grounded technical judgment, not trend chasing.",
    imageClassName: "object-cover object-[center_36%]",
  },
  panel: {
    src: "/about/panel-stage.jpeg",
    alt: "Zohaib Khawaja participating in a panel discussion on stage",
    eyebrow: "Panels",
    title: "Comfortable in higher-stakes rooms.",
    caption: "That experience shows up now as tighter scope and clearer follow-through.",
    imageClassName: "object-cover object-center",
  },
  workshop: {
    src: "/about/strongdm-aws-workshop.jpeg",
    alt: "StrongDM and AWS workshop poster featuring Zohaib Khawaja",
    eyebrow: "Workshop",
    title: "Hands-on sessions, not abstract positioning.",
    caption: "Partner-facing technical delivery under public brand standards.",
  },
  hcc: {
    src: "/about/hcc-photo.jpeg",
    alt: "Zohaib Khawaja at Houston Community College with event participants",
    eyebrow: "Community",
    title: "Public-facing education work.",
    caption: "Clarity matters more when the room is mixed and the audience is live.",
    imageClassName: "object-cover object-[center_34%]",
  },
  cloudathon: {
    src: "/about/cloudathon-stage.jpeg",
    alt: "Zohaib Khawaja speaking to a Cloudathon at UH audience",
    eyebrow: "Teaching",
    title: "Direct workshop and stage work.",
    caption: "The same delivery style carries into reviews, scoping, and write-ups.",
    imageClassName: "object-cover object-center",
  },
} as const;

const ABOUT_FACTS = [
  {
    label: "Founder",
    value: PUBLIC_LAUNCH_FOUNDER_PROFILE.name,
  },
  {
    label: "Base",
    value: PUBLIC_LAUNCH_CONTACT.location,
  },
  {
    label: "Credential",
    value: PUBLIC_LAUNCH_FOUNDER_PROFILE.credentials[0],
  },
  {
    label: "Response",
    value: PUBLIC_LAUNCH_CONTACT.responseWindowLabel,
  },
] as const;

type AboutMediaRole = "heroCanvas" | "supportTile" | "editorialMedia" | "artifactPanel";

type AboutMediaCardProps = {
  role: AboutMediaRole;
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  caption: string;
  sizes: string;
  className?: string;
  imageClassName?: string;
  mediaClassName?: string;
  priority?: boolean;
  mediaMarker?: string;
};

function AboutMediaCard({
  role,
  src,
  alt,
  eyebrow,
  title,
  caption,
  sizes,
  className,
  imageClassName,
  mediaClassName,
  priority = false,
  mediaMarker,
}: AboutMediaCardProps) {
  if (role === "artifactPanel") {
    return (
      <figure
        data-about-media-card={mediaMarker}
        className={cn(
          "overflow-hidden rounded-[2.2rem] bg-white/88 ring-1 ring-slate-900/6 shadow-[0_22px_70px_rgba(8,31,61,0.12)] backdrop-blur-sm",
          className,
        )}
      >
        <div className={cn("relative aspect-[4/5] bg-white", mediaClassName)}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            loading="eager"
            className="object-contain p-5 md:p-6"
          />
        </div>
        <figcaption className="space-y-2 border-t border-slate-200/80 px-5 py-4 md:px-6 md:py-5">
          <p className="enterprise-kicker">{eyebrow}</p>
          <p className="max-w-[20ch] text-[1.02rem] font-semibold leading-[1.08] tracking-[-0.02em] text-card-foreground">
            {title}
          </p>
          <p className="text-sm leading-6 text-muted-foreground md:hidden">{caption}</p>
        </figcaption>
      </figure>
    );
  }

  if (role === "supportTile") {
    return (
      <figure
        data-about-media-card={mediaMarker}
        className={cn("group flex h-full flex-col space-y-2.5", className)}
      >
        <div
          className={cn(
            "relative h-full overflow-hidden rounded-[2.05rem] bg-slate-100 ring-1 ring-slate-900/6 shadow-[0_20px_64px_rgba(8,31,61,0.14)]",
            mediaClassName,
          )}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            loading="eager"
            className={cn(
              "object-cover transition duration-700 ease-[cubic-bezier(0.2,0.65,0.2,1)] group-hover:scale-[1.035]",
              imageClassName,
            )}
          />
          <div className="absolute left-4 top-4 rounded-full border border-white/35 bg-slate-950/68 px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            {eyebrow}
          </div>
          <div className="absolute inset-0 hidden bg-gradient-to-t from-slate-950/78 via-slate-950/10 to-transparent opacity-0 transition duration-300 group-hover:opacity-100 md:block" />
          <div className="absolute inset-x-0 bottom-0 hidden translate-y-3 px-4 pb-4 text-white opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:block">
            <div className="space-y-1 rounded-[1.3rem] border border-white/12 bg-slate-950/54 p-4 backdrop-blur-sm">
              <p className="text-sm font-semibold leading-[1.15] tracking-[-0.02em]">{title}</p>
              <p className="text-xs leading-5 text-white/84">{caption}</p>
            </div>
          </div>
        </div>

        <figcaption className="space-y-1 px-1 md:hidden">
          <p className="enterprise-kicker">{eyebrow}</p>
          <p className="text-base font-semibold leading-[1.15] tracking-[-0.02em] text-card-foreground">
            {title}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
        </figcaption>
      </figure>
    );
  }

  if (role === "heroCanvas") {
    return (
      <figure data-about-media-card={mediaMarker} className={cn("space-y-2.5", className)}>
        <div
          className={cn(
            "group relative overflow-hidden rounded-[2.45rem] bg-slate-100 ring-1 ring-slate-900/6 shadow-[0_24px_80px_rgba(8,31,61,0.16)]",
            mediaClassName,
          )}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            loading="eager"
            className={cn(
              "object-cover transition duration-700 ease-[cubic-bezier(0.2,0.65,0.2,1)] group-hover:scale-[1.02]",
              imageClassName,
            )}
          />
          <div className="absolute left-4 top-4 rounded-full border border-white/35 bg-slate-950/68 px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
            {eyebrow}
          </div>
        </div>

        <figcaption className="space-y-1 px-1 md:hidden">
          <p className="text-lg font-semibold leading-[1.1] tracking-[-0.02em] text-card-foreground">
            {title}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{caption}</p>
        </figcaption>
      </figure>
    );
  }

  return (
    <figure data-about-media-card={mediaMarker} className={cn("space-y-3", className)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-[2.25rem] bg-slate-100 ring-1 ring-slate-900/6 shadow-[0_22px_70px_rgba(8,31,61,0.12)]",
          mediaClassName,
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading="eager"
          className={cn(
            "object-cover transition duration-700 ease-[cubic-bezier(0.2,0.65,0.2,1)] group-hover:scale-[1.02]",
            imageClassName,
          )}
        />
        <div className="absolute left-4 top-4 rounded-full border border-white/35 bg-slate-950/68 px-3 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
          {eyebrow}
        </div>
      </div>
      <figcaption className="space-y-1 px-1">
        <p className="max-w-[24ch] text-[1.02rem] font-semibold leading-[1.08] tracking-[-0.022em] text-card-foreground md:text-[1.08rem]">
          {title}
        </p>
        <p className="max-w-[48ch] text-sm leading-6 text-muted-foreground md:hidden">{caption}</p>
      </figcaption>
    </figure>
  );
}

export default async function AboutPage() {
  const session = await auth();
  const primaryCta = getConsultationCta({
    signedIn: Boolean(session?.user?.email),
    utmMedium: "about-page",
  });

  return (
    <div className="marketing-stack">
      <section className="hero-bleed hero-poster border-b border-border/70">
        <div className="marketing-container px-4 py-8 md:px-6 md:py-10 xl:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
            <AboutReveal
              variant="copy"
              className="space-y-6 lg:pt-8"
              data-about-hero-copy=""
            >
              <div className="space-y-4">
                <p className="enterprise-kicker">{ABOUT_PAGE_CONTENT.hero.eyebrow}</p>
                <h1 className="font-display max-w-[10ch] text-balance text-[3.15rem] font-semibold leading-[0.93] tracking-[-0.055em] text-card-foreground md:text-[4.35rem] lg:text-[5rem]">
                  {ABOUT_PAGE_CONTENT.hero.title}
                </h1>
                <p className="max-w-[31ch] text-[1.02rem] leading-8 text-muted-foreground">
                  {ABOUT_PAGE_CONTENT.hero.lede}
                </p>
                <p className="max-w-[33ch] text-sm leading-7 text-card-foreground/82 md:text-[0.98rem]">
                  The work stays intentionally small. The standard behind it comes from bigger
                  rooms.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href={primaryCta.href} className={buttonVariants()}>
                  {primaryCta.label}
                </Link>
                <Link href="/services" className={buttonVariants({ variant: "secondary" })}>
                  View services
                </Link>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border/70 pt-4 sm:flex sm:flex-wrap">
                {ABOUT_FACTS.map((fact) => (
                  <div
                    key={fact.label}
                    className="min-w-0 space-y-1 sm:min-w-[11rem] sm:flex-1 lg:min-w-[7.5rem]"
                  >
                    <dt className="table-kicker">{fact.label}</dt>
                    <dd className="text-sm leading-6 text-card-foreground">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </AboutReveal>

            <AboutReveal
              variant="media"
              delay={100}
              className="lg:pt-8"
              data-about-hero-media=""
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(13.25rem,0.36fr)] md:items-stretch lg:grid-cols-[minmax(0,1fr)_minmax(14rem,0.34fr)]">
                <AboutMediaCard
                  role="heroCanvas"
                  src={ABOUT_PORTFOLIO_MEDIA.hero.src}
                  alt={ABOUT_PORTFOLIO_MEDIA.hero.alt}
                  eyebrow={ABOUT_PORTFOLIO_MEDIA.hero.eyebrow}
                  title={ABOUT_PORTFOLIO_MEDIA.hero.title}
                  caption={ABOUT_PORTFOLIO_MEDIA.hero.caption}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 68vw, 42vw"
                mediaClassName="aspect-[14/11] md:min-h-[31rem] lg:min-h-[32rem]"
                imageClassName={ABOUT_PORTFOLIO_MEDIA.hero.imageClassName}
                priority
                mediaMarker="hero-primary"
              />

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-1 md:grid-rows-[minmax(0,0.94fr)_minmax(0,1.06fr)] md:py-4 lg:py-5">
                  <AboutMediaCard
                    role="supportTile"
                    src={ABOUT_PORTFOLIO_MEDIA.summit.src}
                    alt={ABOUT_PORTFOLIO_MEDIA.summit.alt}
                    eyebrow={ABOUT_PORTFOLIO_MEDIA.summit.eyebrow}
                    title={ABOUT_PORTFOLIO_MEDIA.summit.title}
                    caption={ABOUT_PORTFOLIO_MEDIA.summit.caption}
                    sizes="(max-width: 768px) 48vw, (max-width: 1200px) 28vw, 20vw"
                    mediaClassName="aspect-[4/4.5] sm:min-h-[12.75rem] md:h-full md:min-h-0"
                    imageClassName={ABOUT_PORTFOLIO_MEDIA.summit.imageClassName}
                  />
                  <AboutMediaCard
                    role="supportTile"
                    src={ABOUT_PORTFOLIO_MEDIA.nvidia.src}
                    alt={ABOUT_PORTFOLIO_MEDIA.nvidia.alt}
                    eyebrow={ABOUT_PORTFOLIO_MEDIA.nvidia.eyebrow}
                    title={ABOUT_PORTFOLIO_MEDIA.nvidia.title}
                    caption={ABOUT_PORTFOLIO_MEDIA.nvidia.caption}
                    sizes="(max-width: 768px) 48vw, (max-width: 1200px) 28vw, 20vw"
                    mediaClassName="aspect-[4/4.5] sm:min-h-[12.75rem] md:h-full md:min-h-0"
                    imageClassName={ABOUT_PORTFOLIO_MEDIA.nvidia.imageClassName}
                  />
                </div>
              </div>
            </AboutReveal>
          </div>
        </div>
      </section>

      <section className="marketing-container px-4 md:px-6 xl:px-8">
        <div className="band-divider" />

        <div className="grid grid-cols-1 gap-10 pt-10 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-start">
          <AboutReveal variant="copy" className="space-y-6" data-about-proof-copy="">
            <div className="space-y-3">
              <p className="enterprise-kicker">{FOUNDER_PROOF_PAGE_CONTENT.about.narrative.eyebrow}</p>
              <h2 className="font-display max-w-[14ch] text-balance text-[2rem] font-semibold leading-[0.98] tracking-[-0.04em] text-card-foreground md:text-[2.5rem] lg:text-[2.7rem]">
                Larger-environment judgment. Smaller-practice delivery.
              </h2>
            </div>

            <div className="space-y-4">
              <p className="max-w-[44ch] text-base leading-8 text-card-foreground">
                Before ZoKorp, Zohaib spent years as an AWS Partner Solutions Architect and enterprise
                AI architect — closing $60M+ in partner contracts, influencing $200M+ in customer
                cloud spend, and building production AI systems at organizations including Warner
                Bros., the NHL, D.R. Horton, and Cohere.
              </p>
              <p className="max-w-[44ch] text-base leading-8 text-card-foreground">
                One project: a HIPAA-compliant AI-powered IVR for an urgent care network that cut
                average wait times from 94 minutes to 22. Another: an LLMOps platform on Azure for
                the NHL running multi-GPU distributed training with vLLM inference and per-request
                cost attribution.
              </p>
              <p className="max-w-[44ch] text-base leading-8 text-card-foreground">
                ZoKorp is intentionally small. Fixed-scope engagements, visible pricing, and Zohaib
                on every project — not a junior analyst, not an account manager. The background is
                enterprise. The delivery is direct.
              </p>
            </div>
          </AboutReveal>

          <div
            className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(12.5rem,0.38fr)] lg:items-center"
            data-about-proof-media=""
          >
            <AboutReveal variant="media" delay={90}>
              <AboutMediaCard
                role="editorialMedia"
                src={ABOUT_PORTFOLIO_MEDIA.panel.src}
                alt={ABOUT_PORTFOLIO_MEDIA.panel.alt}
                eyebrow={ABOUT_PORTFOLIO_MEDIA.panel.eyebrow}
                title={ABOUT_PORTFOLIO_MEDIA.panel.title}
                caption={ABOUT_PORTFOLIO_MEDIA.panel.caption}
                sizes="(max-width: 1280px) 100vw, 42vw"
                mediaClassName="aspect-[16/10] sm:min-h-[18.5rem]"
                imageClassName={ABOUT_PORTFOLIO_MEDIA.panel.imageClassName}
              />
            </AboutReveal>

            <AboutReveal variant="detail" delay={170} className="lg:self-center">
              <AboutMediaCard
                role="artifactPanel"
                src={ABOUT_PORTFOLIO_MEDIA.workshop.src}
                alt={ABOUT_PORTFOLIO_MEDIA.workshop.alt}
                eyebrow={ABOUT_PORTFOLIO_MEDIA.workshop.eyebrow}
                title={ABOUT_PORTFOLIO_MEDIA.workshop.title}
                caption={ABOUT_PORTFOLIO_MEDIA.workshop.caption}
                sizes="(max-width: 1280px) 72vw, 24vw"
                mediaClassName="aspect-[4/4.7] sm:min-h-[16.5rem]"
              />
            </AboutReveal>
          </div>
        </div>

        <AboutReveal variant="detail" delay={120} className="max-w-[62rem] space-y-2.5 pt-6">
          <p className="enterprise-kicker">
            {FOUNDER_PROOF_PAGE_CONTENT.about.selectedBackground.eyebrow}
          </p>
          <p className="max-w-[56ch] text-sm leading-7 text-card-foreground">
            {FOUNDER_PROOF_PAGE_CONTENT.about.selectedBackground.statement}
          </p>
          <p className="table-kicker text-[rgb(var(--z-ink-label))]">
            {FOUNDER_PROOF_PAGE_CONTENT.about.selectedBackground.sectorLine}
          </p>
          <p className="text-xs leading-6 text-muted-foreground">
            {FOUNDER_PROOF_PAGE_CONTENT.about.whyItMatters.disclaimer}
          </p>
        </AboutReveal>

        <div className="mt-12 pt-10">
          <div className="band-divider" />
        </div>

        <div className="grid grid-cols-1 gap-10 pt-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
          <AboutReveal variant="copy" className="space-y-6" data-about-benefits-copy="">
            <div className="space-y-3">
              <p className="enterprise-kicker">{FOUNDER_PROOF_PAGE_CONTENT.about.whyItMatters.eyebrow}</p>
              <h2 className="font-display max-w-[13ch] text-balance text-[2rem] font-semibold leading-[0.98] tracking-[-0.04em] text-card-foreground md:text-[2.35rem]">
                What clients actually get.
              </h2>
            </div>

            <p className="max-w-[40ch] text-base leading-8 text-card-foreground">
              Bigger-environment experience only matters if it makes smaller-team work clearer,
              faster, and more grounded.
            </p>

            <ol className="divide-y divide-border/60 border-y border-border/70">
              {FOUNDER_PROOF_PAGE_CONTENT.about.whyItMatters.bullets.map((bullet, index) => (
                <li
                  key={bullet}
                  className="grid grid-cols-[2.1rem_minmax(0,1fr)] gap-3 py-3.5 md:grid-cols-[2.3rem_minmax(0,1fr)]"
                >
                  <p className="table-kicker pt-0.5">{`0${index + 1}`}</p>
                  <p className="text-sm leading-7 text-card-foreground">{bullet}</p>
                </li>
              ))}
            </ol>
          </AboutReveal>

          <div
            className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(12.5rem,0.38fr)] lg:items-start"
            data-about-benefits-media=""
          >
            <AboutReveal variant="media" delay={80}>
              <AboutMediaCard
                role="editorialMedia"
                src={ABOUT_PORTFOLIO_MEDIA.cloudathon.src}
                alt={ABOUT_PORTFOLIO_MEDIA.cloudathon.alt}
                eyebrow={ABOUT_PORTFOLIO_MEDIA.cloudathon.eyebrow}
                title={ABOUT_PORTFOLIO_MEDIA.cloudathon.title}
                caption={ABOUT_PORTFOLIO_MEDIA.cloudathon.caption}
                sizes="(max-width: 1280px) 100vw, 42vw"
                mediaClassName="aspect-[16/10] sm:min-h-[18rem]"
                imageClassName={ABOUT_PORTFOLIO_MEDIA.cloudathon.imageClassName}
              />
            </AboutReveal>

            <AboutReveal variant="detail" delay={150} className="lg:self-start">
              <AboutMediaCard
                role="supportTile"
                src={ABOUT_PORTFOLIO_MEDIA.hcc.src}
                alt={ABOUT_PORTFOLIO_MEDIA.hcc.alt}
                eyebrow={ABOUT_PORTFOLIO_MEDIA.hcc.eyebrow}
                title={ABOUT_PORTFOLIO_MEDIA.hcc.title}
                caption={ABOUT_PORTFOLIO_MEDIA.hcc.caption}
                sizes="(max-width: 1280px) 72vw, 24vw"
                mediaClassName="aspect-[5/5.8] sm:min-h-[15rem] md:min-h-[18rem]"
                imageClassName={ABOUT_PORTFOLIO_MEDIA.hcc.imageClassName}
              />
            </AboutReveal>
          </div>
        </div>
      </section>

      <section className="marketing-container px-4 md:px-6 xl:px-8">
        <div className="band-divider" />

        <div className="grid grid-cols-1 gap-10 pt-10 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-start">
          <div className="space-y-4">
            <p className="enterprise-kicker">Credentials</p>
            <h2 className="font-display max-w-[12ch] text-balance text-[2rem] font-semibold leading-[0.98] tracking-[-0.04em] text-card-foreground md:text-[2.35rem]">
              Named background, named credentials.
            </h2>
            <p className="max-w-[38ch] text-sm leading-7 text-muted-foreground">
              Certifications are direct. The speaking and teaching work is public and verifiable.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-0 border-t border-border/70 sm:grid-cols-2">
            {[
              "AWS Certified Solutions Architect — Professional",
              "AI Solutions Engineer, Microsoft Azure",
              "AI Professor, Houston Community College",
              "AWS Summit | NVIDIA AI Summit | StrongDM Workshop facilitator",
            ].map((credential) => (
              <li
                key={credential}
                className="border-b border-border/70 py-4 pr-4 text-sm leading-7 text-card-foreground sm:odd:border-r sm:odd:pr-6 sm:even:pl-6"
              >
                {credential}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12">
          <div className="band-divider" />
        </div>

        <div className="grid grid-cols-1 gap-8 pt-10 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] xl:items-end">
          <AboutReveal variant="copy" className="space-y-5">
            <p className="enterprise-kicker">Interview</p>
            <h2 className="font-display max-w-[12ch] text-balance text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-card-foreground md:text-[2.45rem]">
              Interview footage, embedded here.
            </h2>
            <p className="max-w-[44ch] text-base leading-8 text-card-foreground">
              This player opens at the point where Zohaib is introduced during the Houston
              Community College interview from the AWS period. It stays here because moving video
              says more than another block of proof copy.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href={ABOUT_VIDEO_WATCH_URL}
                className={buttonVariants({ variant: "secondary" })}
                target="_blank"
                rel="noreferrer"
              >
                Watch on YouTube
              </a>
              <Link href="/contact" className={buttonVariants({ variant: "ghost" })}>
                Ask about a project
              </Link>
            </div>
          </AboutReveal>

          <AboutReveal variant="media" delay={100}>
            <div className="overflow-hidden rounded-[2.35rem] bg-slate-950 ring-1 ring-slate-900/6 shadow-[0_24px_84px_rgba(8,31,61,0.18)]">
              <div className="aspect-video w-full bg-slate-950">
                <iframe
                  title="Houston Community College TV interview with Zohaib Khawaja"
                  src={ABOUT_VIDEO_EMBED_URL}
                  className="h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </AboutReveal>
        </div>

        <AboutReveal variant="detail" delay={80}>
          <div className="mt-8 flex flex-col gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <p className="enterprise-kicker">Next step</p>
              <p className="text-lg font-semibold leading-[1.15] tracking-[-0.02em] text-card-foreground">
                Book a fit check, or start with the $249 Architecture Review.
              </p>
              <p className="text-sm leading-7 text-muted-foreground">
                {PUBLIC_LAUNCH_CONTACT.responseWindowLabel}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={PUBLIC_LAUNCH_CONTACT.bookingUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants()}
              >
                Book a 15-min fit check
              </a>
              <Link
                href="/services#architecture-review"
                className={buttonVariants({ variant: "secondary" })}
              >
                Start a review
              </Link>
            </div>
          </div>
        </AboutReveal>
      </section>
    </div>
  );
}
