import { cn } from "@/lib/utils";

type ProofStat = {
  value: string;
  label: string;
};

type ProofNumbersStripProps = {
  eyebrow?: string;
  title?: string;
  stats: readonly ProofStat[];
  footnote?: string;
  className?: string;
};

export function ProofNumbersStrip({
  eyebrow,
  title,
  stats,
  footnote,
  className,
}: ProofNumbersStripProps) {
  return (
    <section className={cn("section-band px-5 py-6 md:px-6 md:py-7", className)}>
      {eyebrow || title ? (
        <div className="mb-5 space-y-2">
          {eyebrow ? <p className="enterprise-kicker">{eyebrow}</p> : null}
          {title ? (
            <p className="font-display max-w-[28ch] text-[1.6rem] font-semibold leading-[1.02] text-card-foreground md:text-[1.95rem]">
              {title}
            </p>
          ) : null}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-4 md:gap-x-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="space-y-2 border-t border-border/70 pt-4"
          >
            <dt className="font-display text-[2rem] font-semibold leading-[1.02] tracking-[-0.04em] text-card-foreground md:text-[2.6rem]">
              {stat.value}
            </dt>
            <dd className="max-w-[28ch] text-sm leading-6 text-muted-foreground">
              {stat.label}
            </dd>
          </div>
        ))}
      </dl>

      {footnote ? (
        <p className="mt-5 text-xs leading-6 text-muted-foreground">{footnote}</p>
      ) : null}
    </section>
  );
}

export const HOME_PROOF_STATS: readonly ProofStat[] = [
  {
    value: "77%",
    label: "Reduction in urgent-care wait time on a HIPAA-compliant AI deployment",
  },
  {
    value: "$60M+",
    label: "Partner contracts closed as AWS Partner Solutions Architect",
  },
  {
    value: "$200M+",
    label: "Customer revenue influenced across Well-Architected engagements",
  },
  {
    value: "20–70%",
    label: "Cloud cost reduction range on infrastructure optimization engagements",
  },
] as const;
