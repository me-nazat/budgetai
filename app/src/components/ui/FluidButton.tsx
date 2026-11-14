"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FluidButtonProps extends HTMLMotionProps<"button"> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export function FluidButton({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading,
  disabled,
  ...props
}: FluidButtonProps) {
  
  const baseClasses = "relative inline-flex items-center justify-center font-medium transition-colors outline-none overflow-hidden rounded-xl group";
  
  const variants = {
    primary: "bg-primary text-black hover:bg-primary-hover shadow-[0_0_12px_rgba(0,229,255,0.25)] hover:shadow-[0_4px_20px_rgba(0,229,255,0.45)] border border-primary/20",
    secondary: "bg-surface-dark-2 text-text-main border border-white/5 hover:border-white/10 hover:bg-surface-hover shadow-sm",
    outline: "bg-transparent border border-white/10 text-text-main hover:bg-white/5",
    ghost: "bg-transparent text-text-main hover:bg-white/5",
    danger: "bg-accent-rose/10 text-accent-rose border border-accent-rose/20 hover:bg-accent-rose hover:text-white shadow-[0_0_12px_rgba(255,42,95,0.1)] hover:shadow-[0_4px_20px_rgba(255,42,95,0.3)]",
  };
  
  const sizes = {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-[15px]",
    lg: "h-13 px-8 text-base",
    icon: "h-11 w-11 flex items-center justify-center",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97, transition: { type: "spring", stiffness: 400, damping: 10 } }}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        (disabled || isLoading) && "opacity-60 cursor-not-allowed pointer-events-none",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Light sweep effect on hover for primary/danger */}
      {(variant === 'primary' || variant === 'danger') && (
        <span className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
      )}
      
      {isLoading ? (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      )}
    </motion.button>
  );
}
