"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type RevealVariant = "copy" | "media" | "detail";

type RevealProps = {
  children: ReactNode;
  delay?: number;
  variant?: RevealVariant;
  as?: "div" | "section" | "article" | "header" | "footer" | "ol" | "ul" | "li";
} & Omit<HTMLAttributes<HTMLElement>, "as">;

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "copy",
  as = "div",
  style,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    node.dataset.revealReady = "true";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.dataset.revealed = "true";
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 1.1) {
      node.dataset.revealed = "true";
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.dataset.revealed = "true";
            observer.disconnect();
            window.clearTimeout(fallbackTimer);
            break;
          }
        }
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(node);

    const fallbackTimer = window.setTimeout(() => {
      node.dataset.revealed = "true";
      observer.disconnect();
    }, 1800);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const Component = as as React.ElementType;

  return (
    <Component
      ref={ref as React.Ref<HTMLElement>}
      className={cn("reveal", className)}
      data-reveal=""
      data-reveal-ready="false"
      data-revealed="false"
      data-reveal-variant={variant}
      style={{ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties}
      {...props}
    >
      {children}
    </Component>
  );
}
