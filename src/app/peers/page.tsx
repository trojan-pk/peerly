import Link from "next/link";
import { Search, AlertCircle, AlertTriangle, ArrowRight, Clock, ChevronLeft, ChevronRight, User as UserIcon, Zap } from "lucide-react";
import { auth } from "@/auth";
import { queryPeers } from "@/lib/peers";
import PeerFilters from "./PeerFilters";

export const dynamic = "force-dynamic";

interface PeersPageProps {
  searchParams: Promise<{
    q?: string;
    topic?: string;
    subject?: string;
    mode?: string;
    pricing?: string;
    page?: string;
  }>;
}

export default async function PeersPage(props: PeersPageProps) {
  const searchParams = await props.searchParams;
  const session = await auth();

  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const topic = typeof searchParams.topic === "string" ? searchParams.topic : undefined;
  const subject = typeof searchParams.subject === "string" ? searchParams.subject : undefined;
  const mode = typeof searchParams.mode === "string" ? searchParams.mode : undefined;
  const pricing = typeof searchParams.pricing === "string" ? searchParams.pricing : undefined;
  const page = typeof searchParams.page === "string" ? searchParams.page : undefined;

  const result = await queryPeers({ q, topic, subject, mode, pricing, page });

  const buildPaginationUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (topic) params.set("topic", topic);
    if (subject) params.set("subject", subject);
    if (mode) params.set("mode", mode);
    if (pricing) params.set("pricing", pricing);
    params.set("page", String(newPage));
    return `/peers?${params.toString()}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6">
      <div className="space-y-2 border-b border-stone-200/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Discover Peer Helpers
        </h1>
        <p className="text-sm text-stone-600">
          Find classmates and peer tutors offering coursework assistance, problem-solving, and study sessions.
        </p>
      </div>

      {/* Render filters if database is available */}
      {result.state !== "unconfigured" && result.state !== "error" && result.state !== "database_empty" && (
        <PeerFilters
          availableTopics={result.availableTopics}
          availableSubjects={result.availableSubjects}
        />
      )}

      {/* State 1: Active peer helpers matching query */}
      {result.state === "success" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <span>
              Showing {result.peers.length} of {result.pagination.totalCount} peer helper
              {result.pagination.totalCount === 1 ? "" : "s"}
            </span>
            <span>
              Page {result.pagination.page} of {result.pagination.totalPages}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {result.peers.map((peer) => (
              <article
                key={peer.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 space-y-4 shadow-xs hover:border-emerald-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {peer.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={peer.image}
                          alt=""
                          className="w-11 h-11 rounded-full object-cover border border-stone-200"
                          aria-hidden="true"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                          {peer.name[0]?.toUpperCase() || "P"}
                        </div>
                      )}
                      <div>
                        <h2 className="text-sm font-bold text-stone-900">{peer.name}</h2>
                        <p className="text-xs text-stone-500">
                          {peer.university || "University Student"}
                        </p>
                      </div>
                    </div>

                    {/* Review & Fast-Reply Badges */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {peer.reviewCount === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          New
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          ★ {peer.averageRating.toFixed(1)} ({peer.reviewCount})
                        </span>
                      )}

                      {peer.hasFastReplyBadge && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200"
                          title={`Fast responder: based on ${peer.responseCount} responses (averages <= 2h)`}
                          aria-label={`Fast responder badge: ${peer.responseCount} responses averaging under 2 hours`}
                        >
                          <Zap className="w-2.5 h-2.5 text-teal-600 fill-teal-600" aria-hidden="true" />
                          Fast reply
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Deterministic Match Score Breakdown (Shown when search/topic is supplied) */}
                  {typeof peer.matchScore === "number" && (
                    <div className="rounded-xl bg-stone-50/90 p-2.5 border border-stone-200/80 space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-900">
                        <span className="text-emerald-800 font-bold">
                          Match score: {peer.matchScore}/100
                        </span>
                        {peer.matchScore >= 70 ? (
                          <span className="text-[10px] text-emerald-700 font-semibold">High match</span>
                        ) : (
                          <span className="text-[10px] text-stone-500 font-normal">Relevant</span>
                        )}
                      </div>
                      {peer.matchBreakdown && (
                        <div className="text-[11px] text-stone-600 flex flex-wrap gap-x-2 gap-y-0.5">
                          {peer.matchBreakdown.topicPoints > 0 && (
                            <span className="text-emerald-700">Topic: +{peer.matchBreakdown.topicPoints}</span>
                          )}
                          {peer.matchBreakdown.modePoints > 0 && (
                            <span>Mode: +{peer.matchBreakdown.modePoints}</span>
                          )}
                          {peer.matchBreakdown.ratingPoints > 0 && (
                            <span>Rating: +{peer.matchBreakdown.ratingPoints}</span>
                          )}
                          {peer.matchBreakdown.badgePoints > 0 && (
                            <span>Fast reply: +{peer.matchBreakdown.badgePoints}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {peer.bio && (
                    <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                      {peer.bio}
                    </p>
                  )}

                  {/* Badges for Mode & Pricing */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <span className="px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700 capitalize">
                      {peer.mode === "both" ? "Online & Campus" : peer.mode}
                    </span>
                    <span className="px-2 py-0.5 rounded font-medium bg-stone-100 text-stone-700 capitalize">
                      {peer.pricingPreference === "free"
                        ? "Free Exchange"
                        : peer.pricingPreference === "paid"
                        ? "Paid Tutoring"
                        : "Free or Paid"}
                    </span>
                  </div>

                  {/* Topics Pills */}
                  {peer.topics.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                        Topics
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {peer.topics.slice(0, 4).map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800"
                          >
                            {topic}
                          </span>
                        ))}
                        {peer.topics.length > 4 && (
                          <span className="px-1.5 py-0.5 rounded text-[11px] text-stone-500">
                            +{peer.topics.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Availability excerpt */}
                  {peer.availability && (
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-500 pt-1">
                      <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{peer.availability}</span>
                    </div>
                  )}
                </div>

                {/* View Profile Action */}
                <div className="pt-2 border-t border-stone-100">
                  <Link
                    href={`/peers/${peer.id}`}
                    className="inline-flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50/70 transition-colors"
                  >
                    <span>View Peer Profile</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination Controls */}
          {result.pagination.totalPages > 1 && (
            <nav aria-label="Peer directory pagination" className="flex items-center justify-center gap-2 pt-4">
              {result.pagination.hasPrev ? (
                <Link
                  href={buildPaginationUrl(result.pagination.page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </span>
              )}

              <span className="text-xs text-stone-600 px-3">
                Page {result.pagination.page} of {result.pagination.totalPages}
              </span>

              {result.pagination.hasNext ? (
                <Link
                  href={buildPaginationUrl(result.pagination.page + 1)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </span>
              )}
            </nav>
          )}
        </div>
      )}

      {/* State 2: No results matching current search/filters */}
      {result.state === "no_results" && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-stone-900">
              No peer helpers match your criteria
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Try broadening your keywords or removing some of your mode and pricing filters.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/peers"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
            >
              Clear All Filters
            </Link>
          </div>
        </div>
      )}

      {/* State 3: Genuinely empty database (0 complete profiles in system) */}
      {result.state === "database_empty" && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            <UserIcon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-stone-900">
              No registered peer helpers yet
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Real peer profiles will appear here as students complete their registration and publish their study topics.
            </p>
          </div>
          {session?.user ? (
            <div className="pt-2">
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                Complete Your Profile
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                Sign In to Join Peerly
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* State 4: Missing database configuration */}
      {result.state === "unconfigured" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-amber-900">
              Directory Setup Required
            </h2>
            <p className="text-xs text-amber-800 leading-relaxed">
              The peer directory is currently waiting for database configuration. Please set up the database connection string in your environment.
            </p>
          </div>
        </div>
      )}

      {/* State 5: Database outage or connection error */}
      {result.state === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-red-900">
              Directory Temporarily Unavailable
            </h2>
            <p className="text-xs text-red-700 leading-relaxed">
              {result.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
