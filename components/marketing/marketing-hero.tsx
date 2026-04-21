import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarketingAction = {
  href: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  external?: boolean;
  openInNewTab?: boolean;
  rel?: string;
};

type MarketingHeroProps = {
  mode?: "panel" | "inverted" | "poster";
  eyebrow: string;
  title: string;
  lede: string;
  postLede?: string;
  supportingBullets?: readonly string[];
  proofChips?: readonly string[];
  primaryAction: MarketingAction;
  secondaryAction?: MarketingAction;
  tertiaryAction?: MarketingAction;
  rail?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyColumnClassName?: string;
  railClassName?: string;
  railColumnClassName?: string;
};

function renderAction(action: MarketingAction | undefined, fallbackVariant: ButtonVariant) {
  if (!action) {
    return null;
  }

  const variant = action.variant ?? fallbackVariant;
  const size = action.size ?? "lg";
  const className = cn(
    buttonVariants({ variant, size }),
    "max-w-full whitespace-normal text-center leading-snug",
  );
  const isExternal = action.external ?? /^(https?:|mailto:)/.test(action.href);
  const target = action.openInNewTab ? "_blank" : undefined;

  if (isExternal) {
    return (
      <a
        href={action.href}
        className={className}
        target={target}
        rel={action.rel ?? (action.openInNewTab && action.href.startsWith("http") ? "noreferrer" : undefined)}
      >
        {action.label}
      </a>
    );
  }

  return (
    <Link href={action.href} className={className}>
      {action.label}
    </Link>
  );
}

export function MarketingHero({
  mode = "panel",
  eyebrow,
  title,
  lede,
  postLede,
  supportingBullets = [],
  proofChips = [],
  primaryAction,
  secondaryAction,
  tertiaryAction,
  rail,
  className,
  bodyClassName,
  bodyColumnClassName,
  railClassName,
  railColumnClassName,
}: MarketingHeroProps) {
  const isPanel = mode === "panel";
  const isPoster = mode === "poster";
  const sectionClassName = isPoster
    ? "hero-bleed hero-poster py-8 md:py-10 lg:py-12"
    : "hero-surface marketing-grid-lines px-5 py-6 md:px-8 md:py-10 lg:px-10 lg:py-12";
  const wrapperClassName = isPoster ? "marketing-container px-4 md:px-6 xl:px-8" : "";

  return (
    <section className={cn(sectionClassName, className)}>
      {!isPoster ? <div className="marketing-orbit" data-orbit="one" /> : null}
      {!isPoster ? <div className="marketing-orbit" data-orbit="two" /> : null}
      <div className={wrapperClassName}>
        <div
          data-hero-layout={rail ? "split" : "single"}
          className={cn(
            "relative z-10 grid gap-8 lg:grid-cols-12 lg:items-start",
            rail ? "lg:gap-8" : "",
            isPoster ? "lg:items-start" : "",
          )}
        >
          <div
            data-surface="hero-copy"
            data-hero-body
            style={isPoster ? { backgroundColor: "rgba(250, 252, 255, 0.96)" } : undefined}
            className={cn(
              "lg:col-span-7",
              bodyColumnClassName,
              isPoster
                ? "py-2 text-card-foreground shadow-none lg:pr-10"
                : isPanel
                  ? "glass-surface rounded-[2rem] p-6 text-card-foreground md:p-8 lg:p-10"
                  : "text-white",
              bodyClassName,
            )}
          >
          <Badge
            variant={isPoster || isPanel ? "secondary" : "outline"}
            className={cn(
              "w-fit rounded-full px-3.5 py-1.5 normal-case tracking-[0.18em]",
              isPoster || isPanel
                ? "bg-white/80 text-muted-foreground"
                : "border-white/20 bg-white/10 text-white",
            )}
          >
            {eyebrow}
          </Badge>

          <h1
            className={cn(
              isPoster
                ? "font-display mt-5 max-w-[10.5ch] text-balance text-[3.1rem] font-semibold leading-[0.92] tracking-[-0.055em] md:text-[4.5rem] lg:text-[5.2rem]"
                : "font-display mt-5 max-w-[11.5ch] text-balance text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.045em] md:text-[4rem] lg:text-[4.7rem]",
              isPoster || isPanel ? "text-card-foreground" : "text-white",
            )}
          >
            {title}
          </h1>

          <p
            data-measure="lede"
            className={cn(
              isPoster
                ? "measure-tight mt-5 max-w-[48ch] text-base leading-7 text-muted-foreground md:text-[1.05rem] md:leading-8"
                : "measure-copy mt-6 max-w-[58ch] text-base leading-7 md:text-[1.1rem] md:leading-8",
              isPoster || isPanel ? "text-muted-foreground" : "text-white/88",
            )}
          >
            {lede}
          </p>

          {postLede ? (
            <p
              data-measure="post-lede"
              className={cn(
                "mt-4 max-w-[48ch] text-[0.98rem] font-medium leading-7",
                isPoster || isPanel ? "text-card-foreground" : "text-white",
              )}
            >
              {postLede}
            </p>
          ) : null}

          {supportingBullets.length > 0 ? (
            <ul className={cn("mt-7 grid gap-x-8 gap-y-3.5 sm:grid-cols-2", isPoster ? "max-w-[44rem]" : "")}>
              {supportingBullets.map((bullet) => (
                <li
                  key={bullet}
                  className={cn(
                    "relative pl-5 text-sm font-medium leading-6",
                    isPoster || isPanel
                      ? "text-card-foreground"
                      : "text-white",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-2 size-2 rounded-full",
                      isPoster || isPanel ? "bg-brand shadow-[0_0_0_6px_rgb(var(--z-accent)/0.12)]" : "bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.14)]",
                    )}
                  />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            {renderAction(primaryAction, isPanel ? "primary" : "primary")}
            {renderAction(secondaryAction, isPanel ? "secondary" : "inverse")}
            {renderAction(tertiaryAction, isPanel ? "ghost" : "inverse")}
          </div>

          {proofChips.length > 0 ? (
            <div className="mt-8 flex flex-wrap gap-2.5">
              {proofChips.map((chip) => (
                <span
                  key={chip}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3.5 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.13em]",
                    isPoster || isPanel
                      ? "border-border bg-white/84 text-muted-foreground"
                      : "border-white/16 bg-white/10 text-white/84",
                  )}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>

          {rail ? (
            <div
              data-hero-rail
              className={cn(
                "space-y-4 lg:col-span-5 lg:pt-2",
                railColumnClassName,
                isPoster ? "lg:pt-0" : "",
                railClassName,
              )}
            >
              {rail}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
