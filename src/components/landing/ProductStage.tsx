"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Sigma, Code2, Atom, FlaskConical, ChartNoAxesCombined, BookOpen, ArrowUpRight, Search, Check, Clock3, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const subjects = [
  { name: "Mathematics", Icon: Sigma, topic: "Linear algebra", question: "Eigenvectors and eigenvalues", skill: "Matrix transformations", availability: "Weekday evenings" },
  { name: "Programming", Icon: Code2, topic: "Data structures", question: "Understanding binary trees", skill: "Tree traversal", availability: "Weekend afternoons" },
  { name: "Physics", Icon: Atom, topic: "Mechanics", question: "Drawing a free-body diagram", skill: "Newton’s laws", availability: "After lectures" },
  { name: "Chemistry", Icon: FlaskConical, topic: "Organic chemistry", question: "Understanding reaction mechanisms", skill: "Reaction pathways", availability: "Weekday evenings" },
  { name: "Economics", Icon: ChartNoAxesCombined, topic: "Microeconomics", question: "Price elasticity of demand", skill: "Supply and demand", availability: "Weekend mornings" },
  { name: "Shared notes", Icon: BookOpen, topic: "Calculus", question: "Finding a chain rule explanation", skill: "Worked examples", availability: "By arrangement" },
];

export function ProductStage({ startHref }: { startHref: string }) {
  const [active, setActive] = useState(1);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const subject = subjects[active];
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
    <div className="discovery-studio">
      <div className="studio-toolbar"><span><BrandMark className="brand-symbol" /> Peer discovery</span><span className="example-label">Illustrative preview</span></div>
      <div className="studio-content">
        <div className="studio-section-label">Choose a subject to see an example</div>
        <div role="tablist" aria-label="Explore study subjects" className="studio-subjects">
          {subjects.map(({ name, Icon }, index) => <button type="button" role="tab" key={name} ref={el => { buttons.current[index] = el; }} id={`subject-tab-${index}`} aria-controls="subject-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} onClick={() => setActive(index)} onKeyDown={event => navigate(event, index)}><Icon size={16} />{name}</button>)}
        </div>
        <div role="tabpanel" id="subject-panel" aria-labelledby={`subject-tab-${active}`} tabIndex={0} className="studio-results">
          <div className="studio-search"><Search size={18} /><span key={active}>{subject.question}</span></div>
          <div className="studio-query-meta"><span>{subject.topic}</span><span>Online</span><span>Free preference</span></div>
          <div className="connection-track" aria-hidden="true" key={`track-${active}`}><span /><i /><span /></div>
          <div className="example-peer" key={`peer-${active}`}>
            <div className="example-peer-heading"><span className="example-peer-avatar"><UsersRound size={25} /></span><div><span>Example helper profile</span><h3>{subject.topic} study partner</h3></div></div>
            <div className="example-peer-skills"><span>{subject.topic}</span><span>{subject.skill}</span></div>
            <div className="match-reasons"><span><Check size={14} /> Offers help with this topic</span><span><Check size={14} /> Open to online, free sessions</span></div>
            <div className="example-availability"><Clock3 size={14} /><span>Example availability: {subject.availability}</span></div>
          </div>
        </div>
        <Link href={startHref} className="studio-action">Find peers in your workspace <ArrowUpRight size={17} /></Link>
        <p className="studio-disclaimer">Example content to explain discovery. Sign in to see actual peer profiles.</p>
      </div>
    </div>
  );
}
