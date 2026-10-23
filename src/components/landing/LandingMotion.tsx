"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches || !("IntersectionObserver" in window)) return;
    const sections = root.current?.querySelectorAll<HTMLElement>(".landing-section") ?? [];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.reveal = "visible";
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px 60px 0px", threshold: 0 });
    sections.forEach(section => {
      // Server-rendered content stays visible without JS. Only sections still
      // below the viewport are armed for a one-time entrance.
      if (section.getBoundingClientRect().top > window.innerHeight + 60) {
        section.dataset.reveal = "waiting";
        observer.observe(section);
      }
    });
    const revealAll = () => {
      if (preference.matches) {
        sections.forEach(section => { section.dataset.reveal = "visible"; });
        observer.disconnect();
      }
    };
    preference.addEventListener("change", revealAll);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", revealAll);
      sections.forEach(section => { delete section.dataset.reveal; });
    };
  }, []);

  return <div ref={root} className="landing landing-v2" data-motion={paused ? "paused" : "playing"}>{children}<button type="button" className="motion-control" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={12} /> : <Pause size={12} />}{paused ? "Resume animations" : "Pause animations"}</button></div>;
}
