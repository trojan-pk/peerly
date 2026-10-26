"use client";

import { useSyncExternalStore } from "react";
import { Clock } from "lucide-react";
import { formatTimeLeft } from "@/lib/request-rules";

// One shared minute ticker for every countdown on the page.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: number | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    now = Date.now();
    timer = window.setInterval(() => { now = Date.now(); listeners.forEach((l) => l()); }, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) { window.clearInterval(timer); timer = undefined; }
  };
}

/**
 * Remaining time until a deadline, in Geist Mono. Updates every 30s without
 * announcing each tick to screen readers (the text is read when focused/visited).
 * Renders nothing on the server to avoid a time-dependent hydration mismatch.
 */
export function Countdown({ until, label = "left to respond", className = "" }: { until: string; label?: string; className?: string }) {
  const current = useSyncExternalStore(subscribe, () => now, () => null);
  if (current === null) return <span className={`countdown ${className}`} aria-hidden="true">&nbsp;</span>;
  const msLeft = new Date(until).getTime() - current;
  const text = formatTimeLeft(msLeft);
  const soon = msLeft > 0 && msLeft <= 60 * 60 * 1000;
  return (
    <span className={`countdown ${soon ? "is-soon" : ""} ${className}`} title={new Date(until).toLocaleString()}>
      <Clock size={14} aria-hidden="true" />
      <span className="tabular">{text ? text.replace(" left", "") : "Time's up"}</span>
      {text && <span className="sr-only"> {label}</span>}
    </span>
  );
}
