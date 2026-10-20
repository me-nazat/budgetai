"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FluidButtonProps extends HTMLMotionProps<"button"> {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  isLoading?: boolean;
}

/**
 * Institutional button component tuned for financial platforms.
 * Uses consistent heights (h-8 compact, h-9 standard, h-10 primary),
 * tactile active:scale-[0.99] press feedback, keyboard focus rings,
 * and built-in loading protection.
 */
export const FluidButton = React.forwardRef<HTMLButtonElement, FluidButtonProps>(
  (
    {
      children,
      className,
      variant = "primary",
      size = "md",
      loading = false,
      isLoading = false,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isBusy = Boolean(loading || isLoading);
    const isDisabled = Boolean(disabled || isBusy);

    const baseClasses =
      "relative inline-flex items-center justify-center font-medium rounded-lg select-none " +
      "transition-colors duration-150 ease-out " +
      "active:scale-[0.99] active:transition-transform active:duration-75 " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 " +
      "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

    const variants = {
      primary:
        "bg-[var(--accent-primary,#6366F1)] text-white hover:bg-[var(--accent-primary-hover,#4F46E5)] " +
        "border border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
      secondary:
        "bg-[var(--bg-elevated,#161922)] text-[var(--color-text-main,#FAFAFA)] " +
        "border border-[var(--border-subtle,rgba(255,255,255,0.07))] " +
        "hover:border-[var(--border-strong,rgba(255,255,255,0.14))] hover:bg-[var(--bg-hover)]",
      outline:
        "bg-transparent text-[var(--color-text-main,#FAFAFA)] " +
        "border border-[var(--border-subtle,rgba(255,255,255,0.07))] " +
        "hover:border-[var(--border-strong,rgba(255,255,255,0.14))] hover:bg-[var(--bg-hover)]",
      ghost:
        "bg-transparent text-[var(--color-text-main,#FAFAFA)] border border-transparent " +
        "hover:bg-[var(--bg-hover)]",
      danger:
        "bg-[var(--finance-negative-bg,rgba(244,63,94,0.12))] text-[var(--finance-negative,#F43F5E)] " +
        "border border-[var(--finance-negative,#F43F5E)]/20 " +
        "hover:bg-[var(--finance-negative,#F43F5E)] hover:text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-10 px-5 text-sm font-semibold tracking-[-0.01em] gap-2.5",
      icon: "h-9 w-9 p-0 flex items-center justify-center",
    };

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        {...props}
      >
        {isBusy ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            <span className="sr-only">Loading...</span>
            {children}
          </span>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);

FluidButton.displayName = "FluidButton";

export default FluidButton;
