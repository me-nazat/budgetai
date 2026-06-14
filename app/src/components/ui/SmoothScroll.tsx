"use client";

import { ReactNode } from "react";

interface SmoothScrollProps {
  children: ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  // We removed ReactLenis to fix low scroll sensitivity and jittering issues.
  // Native OS scroll physics (like Mac trackpads) are far superior and 60fps locked.
  return <>{children}</>;
}
