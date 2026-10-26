"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Clock, Search, Send, Star, Unlock } from "lucide-react";

interface Step { title: string; body: string; preview: ReactNode }

function MiniPeer() {
  return (
    <div className="mini-card">
      <div className="mini-head"><span className="mini-avatar" aria-hidden="true">SK</span><div><strong>Sara K.</strong><span>Took CS-101 · replies within 2 h</span></div></div>
      <ul className="mini-reasons">
        <li><CheckCircle2 size={14} aria-hidden="true" />Helps with “Recursion”</li>
        <li><CheckCircle2 size={14} aria-hidden="true" />Online sessions</li>
        <li><CheckCircle2 size={14} aria-hidden="true" />Evenings after 6 PM</li>
      </ul>
    </div>
  );
}

const STEPS: Step[] = [
  {
    title: "Find someone who took the course",
    body: "Search by topic or subject. Match points come from what helpers list, how they prefer to meet and their real reviews — no invented ratings.",
    preview: <><div className="mini-search"><Search size={15} aria-hidden="true" />recursion<span className="tabular">3 helpers</span></div><MiniPeer /></>,
  },
  {
    title: "Send one focused question",
    body: "Say what you’re stuck on, choose Normal or Urgent and add your deadline. Urgent requests are shown to the helper first.",
    preview: <div className="mini-card"><div className="mini-row"><span className="ui-badge is-danger">Urgent</span><span className="mini-time tabular"><Clock size={13} aria-hidden="true" />Needed by 11:00 PM</span></div><strong className="mini-title">Recursion in C++</strong><p>My merge sort overflows the stack on large inputs.</p><span className="mini-action"><Send size={14} aria-hidden="true" />Send request</span></div>,
  },
  {
    title: "They accept — contact unlocks",
    body: "The helper gets a bell notification (and an email if they turned it on). If nobody answers in time, the request closes so you can ask someone else.",
    preview: <div className="mini-card is-success"><div className="mini-row"><span className="ui-badge is-success"><CheckCircle2 aria-hidden="true" />Accepted</span></div><div className="mini-unlock"><Unlock size={16} aria-hidden="true" /><span><strong>Contact unlocked</strong>Only you can see Sara’s chosen contact.</span></div></div>,
  },
  {
    title: "Meet, then both confirm",
    body: "After you both confirm the session happened, you can leave one honest review. That’s the only way ratings are made.",
    preview: <div className="mini-card"><div className="mini-row"><span className="ui-badge is-success">You confirmed</span><span className="ui-badge is-success">Sara confirmed</span></div><div className="mini-stars" aria-label="Five-star review example">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={18} aria-hidden="true" />)}</div><p>“Walked me through the base case until it clicked.”</p></div>,
  },
];

/**
 * Scroll-linked walkthrough without scroll hijacking: steps scroll normally and the
 * sticky preview shows whichever step is in the middle of the viewport. Steps are
 * also buttons, so keyboard and screen-reader users choose a step directly. On small
 * screens each step shows its own preview inline.
 */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const refs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="how-layout">
      <ol className="how-steps">
        {STEPS.map((step, index) => (
          <li key={step.title} ref={(el) => { refs.current[index] = el; }} data-step={index} className={index === active ? "is-active" : ""}>
            <button type="button" aria-pressed={index === active} aria-controls="how-preview" onClick={() => setActive(index)}>
              <span className="how-number tabular" aria-hidden="true">0{index + 1}</span>
              <span className="how-title">{step.title}</span>
            </button>
            <p>{step.body}</p>
            <div className="how-inline-preview" aria-hidden="true">{step.preview}</div>
          </li>
        ))}
      </ol>
      <div className="how-sticky">
        <div id="how-preview" className="how-preview" role="region" aria-label={`Example for step ${active + 1}: ${STEPS[active].title}`} data-active-step={active + 1}>
          <span className="hero-scene-label">Illustrative example · Step {active + 1} of {STEPS.length}</span>
          <div key={active} className="how-preview-body">{STEPS[active].preview}</div>
        </div>
      </div>
    </div>
  );
}
