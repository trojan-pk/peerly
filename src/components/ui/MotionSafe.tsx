"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * App-wide Motion configuration.
 * - LazyMotion + `m` components load only the DOM animation feature set (smaller bundle);
 *   `strict` makes accidental use of the full `motion.*` components a runtime error.
 * - reducedMotion="user" turns transform/layout animations into instant changes when
 *   the operating system requests reduced motion. Opacity fades remain, as permitted.
 */
export function MotionSafe({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
