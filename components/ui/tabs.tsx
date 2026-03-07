"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  baseId: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string) {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error(`${component} must be used within <Tabs>.`);
  }

  return context;
}

type TabsProps = {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
};

export function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const baseId = React.useId();
  const currentValue = value ?? uncontrolledValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setUncontrolledValue(nextValue);
      }

      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  return (
    <TabsContext.Provider value={{ value: currentValue, setValue, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        "inline-flex flex-wrap gap-2 rounded-2xl border border-border bg-background-elevated p-1.5",
        className,
      )}
      onKeyDown={(event) => {
        const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
        if (!keys.includes(event.key)) {
          return;
        }

        const tablist = event.currentTarget;
        const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>("[role='tab']"));
        const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);

        if (tabs.length === 0) {
          return;
        }

        event.preventDefault();

        if (event.key === "Home") {
          tabs[0]?.focus();
          tabs[0]?.click();
          return;
        }

        if (event.key === "End") {
          tabs.at(-1)?.focus();
          tabs.at(-1)?.click();
          return;
        }

        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + tabs.length) % tabs.length;
        tabs[nextIndex]?.focus();
        tabs[nextIndex]?.click();
      }}
      {...props}
    />
  );
}

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

export function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const context = useTabsContext("TabsTrigger");
  const selected = context.value === value;
  const tabId = `${context.baseId}-tab-${value}`;
  const panelId = `${context.baseId}-panel-${value}`;

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      aria-controls={panelId}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={cn(
        "focus-ring inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition",
        selected
          ? "border-brand bg-brand text-white shadow-[var(--shadow-soft)]"
          : "border-transparent bg-transparent text-foreground-muted hover:bg-white",
        className,
      )}
      onClick={() => context.setValue(value)}
      {...props}
    />
  );
}

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
};

export function TabsContent({ className, value, ...props }: TabsContentProps) {
  const context = useTabsContext("TabsContent");
  const selected = context.value === value;
  const tabId = `${context.baseId}-tab-${value}`;
  const panelId = `${context.baseId}-panel-${value}`;

  if (!selected) {
    return null;
  }

  return <div role="tabpanel" id={panelId} aria-labelledby={tabId} className={className} {...props} />;
}
