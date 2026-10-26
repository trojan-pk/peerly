import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { ArrowRight, BellRing, BookOpen, Clock, ExternalLink, FileText, GraduationCap, HandHeart, MessagesSquare, ShieldCheck, Sparkles, Star, TimerOff } from "lucide-react";
import { HeroScene } from "@/components/landing/HeroScene";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PrivacyReveal } from "@/components/landing/PrivacyReveal";

export const dynamic = "force-dynamic";

const PROBLEMS = [
  { Icon: Clock, title: "Office hours were yesterday", body: "The TA replies on Monday. Your deadline is tonight." },
  { Icon: MessagesSquare, title: "The group chat has 400 unread messages", body: "Your question scrolls away under memes and “same”." },
  { Icon: Sparkles, title: "The AI answer doesn’t fit your course", body: "It compiles somewhere — just not with the setup your instructor uses." },
];

const FAQS: Array<[string, string]> = [
  ["Is Peerly free?", "There’s no platform fee. Helpers say whether they help for free, prefer paid sessions, or either. Peerly doesn’t process payments — agree on any terms directly before you meet."],
  ["How fast will someone answer?", "That depends on the helper. Urgent requests are shown to them first, the bell updates within about a minute, and helpers can turn on email alerts. If nobody responds within 6 hours (urgent), 3 days (normal) or your deadline, the request closes so you can try someone else."],
  ["When are contact details shared?", "Only after a helper accepts your request, and only with you. Search results, profiles, notifications and emails never include phone numbers, meeting links or email addresses."],
  ["Can I learn and help with the same account?", "Yes. List the topics you can explain and you’ll receive requests for them; search for help whenever you need it."],
  ["Are sessions online or on campus?", "Either. Helpers set what they offer and you pick when you send the request. For in-person sessions, meet in a public campus space."],
  ["How do reviews work?", "Both people confirm the session happened, then the learner can leave one review. Ratings and response badges are calculated from real sessions only. Confirmations are self-reported, not proof of attendance."],
];

/**
 * Calls to action keep identical labels for visitors and members; only the
 * destination changes. The page itself does not wait for the session, so it
 * renders immediately (no loading skeleton or layout shift) and the links are
 * filled in when the session check resolves.
 */
async function SessionLink({ member, visitor, className, children }: { member: string; visitor: string; className: string; children: React.ReactNode }) {
  const session = await auth();
  return <Link href={session?.user?.id ? member : visitor} className={className}>{children}</Link>;
}

function StartLink({ member = "/dashboard", className = "ui-button is-primary is-lg", children }: { member?: string; className?: string; children: React.ReactNode }) {
  const link = <Link href="/login" className={className}>{children}</Link>;
  return <Suspense fallback={link}><SessionLink member={member} visitor="/login" className={className}>{children}</SessionLink></Suspense>;
}

export default function HomePage() {
  return (
    <div className="landing">
      <section className="lp-hero" aria-labelledby="hero-title">
        <div className="lp-inner lp-hero-grid">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow"><GraduationCap size={16} aria-hidden="true" />Peer help for university students</p>
            <h1 id="hero-title" className="lp-display">Assignment due in three hours? Ask someone who’s <span className="highlight-mark" data-draw>already solved it.</span></h1>
            <p className="lp-lead">Peerly connects you with students who’ve taken your course. Send one focused question, mark it urgent, and get a clear yes or no. Contact details unlock only when they accept.</p>
            <div className="lp-actions">
              <StartLink>Get help now<ArrowRight size={18} aria-hidden="true" /></StartLink>
              <StartLink member="/settings" className="ui-button is-secondary is-lg">Offer help</StartLink>
            </div>
            <p className="lp-assurance"><ShieldCheck size={16} aria-hidden="true" />No platform fees. Sign in with Google.</p>
          </div>
          <HeroScene />
        </div>
      </section>

      <section id="problem" className="lp-section" aria-labelledby="problem-title">
        <div className="lp-inner">
          <p className="lp-kicker tabular">11:04 PM</p>
          <h2 id="problem-title" className="lp-heading">Being stuck is normal. <span className="lp-muted">Staying stuck shouldn’t be.</span></h2>
          <ul className="lp-problems">
            {PROBLEMS.map(({ Icon, title, body }) => (
              <li key={title}><span className="lp-icon" aria-hidden="true"><Icon size={20} /></span><h3>{title}</h3><p>{body}</p></li>
            ))}
          </ul>
          <p className="lp-answer">Peerly gives you <strong>someone in your course</strong>, a <strong>clear yes or no</strong>, and a <strong>deadline you both can see</strong>.</p>
        </div>
      </section>

      <section id="how-it-works" className="lp-section lp-band" aria-labelledby="how-title">
        <div className="lp-inner">
          <p className="lp-kicker">How it works</p>
          <h2 id="how-title" className="lp-heading">From stuck to sorted in four steps.</h2>
          <HowItWorks />
        </div>
      </section>

      <section id="privacy" className="lp-section" aria-labelledby="privacy-title">
        <div className="lp-inner lp-split">
          <div>
            <p className="lp-kicker">Privacy</p>
            <h2 id="privacy-title" className="lp-heading">Your number isn’t a public profile field.</h2>
            <p className="lp-body">Helpers add a WhatsApp number or meeting link privately. It’s shared with one person — the learner whose request they accepted — and nobody else. Declined, cancelled and expired requests never reveal it.</p>
            <ul className="lp-checks">
              <li><TimerOff size={17} aria-hidden="true" />Unanswered requests close automatically</li>
              <li><BellRing size={17} aria-hidden="true" />Notifications carry a first name and topic only</li>
            </ul>
          </div>
          <PrivacyReveal />
        </div>
      </section>

      <section id="resources" className="lp-section lp-band" aria-labelledby="resources-title">
        <div className="lp-inner lp-split">
          <div>
            <p className="lp-kicker">Resources</p>
            <h2 id="resources-title" className="lp-heading">Notes from people who sat the same exam.</h2>
            <p className="lp-body">Students share links to notes, worked problems and guides they made or have permission to share, organised by topic. Peerly stores links, not files, and anyone can report a link that shouldn’t be there.</p>
          </div>
          <article className="lp-resource" aria-label="Example resource">
            <div className="lp-resource-top"><span className="hero-scene-label">Illustrative example</span><span className="ui-badge is-accent"><FileText aria-hidden="true" />Notes</span></div>
            <h3>Recursion: base cases and the call stack</h3>
            <p>Hand-drawn stack diagrams for factorial, Fibonacci and merge sort, plus the three mistakes that cause stack overflows.</p>
            <ol>
              <li>Write the base case before the recursive call</li>
              <li>Trace the stack for n = 3 by hand</li>
              <li>Check every call moves toward the base case</li>
            </ol>
            <div className="lp-resource-foot"><span><BookOpen size={15} aria-hidden="true" />Topic: Recursion</span><span><ExternalLink size={15} aria-hidden="true" />Google Drive link</span></div>
          </article>
        </div>
      </section>

      <section id="helpers" className="lp-section" aria-labelledby="helpers-title">
        <div className="lp-inner">
          <p className="lp-kicker">For helpers</p>
          <h2 id="helpers-title" className="lp-heading">Explaining it is how you finally remember it.</h2>
          <div className="lp-helper-grid">
            <div><span className="lp-icon" aria-hidden="true"><HandHeart size={20} /></span><h3>Help on your terms</h3><p>List the topics you’re confident in, set your availability and decline anything that doesn’t fit. Free, paid or either — you decide.</p></div>
            <div><span className="lp-icon" aria-hidden="true"><Star size={20} /></span><h3>A reputation that’s real</h3><p>Ratings come only from completed sessions. The fast-reply badge needs at least three responses averaging two hours or less.</p></div>
            <div><span className="lp-icon" aria-hidden="true"><BellRing size={20} /></span><h3>Never miss an urgent ask</h3><p>Urgent requests come first with a countdown, and optional email alerts reach you when you’re away from the tab.</p></div>
          </div>
        </div>
      </section>

      <section id="questions" className="lp-section lp-band" aria-labelledby="faq-title">
        <div className="lp-inner lp-faq">
          <div>
            <p className="lp-kicker">Questions</p>
            <h2 id="faq-title" className="lp-heading">Before you sign in.</h2>
          </div>
          <div className="lp-faq-list">
            {FAQS.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section lp-final" aria-labelledby="final-title">
        <div className="lp-inner">
          <h2 id="final-title" className="lp-display is-final">What are you stuck on <span className="highlight-mark">right now?</span></h2>
          <div className="lp-actions is-centered">
            <StartLink>Start with your question<ArrowRight size={18} aria-hidden="true" /></StartLink>
          </div>
          <p className="lp-assurance is-centered">Sign in with Google, then set up your profile. Already a member? This takes you to your workspace.</p>
        </div>
      </section>
    </div>
  );
}
