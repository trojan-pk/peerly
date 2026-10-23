import Link from "next/link";
import { auth } from "@/auth";
import { isDatabaseConfigured, connectToDatabase } from "@/lib/db";
import { User, toPublicProfile } from "@/models/User";
import { PublicUserProfile } from "@/types/user";
import { ArrowRight, ArrowUpRight, Search, LockKeyhole, BookOpen, Sparkles, Check, Plus, Globe2, MapPin } from "lucide-react";
import { StudyNetwork } from "@/components/landing/StudyNetwork";
import { Workflow } from "@/components/landing/Workflow";
import { LandingMotion } from "@/components/landing/LandingMotion";

export const dynamic = "force-dynamic";

async function getRecentPublicPeers(): Promise<{ peers: PublicUserProfile[]; unavailable: boolean }> {
  if (!isDatabaseConfigured()) {
    return { peers: [], unavailable: true };
  }

  try {
    await connectToDatabase();
    // Bounded query limit
    const users = await User.find({
      isProfileComplete: true,
      "moderation.isHidden": { $ne: true },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(6)
      .lean();

    return { peers: users.map((u) => toPublicProfile(u)), unavailable: false };
  } catch (error) {
    console.error("[Home] Error querying recent peers:", error);
    return { peers: [], unavailable: true };
  }
}

const faqs = [
  ["What can I get help with?", "Search for a coursework topic or subject, then explain your question in a study request. Peerly is for learning together: working through concepts, understanding examples and sharing useful resources."],
  ["Can I learn and help other people?", "Absolutely. Your account does both. Add the subjects you're comfortable explaining to your profile, and find other peers when you need a hand."],
  ["Is Peerly free to use?", "You can browse peers, share resource links and send study requests without a platform fee. Helpers indicate whether they prefer free or paid sessions. Peerly does not process payments; discuss any terms directly before meeting."],
  ["When are contact details shared?", "A helper's chosen contact details unlock to the learner only after the helper accepts the request. Your email, WhatsApp number and meeting links never appear in public search results."],
  ["Are study sessions online or on campus?", "Both are possible. Filter by online or campus preferences, agree on a time after acceptance, and use your helper's shared contact method. For in-person sessions, choose a public campus space."],
  ["How do reviews work?", "Both participants must confirm a session is complete before the learner can leave one review. These confirmations are self-reported, not independent proof of attendance."],
];

export default async function HomePage() {
  const [session, recentResult] = await Promise.all([auth(), getRecentPublicPeers()]);
  const offerHref = session?.user ? "/profile" : "/login";

  return (
    <LandingMotion>
      <section className="landing-hero" aria-labelledby="hero-title">
        <div className="hero-ambient" aria-hidden="true" />
        <div className="hero-copy">
          <span className="eyebrow-pill"><span className="small-spark"><Sparkles size={13} /></span> A little help goes a long way <ArrowUpRight size={13} /></span>
          <h1 id="hero-title">Get unstuck.<br /><span>Learn with your people.</span></h1>
          <p>The topic that has you stuck is someone else’s strong suit.<br className="hidden sm:block" /> Find a university peer. Work it out together. Pass it forward.</p>
          <form action="/peers" method="get" className="hero-search" role="search" aria-label="Find a study peer">
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="hero-topic">What do you want to understand?</label>
            <input id="hero-topic" name="q" type="search" maxLength={100} placeholder="What do you want to understand?" autoComplete="off" />
            <button type="submit"><span>Find a peer</span><ArrowRight size={18} aria-hidden="true" /></button>
          </form>
          <div className="hero-topics"><span>A place to start</span>{["Calculus", "Data structures", "Physics"].map(topic => <Link key={topic} href={`/peers?q=${encodeURIComponent(topic)}`}>{topic}<ArrowUpRight size={11} /></Link>)}</div>
          <Link href={offerHref} className="hero-secondary">Good at something? Share what you know <ArrowRight size={13} /></Link>
        </div>
        <StudyNetwork />
        <div className="hero-principles"><span><Search size={14} /> Find help by topic</span><span><LockKeyhole size={14} /> Keep contact private</span><span><BookOpen size={14} /> Learn in both directions</span></div>
      </section>

      <section className="landing-section" id="how-it-works" aria-labelledby="workflow-title">
        <div className="section-heading"><div><span className="section-kicker">01 / BETTER TOGETHER</span><h2 id="workflow-title">From “I’m stuck”<br />to “I get it.”</h2></div><p>No need to figure everything out alone.<br />Start with one question and the right person.</p></div>
        <Workflow />
      </section>

      <section className="landing-section" aria-labelledby="learning-title">
        <div className="section-heading"><div><span className="section-kicker">02 / YOUR WAY TO LEARN</span><h2 id="learning-title">Different strengths.<br /><span className="text-muted">Common ground.</span></h2></div><p>A study circle that fits your subject,<br />your schedule and your way of learning.</p></div>
        <div className="learning-grid">
          <div className="learning-main">
            <span className="section-kicker">START WITH WHAT YOU NEED</span>
            <h3>Big subjects.<br />Small breakthroughs.</h3>
            <p>Find someone who can explain that one concept. Search specific topics, then compare availability and study preferences.</p>
            <div className="subject-cloud">{["Linear algebra", "Python", "Economics", "Chemistry", "Statistics", "Data structures"].map((topic, i) => <Link key={topic} href={`/peers?q=${encodeURIComponent(topic)}`} className={i === 5 ? "featured-subject" : ""}>{topic}<ArrowUpRight size={14} /></Link>)}</div>
            <Link href="/peers" className="text-link">Explore peer discovery <ArrowRight size={15} /></Link>
          </div>
          <div className="learning-side">
            <div className="privacy-feature"><div className="privacy-illustration" aria-hidden="true"><span className="privacy-ring" /><span><LockKeyhole size={26} strokeWidth={1.4} /></span><i /><i /><i /></div><h3>A connection.<br />On your terms.</h3><p>Contact unlocks after acceptance. Your personal details stay out of public profiles.</p></div>
            <div className="study-mode-feature"><span><Globe2 size={19} /> Online</span><span className="mode-divider">or</span><span><MapPin size={19} /> On campus</span><p>Your study session. Your setting.</p></div>
          </div>
        </div>
      </section>

      <section className="landing-section resources-feature" aria-labelledby="resources-title">
        <div className="resource-copy"><span className="section-kicker">03 / KNOWLEDGE WORTH SHARING</span><h2 id="resources-title">Good notes<br />deserve company.</h2><p>A clear explanation. A useful problem set. That link you wish you’d found earlier. Explore resources shared by students, or add your own.</p><Link href="/resources" className="landing-button">Explore study resources <ArrowUpRight size={17} /></Link><span className="resource-footnote">Open to browse. No study request needed.</span></div>
        <div className="resource-art" aria-hidden="true"><div className="resource-orbit" /><div className="note-sheet sheet-back"><span>PASS IT FORWARD</span><BookOpen size={36} strokeWidth={1} /></div><div className="note-sheet sheet-front"><span className="note-badge"><BookOpen size={15} /> A little clarity</span><strong>Everything makes<br />sense eventually.</strong><div className="note-rule" /><span className="note-equation">question + perspective</span><span className="note-answer">= a new understanding.</span><div className="note-bottom"><span>Made to be shared</span><ArrowUpRight size={18} /></div></div><span className="resource-star star-one">✳</span><span className="resource-star star-two">+</span></div>
      </section>

      <section className="landing-section" aria-labelledby="community-title">
        <div className="section-heading"><div><span className="section-kicker">04 / FIND YOUR STUDY CIRCLE</span><h2 id="community-title">Someone gets it.<br />Find them here.</h2></div><Link href="/peers" className="text-link">Browse all peers <ArrowUpRight size={16} /></Link></div>
        {recentResult.peers.length > 0 ? <div className="landing-peers">{recentResult.peers.slice(0, 3).map(peer => <Link href={`/peers/${peer.id}`} key={peer.id} className="landing-peer"><div className="peer-heading"><span className="peer-initial">{peer.name[0]?.toUpperCase() || "P"}</span><ArrowUpRight size={18} /></div><h3>{peer.name}</h3><span>{peer.university || "University student"}</span><p>{peer.bio || "Explore their subjects, availability and study preferences."}</p><div>{peer.topics.slice(0, 3).map(topic => <small key={topic}>{topic}</small>)}</div></Link>)}</div> : <div className="community-invitation"><span className="community-symbol"><Sparkles size={25} /></span><div><h3>{recentResult.unavailable ? "The study circle is taking a moment." : "Every study circle starts with someone."}</h3><p>{recentResult.unavailable ? "We couldn’t load the peer directory. Try discovery again shortly." : "Add your subjects and share what you know. Your next classmate can start with you."}</p></div><Link href={recentResult.unavailable ? "/peers" : offerHref} className="landing-button secondary">{recentResult.unavailable ? "Try discovery" : "Create your profile"}<ArrowRight size={16} /></Link></div>}
      </section>

      <section className="landing-section faq-section" id="questions" aria-labelledby="faq-title"><div><span className="section-kicker">A LITTLE MORE CLARITY</span><h2 id="faq-title">Good questions.<br />Straight answers.</h2><p>Still curious? Here’s how Peerly fits<br className="hidden sm:block" /> into your student life.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={17} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>

      <section className="landing-section final-invitation" aria-labelledby="final-title"><span className="section-kicker">YOUR NEXT BREAKTHROUGH STARTS HERE</span><h2 id="final-title">You don’t have to<br />figure it out <span>alone.</span></h2><div><Link href="/peers" className="landing-button">Find your people <ArrowRight size={18} /></Link><Link href={offerHref} className="text-link">Share your strengths <ArrowUpRight size={16} /></Link></div><p><Check size={13} /> One account. A learner and a helper.</p></section>
    </LandingMotion>
  );
}
