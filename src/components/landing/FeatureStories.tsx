"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LockKeyhole, Check, Globe2, MapPin, ArrowRight, BookOpen, MessageSquare } from "lucide-react";

export function FeatureStories({ startHref }: { startHref: string }) {
  const [accepted, setAccepted] = useState(false);
  const [campus, setCampus] = useState(false);
  return (
    <div className="feature-stories">
      <article className="m-feature acceptance-feature">
        <div className="feature-editorial"><span className="m-feature-icon"><LockKeyhole size={22} /></span><span className="editorial-label">01 / CONNECTION BY CHOICE</span><h3>A focused request.<br />A clear boundary.</h3><p>Tell a peer what you need help with. Their chosen contact details unlock to you only after they accept.</p><Link href={startHref} className="m-inline-link">Start a study request <ArrowUpRight size={16} /></Link></div>
        <div className="acceptance-scene">
          <div className="scene-heading"><span>Example request</span><span className={`scene-status ${accepted ? "accepted" : ""}`}>{accepted ? "Accepted" : "Pending"}</span></div>
          <h4>Understanding binary trees</h4><p className="request-excerpt">“Could we work through an example of in-order traversal? I understand arrays, but trees haven’t clicked yet.”</p>
          <div className="acceptance-track" data-accepted={accepted}><span><Check size={14} /> Request sent</span><i /><span>{accepted ? <Check size={14} /> : <LockKeyhole size={14} />} Helper accepts</span></div>
          <div className="contact-boundary" data-accepted={accepted} aria-live="polite"><span className="contact-symbol">{accepted ? <Check size={20} /> : <LockKeyhole size={20} />}</span><div><strong>{accepted ? "Contact unlocks privately" : "Contact stays private"}</strong><p>{accepted ? "The requesting learner can now access the helper’s shared contact method." : "The learner cannot access contact details while a request is pending."}</p></div></div>
          <div className="acceptance-controls" aria-label="Explore contact privacy"><button type="button" aria-pressed={!accepted} aria-label="Before acceptance" onClick={() => setAccepted(false)}>Pending request</button><button type="button" aria-pressed={accepted} aria-label="After acceptance" onClick={() => setAccepted(true)}>Accepted request</button></div>
          <span className="scene-footnote">A workflow example. No real request is sent.</span>
        </div>
      </article>
      <div className="supporting-stories">
        <article className="mode-story"><span className="editorial-label">02 / WHERE YOU LEARN</span><h3>A screen or a campus table.</h3><p>Choose a study preference, then agree on a time and place together.</p><div className="mode-selector" aria-label="Explore study preferences"><button type="button" aria-pressed={!campus} onClick={() => setCampus(false)}><Globe2 size={18} />Online</button><button type="button" aria-pressed={campus} onClick={() => setCampus(true)}><MapPin size={18} />On campus</button></div><p className="mode-description" aria-live="polite">{campus ? "Meet in a public campus space, such as a library or study area." : "Use the meeting link or contact method your helper shares after accepting."}</p></article>
        <article className="exchange-story"><span className="editorial-label">03 / ONE ACCOUNT, BOTH SIDES</span><h3>Ask about one topic.<br />Help with another.</h3><p>Your profile is a place to share your strengths. Your requests are a place to work on the rest.</p><div className="exchange-path"><span><MessageSquare size={18} /> Ask for help</span><ArrowRight size={18} /><span><BookOpen size={18} /> Share a strength</span></div><Link href={startHref} className="m-inline-link">Build your study profile <ArrowUpRight size={16} /></Link></article>
      </div>
    </div>
  );
}
