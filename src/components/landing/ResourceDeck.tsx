"use client";

import { useState } from "react";
import { BookOpen, Code2, Sigma, Link2, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const resources = [
  { type: "Notes", topic: "Calculus", title: "The chain rule, step by step", detail: "A concise explanation of composite functions, with two worked examples and common mistakes to check.", Icon: BookOpen, className: "deck-notes", lines: ["Start with the outside function.", "Differentiate the inside function.", "Multiply the two derivatives."], formula: "d/dx f(g(x)) = f′(g(x)) · g′(x)", linkType: "Document link" },
  { type: "Practice", topic: "Data structures", title: "Binary tree traversal exercises", detail: "Trace in-order, pre-order and post-order traversal, then compare your reasoning with the worked solution.", Icon: Sigma, className: "deck-practice", lines: ["Identify the root and its children.", "Write the traversal order.", "Explain why each node comes next."], formula: "In-order: left → root → right", linkType: "Practice worksheet link" },
  { type: "Guides", topic: "Programming", title: "A guide to Python dictionaries", detail: "Learn when to use a dictionary, how to look up values and how to iterate through keys and items.", Icon: Code2, className: "deck-guides", lines: ["Create and update a dictionary.", "Look up a value safely.", "Loop through keys and values."], formula: 'student.get("subject", "Not set")', linkType: "Reference guide link" },
];
export function ResourceDeck({ startHref = "/login" }: { startHref?: string }) {
  const [active, setActive] = useState(0);
  const resource = resources[active];
  return (
    <div className="resource-library-preview">
      <div className="library-preview-header"><span><BookOpen size={18} /> Resource hub</span><span>Illustrative preview</span></div>
      <div className="deck-switcher" aria-label="Choose a resource example">{resources.map(({ type }, index) => <button key={type} type="button" aria-pressed={active === index} onClick={() => setActive(index)}>{type}</button>)}</div>
      <div className={`resource-sample ${resource.className} is-front`} key={active} aria-live="polite"><div className="resource-sample-meta"><span>{resource.topic}</span><span><Link2 size={13} /> {resource.linkType}</span></div><h3>{resource.title}</h3><p>{resource.detail}</p><div className="resource-paper"><span><resource.Icon size={18} /> Inside this example</span><ol>{resource.lines.map(line => <li key={line}>{line}</li>)}</ol><code>{resource.formula}</code></div><div className="resource-example-footer"><span>Example content · links, not file uploads</span><Link href={startHref}>Explore resources <ArrowUpRight size={15} /></Link></div></div>
    </div>
  );
}
