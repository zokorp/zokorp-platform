import * as React from "react";

import { cn } from "@/lib/utils";

const variantClasses = {
  primary:
    "border-brand-strong/20 bg-[linear-gradient(180deg,#15497d_0%,#0f355d_100%)] text-white shadow-[0_1px_0_rgba(255,255,255,0.14)_inset,0_18px_34px_rgba(8,31,61,0.18)] hover:brightness-105",
  secondary:
    "border-border/80 bg-white/88 text-foreground shadow-[0_1px_0_rgba(255,255,255,0.88)_inset,0_12px_24px_rgba(8,31,61,0.06)] hover:border-border-strong hover:bg-background-elevated",
  outline:
    "border-border/80 bg-white/65 text-foreground shadow-[var(--shadow-soft)] hover:border-border-strong hover:bg-white/88",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-background-elevated/78",
  destructive: "border-transparent bg-danger text-white hover:brightness-95",
  link: "border-transparent bg-transparent px-0 py-0 text-brand shadow-none hover:text-brand-strong hover:underline",
} as const;

const sizeClasses = {
  sm: "min-h-9 rounded-lg px-3 py-2 text-xs",
  md: "min-h-10 rounded-xl px-4 py-2.5 text-sm",
  lg: "min-h-11 rounded-xl px-5 py-3 text-sm",
  icon: "size-10 rounded-xl p-0",
} as const;

export type ButtonVariant = keyof typeof variantClasses;
export type ButtonSize = keyof typeof sizeClasses;

type ButtonVariantOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
}: ButtonVariantOptions = {}) {
  return cn(
    "focus-ring inline-flex items-center justify-center gap-2 border font-semibold transition-[transform,box-shadow,background-color,border-color,color,filter] duration-200 active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    loading && "cursor-progress",
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariantOptions & {
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
  };

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    leftIcon,
    rightIcon,
    children,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, fullWidth, loading }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
});
