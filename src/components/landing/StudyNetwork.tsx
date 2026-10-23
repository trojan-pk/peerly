import { BookOpen, Code2, Sigma, Atom, ArrowUpRight, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const topics = [
  { name: "Mathematics", detail: "Make it click.", Icon: Sigma, className: "topic-math" },
  { name: "Computer science", detail: "Connect the dots.", Icon: Code2, className: "topic-code" },
  { name: "Physics", detail: "Find your momentum.", Icon: Atom, className: "topic-physics" },
  { name: "Shared notes", detail: "Pass it forward.", Icon: BookOpen, className: "topic-notes" },
];

export function StudyNetwork() {
  return (
    <div className="study-network" role="img" aria-label="Mathematics, computer science, physics and shared notes connect through Peerly. Learning works better together.">
      <div className="network-grid" />
      <div className="network-halo" />
      <svg className="network-lines" viewBox="0 0 1120 420" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="connection-gradient"><stop stopColor="#88edb4" stopOpacity=".05" /><stop offset=".5" stopColor="#88edb4" stopOpacity=".7" /><stop offset="1" stopColor="#88edb4" stopOpacity=".05" /></linearGradient>
        </defs>
        {[
          "M160 110H290Q330 110 330 150V190Q330 210 370 210H560",
          "M960 110H830Q790 110 790 150V190Q790 210 750 210H560",
          "M200 320H300Q340 320 340 280V250Q340 210 380 210H560",
          "M920 320H820Q780 320 780 280V250Q780 210 740 210H560",
        ].map((d, index) => <g key={d}><path d={d} stroke="url(#connection-gradient)" /><path className={`connection-pulse pulse-${index}`} d={d} stroke="#9af4bc" strokeWidth="2" strokeDasharray="7 500" /></g>)}
      </svg>
      <div className="network-orbit orbit-one" /><div className="network-orbit orbit-two" />
      {topics.map(({ name, detail, Icon, className }) => (
        <div key={name} className={`network-topic ${className}`}>
          <span className="topic-icon"><Icon size={20} strokeWidth={1.5} /></span>
          <span><strong>{name}</strong><small>{detail}</small></span>
          <ArrowUpRight size={14} className="topic-arrow" />
        </div>
      ))}
      <div className="network-center">
        <span className="network-brand"><BrandMark /></span>
        <span className="network-center-label">A little help.</span>
        <strong>A big difference.</strong>
        <span className="network-center-caption"><Sparkles size={12} /> Your people. Your next breakthrough.</span>
      </div>
      <div className="network-caption"><span /> Different strengths. One study circle.</div>
    </div>
  );
}
