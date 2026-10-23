"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, Search, Send, LockKeyhole, Check, BookOpen, ShieldCheck } from "lucide-react";

const steps = [
  { title: "Find your person", text: "Search the topic you're stuck on. Compare subjects, availability and study preferences.", Icon: Search },
  { title: "Start with a question", text: "Send a focused request. Give your peer a little context about what you want to understand.", Icon: Send },
  { title: "Connect on your terms", text: "Your helper accepts first. Then their chosen contact details unlock privately to you.", Icon: LockKeyhole },
  { title: "Learn. Then pass it on.", text: "Both of you confirm completion. Leave an honest review, and help someone with your own strengths.", Icon: BookOpen },
];

export function Workflow() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % steps.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + steps.length - 1) % steps.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = steps.length - 1;
    else return;
    event.preventDefault(); setActive(next); tabs.current[next]?.focus();
  }

  return (
    <div className="workflow-layout">
      <div role="tablist" aria-label="How Peerly works" aria-orientation="vertical" className="workflow-tabs">
        {steps.map(({ title, text }, index) => (
          <button key={title} ref={el => { tabs.current[index] = el; }} type="button" role="tab" id={`workflow-tab-${index}`} aria-controls="workflow-panel" aria-selected={active === index} tabIndex={active === index ? 0 : -1} className={`workflow-tab ${active === index ? "is-active" : ""}`} onClick={() => setActive(index)} onKeyDown={event => navigate(event, index)}>
            <span className="step-number">0{index + 1}</span>
            <span><strong>{title}</strong><span>{text}</span></span>
            <ArrowRight size={17} className="step-arrow" />
          </button>
        ))}
      </div>
      <div role="tabpanel" id="workflow-panel" aria-labelledby={`workflow-tab-${active}`} tabIndex={0} className="workflow-preview">
        <div className="preview-chrome"><span className="preview-dots"><i /><i /><i /></span><span>How a connection happens</span><ShieldCheck size={14} /></div>
        <div key={active} className="preview-content">
          <div className="preview-kicker">{active === 0 ? "DISCOVER YOUR STUDY CIRCLE" : "EXAMPLE STUDY REQUEST"}</div>
          <div className="preview-topic"><span><BookOpen size={20} /></span><div><small>A little clarity on</small><strong>Data structures</strong></div></div>
          {active === 0 && <><div className="preview-search"><Search size={16} /><span>Understanding binary trees</span><span className="keyboard-key">↵</span></div><div className="preview-filters"><span>Online</span><span>Free</span><span>Your topic</span></div><p className="preview-explanation">Find someone whose strengths match what you want to learn.</p></>}
          {active === 1 && <><div className="preview-message">“I understand arrays, but I’m stuck on how to traverse a binary tree. Could we work through an example?”</div><div className="preview-state"><span className="state-dot" /> Pending · your peer decides</div></>}
          {active === 2 && <><div className="preview-state accepted"><Check size={15} /> After your helper accepts</div><div className="preview-contact"><LockKeyhole size={20} /><div><strong>Contact unlocks privately</strong><span>Use the contact method your helper shared.</span></div></div></>}
          {active === 3 && <><div className="completion-row"><span><Check size={14} /> You confirm</span><span><Check size={14} /> Your peer confirms</span></div><div className="preview-contact"><BookOpen size={22} /><div><strong>Leave a helpful review</strong><span>Feedback opens after both confirmations.</span></div></div></>}
          <div className="preview-footer"><span><LockKeyhole size={12} /> Contact stays out of public profiles</span><Link href="/peers" aria-label="Discover peers and start a study request">Find a peer <ArrowRight size={13} /></Link></div>
        </div>
      </div>
    </div>
  );
}
