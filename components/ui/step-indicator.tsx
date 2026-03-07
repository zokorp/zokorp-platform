import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StepItem = {
  id: string;
  title: string;
  description?: string;
};

type StepIndicatorProps = {
  currentStep: number;
  items: StepItem[];
  className?: string;
};

export function StepIndicator({ currentStep, items, className }: StepIndicatorProps) {
  return (
    <ol className={cn("flex flex-wrap gap-2", className)} aria-label="Progress">
      {items.map((item, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;
        const statusLabel = isComplete ? "Completed" : isActive ? "Current step" : "Upcoming step";

        return (
          <li key={item.id} aria-current={isActive ? "step" : undefined}>
            <Badge
              variant={isActive ? "brand" : isComplete ? "success" : "secondary"}
              className="gap-2 px-3 py-1.5 normal-case tracking-normal"
              title={item.description}
            >
              <span className="font-mono text-[11px]">{`${index + 1}`.padStart(2, "0")}</span>
              <span>{item.title}</span>
              <span className="sr-only">{statusLabel}</span>
            </Badge>
          </li>
        );
      })}
    </ol>
  );
}
