"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let surface: HTMLElement | null = null;
    let x = 0;
    let y = 0;
    const reset = () => {
      if (surface) {
        delete surface.dataset.pointer;
        surface.style.setProperty("--hover-rx", "0deg");
        surface.style.setProperty("--hover-ry", "0deg");
      }
      surface = null;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || preference.matches || element.dataset.motion === "paused") return;
      const next = (event.target as Element).closest<HTMLElement>(".m-feature, .deck-card, .m-button");
      if (surface !== next) { reset(); surface = next; }
      if (!surface) return;
      const bounds = surface.getBoundingClientRect();
      x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
      y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!surface) return;
        surface.dataset.pointer = "active";
        surface.style.setProperty("--pointer-x", `${x * 100}%`);
        surface.style.setProperty("--pointer-y", `${y * 100}%`);
        surface.style.setProperty("--hover-rx", `${(0.5 - y) * 5}deg`);
        surface.style.setProperty("--hover-ry", `${(x - 0.5) * 5}deg`);
      });
    };
    const out = (event: PointerEvent) => {
      if (surface && (!(event.relatedTarget instanceof Node) || !surface.contains(event.relatedTarget))) reset();
    };
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerout", out, { passive: true });
    preference.addEventListener("change", reset);
    return () => {
      cancelAnimationFrame(frame); reset();
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerout", out);
      preference.removeEventListener("change", reset);
    };
  }, []);

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
