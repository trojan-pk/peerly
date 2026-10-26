import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BadgeCheck, Zap } from "lucide-react";
import { getPublicHelperPage } from "@/lib/helper-page";
import { isDatabaseConfigured } from "@/lib/db";
import { InitialsAvatar } from "@/components/InitialsAvatar";

export const dynamic = "force-dynamic";

const load = cache(async (slug: string) => (isDatabaseConfigured() ? getPublicHelperPage(slug).catch(() => null) : null));

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await load(slug);
  if (!page) return { title: "Page not found — Peerly", robots: { index: false, follow: false } };
  const summary = `${page.completedSessions} completed ${page.completedSessions === 1 ? "session" : "sessions"}${page.reviewCount ? ` · ${page.averageRating.toFixed(1)}★ from ${page.reviewCount} ${page.reviewCount === 1 ? "review" : "reviews"}` : ""}`;
  const title = `${page.name} — Peer helper on Peerly`;
  return {
    title,
    description: summary,
    robots: { index: false, follow: false },
    openGraph: { title, description: summary, type: "profile" },
    twitter: { card: "summary_large_image", title, description: summary },
  };
}

export default async function PublicHelperPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const page = await load(slug);
  if (!page) notFound();
  const since = new Date(page.memberSince).toLocaleDateString("en", { month: "long", year: "numeric" });

  return (
    <article className="helper-page workspace-page" aria-labelledby="helper-name">
      <header className="flex flex-wrap items-center gap-5">
        <InitialsAvatar name={page.name} className="w-20 h-20 rounded-2xl text-2xl" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-accent">Peer helper on Peerly</p>
          <h1 id="helper-name" className="page-title">{page.name}</h1>
          <p className="text-muted">{page.university || "University student"} · Member since {since}</p>
          {page.verifiedUniversityName && (
            <p className="verified-badge !mt-1" title="Confirmed an email address on this university's domain. This doesn't prove current enrolment."><BadgeCheck size={15} aria-hidden="true" />University email verified · {page.verifiedUniversityName}</p>
          )}
        </div>
      </header>

      <dl className="helper-stats">
        <div><dt>Completed sessions</dt><dd className="tabular">{page.completedSessions}</dd></div>
        <div><dt>Average rating</dt><dd className="tabular">{page.reviewCount ? <>{page.averageRating.toFixed(1)}<small>out of 5</small></> : <small>No reviews yet</small>}</dd></div>
        <div><dt>Reviews</dt><dd className="tabular">{page.reviewCount}</dd></div>
        <div><dt>Typical response</dt><dd className="tabular">{page.averageResponse ? <>{page.averageResponse}<small>from {page.responseCount} {page.responseCount === 1 ? "response" : "responses"}</small></> : <small>Not enough data</small>}</dd></div>
      </dl>
      {page.hasFastReplyBadge && <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent"><Zap size={16} aria-hidden="true" />Fast responder — at least 3 responses averaging 2 hours or less</p>}

      {page.courseCodes.length > 0 && (
        <section className="mt-10 space-y-3" aria-labelledby="helper-courses"><h2 id="helper-courses" className="text-lg font-semibold text-ink">Courses</h2><ul className="course-chips">{page.courseCodes.map((c) => <li key={c} className="tabular">{c}</li>)}</ul></section>
      )}
      {page.topics.length > 0 && (
        <section className="mt-8 space-y-3" aria-labelledby="helper-topics"><h2 id="helper-topics" className="text-lg font-semibold text-ink">Topics they help with</h2><ul className="flex flex-wrap gap-2">{page.topics.map((t) => <li key={t} className="ui-badge is-neutral">{t}</li>)}</ul></section>
      )}

      <footer className="mt-12 border-t border-line pt-6 space-y-3 text-sm text-muted">
        <p>Numbers come from sessions on Peerly where both people confirmed the session took place. Confirmations are self-reported. Ratings come only from those sessions.</p>
        <Link href="/login" className="ui-button is-primary is-md">Ask {page.name.split(/\s+/)[0]} for help on Peerly</Link>
      </footer>
    </article>
  );
}
