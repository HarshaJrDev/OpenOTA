"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * `reducedMotion="user"` makes every `motion.*` element on the site (FadeIn, etc.) automatically
 * respect the OS-level `prefers-reduced-motion` setting — transforms are skipped, only opacity
 * fades apply — without needing to thread that check through every individual animated component.
 * One provider at the root covers the whole site.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
