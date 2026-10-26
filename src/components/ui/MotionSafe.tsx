"use client";

import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);
import type { ReactNode } from "react";

/**
 * App-wide Motion configuration.
 * - LazyMotion + `m` components load the DOM animation feature set asynchronously after
 *   first render (smaller initial bundle; elements render statically until it arrives);
 *   `strict` makes accidental use of the full `motion.*` components a runtime error.
 * - reducedMotion="user" turns transform/layout animations into instant changes when
 *   the operating system requests reduced motion. Opacity fades remain, as permitted.
 */
export function MotionSafe({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.8 }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
