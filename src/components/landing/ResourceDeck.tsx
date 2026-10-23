"use client";

import { useState } from "react";
import { BookOpen, Code2, Sigma, ArrowUpRight } from "lucide-react";

const resources = [
  { type: "Notes", tag: "CLEARER CONCEPTS", title: "That explanation\nthat makes it click.", detail: "Student-shared notes and useful reference links.", Icon: BookOpen, className: "deck-notes" },
  { type: "Practice", tag: "ONE MORE ‘AHA!’", title: "A fresh problem.\nA new perspective.", detail: "Practice material to work through at your own pace.", Icon: Sigma, className: "deck-practice" },
  { type: "Guides", tag: "FIND YOUR WAY", title: "Big subjects.\nA clearer path.", detail: "Study guides and references, shared by your peers.", Icon: Code2, className: "deck-guides" },
];

export function ResourceDeck() {
  const [active, setActive] = useState(0);
  return (
    <div className="resource-deck-showcase">
      <div className="resource-deck" aria-label="Examples of resources students can share">
        <span className="deck-spark spark-a" aria-hidden="true">✳</span><span className="deck-spark spark-b" aria-hidden="true">✧</span>
        {resources.map(({ type, tag, title, detail, Icon, className }, index) => <button key={type} type="button" aria-pressed={active === index} aria-label={`Show ${type.toLowerCase()} examples`} onClick={() => setActive(index)} className={`deck-card ${className} ${active === index ? "is-front" : ""}`} style={{ zIndex: active === index ? 4 : index + 1 }}><span className="deck-card-top"><Icon size={24} /><span>{type}</span><ArrowUpRight size={19} /></span><span className="deck-tag">{tag}</span><strong>{title}</strong><span className="deck-description">{detail}</span><span className="deck-card-bottom">An example of what’s worth sharing <Icon size={17} /></span></button>)}
      </div>
      <div className="deck-switcher" aria-label="Choose a resource example">{resources.map(({ type }, index) => <button key={type} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{type}</button>)}</div>
    </div>
  );
}
