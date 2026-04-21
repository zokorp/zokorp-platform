import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ServiceOfferRowProps = {
  eyebrow: string;
  title: string;
  priceAnchor: string;
  summary: string;
  bullets: readonly string[];
  included: readonly string[];
  index?: number;
  className?: string;
  compact?: boolean;
  id?: string;
  action?: {
    href: string;
    label: string;
  };
};

export function ServiceOfferRow({
  eyebrow,
  title,
  priceAnchor,
  summary,
  bullets,
  included,
  index,
  className,
  compact = false,
  id,
  action,
}: ServiceOfferRowProps) {
  return (
    <article
      id={id}
      className={cn(
        "table-row scroll-mt-28",
        className,
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <p className="table-kicker">{index ? `0${index}` : "Offer"}</p>
          <p className="enterprise-kicker">{eyebrow}</p>
        </div>
        <h3
          className={cn(
            "font-display max-w-[13ch] font-semibold leading-[1.02] text-card-foreground",
            compact ? "text-[1.95rem]" : "text-[2.05rem]",
          )}
        >
          {title}
        </h3>
        <p className="max-w-[32ch] text-sm leading-7 text-muted-foreground">{summary}</p>
      </div>

      <div className="space-y-3">
        <p className="table-cell-label">Best for</p>
        <ul className="table-list">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>

      <div className="table-cell-panel space-y-3">
        <p className="table-cell-label">What you get</p>
        <div className="grid gap-2.5">
          {included.map((item) => (
            <div key={item} className="text-sm text-card-foreground">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-[6.5rem] flex-wrap items-start gap-3 lg:justify-end">
        <Badge variant="secondary" className="normal-case tracking-normal">
          {priceAnchor}
        </Badge>
        {action ? (
          <a href={action.href} className={buttonVariants({ variant: "secondary", size: "sm" })}>
            {action.label}
          </a>
        ) : null}
      </div>
    </article>
  );
}
