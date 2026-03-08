import * as React from "react";

import { cn } from "@/lib/utils";

const variantClasses = {
  primary:
    "border-transparent bg-brand text-white shadow-[var(--shadow-card)] hover:bg-brand-strong",
  secondary:
    "border-border bg-surface text-foreground shadow-[var(--shadow-soft)] hover:bg-background-elevated",
  outline: "border-border bg-white/80 text-foreground hover:bg-background-elevated",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-background-elevated/80",
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
    "focus-ring inline-flex items-center justify-center gap-2 border font-semibold transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
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
