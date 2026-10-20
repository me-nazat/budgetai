"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  tiltIntensity?: number;
  style?: React.CSSProperties;
}

/**
 * Surface card with subtle 1px border highlight and hover elevation shift.
 * Heavy 3D mouse-tilt calculations have been removed for 60fps institutional performance.
 */
export function TiltCard({
  children,
  className,
  tiltIntensity: _tiltIntensity,
  style,
}: TiltCardProps) {
  return (
    <div
      style={style}
      className={cn(
        "relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]",
        "transition-colors transition-transform duration-150 ease-out hover:-translate-y-[1px] hover:border-[var(--border-strong)]",
        className
      )}
    >
      <div className="w-full h-full">{children}</div>
    </div>
  );
}
