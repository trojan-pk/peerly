import Link from "next/link";
import { auth } from "@/auth";
import { ArrowUpRight, LockKeyhole, BookOpen, Check, Plus, ArrowRight } from "lucide-react";
import { Workflow } from "@/components/landing/Workflow";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { ProductStage } from "@/components/landing/ProductStage";
import { ResourceDeck } from "@/components/landing/ResourceDeck";
import { FeatureStories } from "@/components/landing/FeatureStories";

export const dynamic = "force-dynamic";

const faqs = [
  ["How do I get started?", "Sign in with Google, add your university, subjects and availability, then explore your workspace. One account lets you ask for help, offer it and share resource links."],
  ["Can I learn and help other people?", "Absolutely. Add the topics you're comfortable explaining to your profile, and find other peers when you need a hand. Your account does both."],
  ["Is Peerly free to use?", "After signing in, you can explore peers, share resource links and send study requests without a platform fee. Helpers indicate whether they prefer free or paid sessions. Peerly does not process payments; agree on any terms directly before meeting."],
  ["When are contact details shared?", "A helper's chosen contact details unlock to the learner only after the helper accepts the request. Your email, WhatsApp number and meeting links never appear in search results or profile listings."],
  ["Are study sessions online or on campus?", "Both are possible. Filter by study preference, agree on a time after acceptance, and use your helper's shared contact method. For in-person sessions, choose a public campus space."],
  ["How do reviews work?", "Both participants must confirm a session is complete before the learner can leave one review. These confirmations are self-reported, not independent proof of attendance."],
];

export default async function HomePage() {
  const session = await auth();
  const startHref = session?.user?.id ? "/dashboard" : "/login";
  return (
    <LandingMotion>
      <section className="m-hero" aria-labelledby="hero-title">
        <div className="aurora-field" aria-hidden="true"><i /><i /></div>
        <div className="hero-layout">
          <div className="m-hero-copy">
            <span className="m-eyebrow"><span className="connection-mark" aria-hidden="true" /> UNIVERSITY PEERS. SHARED UNDERSTANDING.</span>
            <h1 id="hero-title">Study help.<br />From peers who<br /><span className="hero-gradient">get your topic.</span></h1>
            <p>Find a university peer who can explain what has you stuck. Send a focused request, connect after they accept, and work through it together.</p>
            <div className="m-hero-actions"><Link href={startHref} className="m-button">{session?.user ? "Open your workspace" : "Find your study circle"}<ArrowUpRight size={18} /></Link><Link href="#how-it-works" className="hero-secondary-link">How it works <ArrowRight size={16} /></Link></div>
            <span className="hero-assurance"><Check size={15} /> One account to ask for help and offer it.</span>
            <div className="hero-connection-legend" aria-label="Connection process"><span><b>01</b> Find a topic</span><i /><span><b>02</b> Send a request</span><i /><span><b>03</b> Connect</span></div>
          </div>
          <ProductStage startHref={startHref} />
        </div>
      </section>

      <section id="features" className="marketing-zone features-zone" aria-labelledby="features-title"><div className="section-inner landing-section">
        <div className="m-section-heading"><span className="m-kicker">BUILT AROUND THE CONNECTION</span><h2 id="features-title">Ask clearly.<br /><span>Connect comfortably.</span></h2><p>A useful study session starts with the right topic,<br className="hidden sm:block" /> a willing peer and a little context.</p></div>
        <FeatureStories startHref={startHref} />
      </div></section>

      <section id="how-it-works" className="marketing-zone workflow-zone" aria-labelledby="workflow-title"><div className="section-inner landing-section"><div className="m-section-heading"><span className="m-kicker">HOW PEERLY WORKS</span><h2 id="workflow-title">One question.<br /><span>Four clear steps.</span></h2><p>Explore the path from finding a peer to completing a session.</p></div><Workflow startHref={startHref} /><div className="workflow-signin-note"><LockKeyhole size={15} /> Illustrative workflow. Manage your actual requests in your signed-in workspace.</div></div></section>

      <section id="resources" className="marketing-zone resources-zone" aria-labelledby="resources-title"><div className="section-inner landing-section resource-zone-layout"><div className="resource-zone-copy"><span className="m-kicker"><BookOpen size={15} /> THE RESOURCE HUB</span><h2 id="resources-title">An explanation<br />worth keeping.<br /><span>A link worth sharing.</span></h2><p>Browse student-shared links by topic. Find a set of notes, a practice worksheet or a guide—or share a resource that helped you understand.</p><Link href={startHref} className="m-button">{session?.user ? "Open your workspace" : "Sign in to explore"}<ArrowUpRight size={18} /></Link><span className="resource-access-note"><LockKeyhole size={14} /> Your resource hub is inside your workspace.</span></div><ResourceDeck startHref={startHref} /></div></section>

      <section className="marketing-zone questions-zone" id="questions" aria-labelledby="faq-title"><div className="section-inner landing-section m-faq-layout"><div><span className="m-kicker">BEFORE YOU JOIN</span><h2 id="faq-title">A few useful<br /><span>answers.</span></h2><p>Accounts, sessions and privacy.<br />Here’s what to expect.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={18} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="marketing-zone invitation-zone" aria-labelledby="final-title"><div className="invitation-glow" aria-hidden="true" /><div className="section-inner landing-section"><span className="connection-mark" aria-hidden="true" /><h2 id="final-title">What are you<br /><span>working through?</span></h2><p>Start with a topic. Find a peer who can help.</p><Link href={startHref} className="m-button">{session?.user ? "Back to your workspace" : "Get started with Google"}<ArrowUpRight size={19} /></Link><span className="hero-assurance"><Check size={15} /> Set up your profile after signing in.</span></div></section>
    </LandingMotion>
  );
}
