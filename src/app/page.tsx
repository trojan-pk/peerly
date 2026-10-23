import Link from "next/link";
import { auth } from "@/auth";
import { ArrowRight, ArrowUpRight, LockKeyhole, BookOpen, Sparkles, Check, Plus, Globe2, MapPin, Search, UsersRound, Zap, MoveUpRight } from "lucide-react";
import { Workflow } from "@/components/landing/Workflow";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { ProductStage } from "@/components/landing/ProductStage";
import { ResourceDeck } from "@/components/landing/ResourceDeck";

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
        <div className="aurora-field" aria-hidden="true"><i /><i /><i /><span className="star-field" /><span className="hero-orbit orbit-a" /><span className="hero-orbit orbit-b" /></div>
        <div className="m-hero-copy">
          <span className="m-eyebrow"><Sparkles size={14} /> Your next breakthrough is a conversation away</span>
          <h1 id="hero-title">Big questions.<br /><span>Brighter together.</span><span className="title-spark" aria-hidden="true">✳</span></h1>
          <p>The thing that has you stuck is someone else’s strong suit.<br className="hidden sm:block" /> Meet your university peers. Share a little clarity. Go a lot further.</p>
          <div className="m-hero-actions"><Link href={startHref} className="m-button">{session?.user ? "Open your workspace" : "Find your study circle"}<ArrowUpRight size={18} /></Link><Link href="#how-it-works" className="m-button ghost">See how it works <ArrowRight size={16} /></Link></div>
          <span className="hero-assurance"><Check size={12} /> One account. A learner and a helper.</span>
        </div>
        <ProductStage startHref={startHref} />
      </section>

      <section id="features" className="marketing-zone features-zone" aria-labelledby="features-title"><div className="section-inner landing-section">
        <div className="m-section-heading"><span className="m-kicker"><Zap size={12} /> MADE FOR THE WAY YOU LEARN</span><h2 id="features-title">Your kind of people.<br /><span>Your kind of progress.</span></h2><p>A fresh perspective, a useful resource, a shared “finally, I get it.”<br className="hidden sm:block" /> A little connection can make a big difference.</p></div>
        <div className="m-feature-grid">
          <div className="m-feature feature-discovery"><div><span className="m-feature-icon"><Search size={21} /></span><h3>Skip the spiral.<br />Find your person.</h3><p>Search specific topics, compare study preferences and find a peer whose strengths match your question.</p></div><div className="discovery-orbit" aria-hidden="true"><span className="discovery-ring ring-a" /><span className="discovery-ring ring-b" /><span className="orbit-center"><UsersRound size={32} /></span><span className="orbit-label label-a">Your question</span><span className="orbit-label label-b">Their strength</span><span className="orbit-dot dot-a" /><span className="orbit-dot dot-b" /></div><Link href={startHref} className="m-inline-link">Meet your study circle <ArrowUpRight size={15} /></Link></div>
          <div className="m-feature feature-privacy"><div className="privacy-lock-art" aria-hidden="true"><span /><i /><i /><div><LockKeyhole size={40} strokeWidth={1.2} /></div></div><div><span className="m-small-label">GOOD CONNECTIONS. CLEAR BOUNDARIES.</span><h3>Your details.<br />Your decision.</h3><p>Contact stays private until a helper accepts. No personal contact details in discovery.</p></div></div>
          <div className="m-feature feature-modes"><div><span className="m-small-label">A PLACE THAT WORKS FOR YOU</span><h3>Across campus.<br />Or across a screen.</h3></div><div className="mode-bridge" aria-hidden="true"><span><MapPin size={24} /></span><i /><span><Globe2 size={24} /></span></div><p>Choose online or on-campus study preferences. Arrange the details together after acceptance.</p></div>
          <div className="m-feature feature-give"><div><span className="m-feature-icon"><Sparkles size={21} /></span><h3>You have something<br />to share, too.</h3><p>You don’t need to know everything. Just be the person who makes one thing a little clearer.</p></div><div className="exchange-art" aria-hidden="true"><span>LEARN</span><span className="exchange-arrow">↗</span><span>SHARE</span><span className="exchange-arrow">↙</span></div><Link href={startHref} className="m-inline-link">Share your strengths <ArrowUpRight size={15} /></Link></div>
        </div>
      </div></section>

      <section id="how-it-works" className="marketing-zone workflow-zone" aria-labelledby="workflow-title"><div className="section-inner landing-section"><div className="m-section-heading"><span className="m-kicker"><MoveUpRight size={12} /> ONE QUESTION CAN START SOMETHING GOOD</span><h2 id="workflow-title">From “I’m stuck”<br /><span>to “I get it.”</span></h2><p>Get to know Peerly here. Sign in when you’re ready.<br className="hidden sm:block" /> Your study circle is waiting on the other side.</p></div><Workflow startHref={startHref} /><div className="workflow-signin-note"><LockKeyhole size={13} /> This is how connections work. Your actual requests and resources live in your signed-in workspace.</div></div></section>

      <section id="resources" className="marketing-zone resources-zone" aria-labelledby="resources-title"><div className="section-inner landing-section resource-zone-layout"><div className="resource-zone-copy"><span className="m-kicker"><BookOpen size={13} /> THE GOOD STUFF IS WORTH SHARING</span><h2 id="resources-title">Great notes.<br />New perspectives.<br /><span>Pass them on.</span></h2><p>That explanation you wish you’d found sooner. A problem set that made it click. Useful links from students who’ve been there.</p><p>Find them in your resource hub after signing in—or share something that helped you.</p><Link href={startHref} className="m-button">{session?.user ? "Open your workspace" : "Sign in to explore"}<ArrowUpRight size={18} /></Link><span className="resource-access-note"><LockKeyhole size={11} /> Resources are part of your Peerly workspace.</span></div><ResourceDeck /></div></section>

      <section className="marketing-zone questions-zone" id="questions" aria-labelledby="faq-title"><div className="section-inner landing-section m-faq-layout"><div><span className="m-kicker">A LITTLE MORE CLARITY</span><h2 id="faq-title">Curious?<br /><span>Good. Us too.</span></h2><p>Some answers before<br />your next breakthrough.</p><span className="faq-doodle" aria-hidden="true">?</span></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={17} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="marketing-zone invitation-zone" aria-labelledby="final-title"><div className="invitation-glow" aria-hidden="true" /><div className="section-inner landing-section"><span className="m-kicker"><Sparkles size={13} /> BETTER QUESTIONS. BRIGHTER CONNECTIONS.</span><h2 id="final-title">A little help.<br /><span>A whole new possibility.</span></h2><p>Your next “aha!” might start with hello.</p><Link href={startHref} className="m-button">{session?.user ? "Back to your workspace" : "Let’s find your people"}<ArrowUpRight size={19} /></Link><span className="hero-assurance"><Check size={12} /> Sign in with Google. Start with one question.</span></div></section>
    </LandingMotion>
  );
}
