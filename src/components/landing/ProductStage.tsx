"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { Sigma, Code2, Atom, FlaskConical, ChartNoAxesCombined, BookOpen, ArrowUpRight, LockKeyhole, Sparkles, Search, CircleCheck, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const subjects = [
  { name: "Mathematics", Icon: Sigma, color: "#8b69ff", question: "Make sense of the next equation.", topic: "Linear algebra", detail: "A different way to see vectors, matrices and the space between them." },
  { name: "Programming", Icon: Code2, color: "#ff7bc8", question: "Turn a tricky concept into an ‘aha!’", topic: "Data structures", detail: "Work through binary trees, one clear example at a time." },
  { name: "Physics", Icon: Atom, color: "#27bde6", question: "Find the force behind the formula.", topic: "Mechanics", detail: "Connect the theory to the world around you, with a peer who gets it." },
  { name: "Chemistry", Icon: FlaskConical, color: "#ffae63", question: "Find a little chemistry with learning.", topic: "Organic chemistry", detail: "Unpack the reactions and understand why they happen." },
  { name: "Economics", Icon: ChartNoAxesCombined, color: "#87d49c", question: "See the bigger picture together.", topic: "Microeconomics", detail: "Explore the choices, incentives and ideas behind the graph." },
  { name: "Shared notes", Icon: BookOpen, color: "#729aff", question: "A good explanation deserves company.", topic: "Study resources", detail: "Discover useful links and notes shared by other students." },
];

export function ProductStage({ startHref }: { startHref: string }) {
  const [active, setActive] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const subject = subjects[active];
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    stage.current?.style.setProperty("--tilt-y", `${((event.clientX - bounds.left) / bounds.width - .5) * 5}deg`);
    stage.current?.style.setProperty("--tilt-x", `${(.5 - (event.clientY - bounds.top) / bounds.height) * 4}deg`);
  }
  function reset() { stage.current?.style.setProperty("--tilt-x", "0deg"); stage.current?.style.setProperty("--tilt-y", "0deg"); }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) next = (index + 1) % subjects.length;
    else if (["ArrowLeft", "ArrowUp"].includes(event.key)) next = (index + subjects.length - 1) % subjects.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = subjects.length - 1;
    else return;
    event.preventDefault(); setActive(next); buttons.current[next]?.focus();
  }
  return (
    <>
      <div className="product-stage" onPointerMove={tilt} onPointerLeave={reset}>
        <div className="stage-aura" aria-hidden="true" />
        <span className="floating-glyph glyph-one" aria-hidden="true"><Sigma /></span><span className="floating-glyph glyph-two" aria-hidden="true"><Atom /></span><span className="floating-glyph glyph-three" aria-hidden="true"><Code2 /></span>
        <div className="product-window" ref={stage}>
          <div className="product-toolbar"><span className="window-dots"><i /><i /><i /></span><span><BrandMark /> Your next breakthrough</span><span className="window-lock"><LockKeyhole size={12} /> Made for your study circle</span></div>
          <div className="product-window-body">
            <aside className="product-story"><span className="tiny-label">A LITTLE HELP, A LOT FURTHER</span><h2>Good questions.<br />Great company.</h2><p>The right perspective can change everything.</p><span><Search size={16} /> Find someone with your topic</span><span><LockKeyhole size={16} /> Connect after acceptance</span><span><CircleCheck size={16} /> Learn and leave feedback</span></aside>
            <div role="tabpanel" id="subject-panel" aria-labelledby={`subject-tab-${active}`} className="subject-panel" tabIndex={0}>
              <div key={active} className="subject-story" style={{ "--subject-color": subject.color } as CSSProperties}><span className="subject-example">EXAMPLE TOPIC / A NEW PERSPECTIVE</span><span className="subject-emblem"><subject.Icon size={35} strokeWidth={1.4} /></span><span className="subject-topic">{subject.topic}</span><h3>{subject.question}</h3><p>{subject.detail}</p><Link href={startHref}>Find your study circle <ArrowUpRight size={15} /></Link></div>
            </div>
          </div>
          <div className="window-bottom"><span><Sparkles size={12} /> A learner and a helper. All in you.</span><span>One topic can start something good <ArrowRight size={12} /></span></div>
        </div>
      </div>
      <div className="subject-showcase">
        <div className="dock-heading"><span className="handwritten">Find your thing ↘</span><p>Different subjects.<br /><strong>Same lightbulb moment.</strong></p><span className="handwritten">Give one a click ↙</span></div>
        <div role="tablist" aria-label="Explore study subjects" className="subject-dock" data-hovering={hovered !== null} onPointerLeave={() => setHovered(null)}>
          {subjects.map(({ name, Icon, color }, index) => <button type="button" role="tab" key={name} ref={el => { buttons.current[index] = el; }} id={`subject-tab-${index}`} aria-controls="subject-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(index); }} onClick={() => setActive(index)} onKeyDown={event => navigate(event, index)} className={active === index ? "is-active" : ""} style={{ "--subject-color": color, "--dock-scale": hovered === null ? 1 : Math.max(1, 1.18 - Math.abs(hovered - index) * .1), "--dock-lift": hovered === null ? "0px" : `${Math.min(0, -12 + Math.abs(hovered - index) * 7)}px` } as CSSProperties}><span className="dock-icon"><Icon strokeWidth={1.6} /></span><span>{name}</span><i /></button>)}
        </div>
        <p className="dock-caption"><span /> Pick a subject to explore how Peerly can help. Your actual study circle starts after sign-in.</p>
      </div>
    </>
  );
}
