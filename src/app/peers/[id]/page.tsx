import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Sparkles,
  BookOpen,
  GraduationCap,
  AlertCircle,
  Star,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Zap,
} from "lucide-react";
import { auth } from "@/auth";
import { isDatabaseConfigured, connectToDatabase } from "@/lib/db";
import { User, toPublicProfile } from "@/models/User";
import { getPublicPeerReviews } from "@/lib/study-requests";
import { getPeerRatingStats } from "@/lib/peer-reviews";
import { getPeerPublishedResources } from "@/lib/resources";
import { getPeerResponseStats, formatResponseTime } from "@/lib/peer-responses";
import StudyRequestForm from "./StudyRequestForm";
import { ReportButton } from "@/components/ReportModal";

export const dynamic = "force-dynamic";

interface PeerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    reviewPage?: string;
  }>;
}

export default async function PeerDetailPage(props: PeerDetailPageProps) {
  const { id } = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const session = await auth();

  // 1. Validate MongoDB ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }

  // 2. Database configuration check
  if (!isDatabaseConfigured()) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 text-center space-y-3">
          <h1 className="text-base font-semibold text-amber-900">
            Directory Setup Required
          </h1>
          <p className="text-xs text-amber-800 leading-relaxed">
            The peer directory is temporarily waiting for database configuration.
          </p>
        </div>
      </div>
    );
  }

  // 3. Query user safely from MongoDB, distinguishing outages from 404s
  let rawUser = null;
  let dbOutage = false;
  try {
    await connectToDatabase();
    rawUser = await User.findById(id).lean();
  } catch (err) {
    console.error("[PeerDetailPage] Error querying user:", err);
    dbOutage = true;
  }

  // 4. Distinguish database outage from missing or incomplete profile
  if (dbOutage) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-red-900">
              Peer Profile Temporarily Unavailable
            </h1>
            <p className="text-xs text-red-800 leading-relaxed">
              We could not load this peer&apos;s profile due to a temporary database issue. Please try again shortly.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href={`/peers/${id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors min-h-[44px]"
            >
              Retry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Only return 404 if the database query completed normally but user was not found, incomplete, or moderated
  if (!rawUser || !rawUser.isProfileComplete || rawUser.moderation?.isHidden) {
    notFound();
  }

  // 5. Strict public DTO transformation: NEVER contains email, googleId, or private contact details
  const peer = toPublicProfile(rawUser);

  // 6. Paginated public reviews, authoritative rating stats, published resources, and response reliability stats
  const reviewPage = parseInt(searchParams.reviewPage || "1", 10) || 1;
  const [peerReviews, ratingStats, peerResourcesResult, responseStats] = await Promise.all([
    getPublicPeerReviews(peer.id, reviewPage, 5),
    getPeerRatingStats(peer.id),
    getPeerPublishedResources(peer.id, 10),
    getPeerResponseStats(peer.id),
  ]);

  const currentUserId = session?.user?.id;
  const isCurrentUser = Boolean(currentUserId && currentUserId === peer.id);
  const isAuthenticated = Boolean(session?.user);

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6">
      {/* Back Navigation */}
      <div>
        <Link
          href="/peers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-emerald-700 transition-colors focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          Back to peer directory
        </Link>
      </div>

      {/* Main Profile Article */}
      <article className="rounded-2xl border border-stone-200/90 bg-white p-6 sm:p-8 space-y-8 shadow-xs">
        {/* Header Profile Identity */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-stone-100">
          <div className="flex items-start sm:items-center gap-4">
            {peer.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={peer.image}
                alt=""
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border border-stone-200 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xl shrink-0">
                {peer.name[0]?.toUpperCase() || "P"}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                  {peer.name}
                </h1>
                {/* Review Badge: Honest "New" badge when no reviews exist */}
                {ratingStats.reviewCount === 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    New Helper
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    ★ {ratingStats.averageRating.toFixed(1)} ({ratingStats.reviewCount}{" "}
                    {ratingStats.reviewCount === 1 ? "review" : "reviews"})
                  </span>
                )}

                {/* Fast-Reply Badge if earned */}
                {responseStats.hasFastReplyBadge && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200"
                    title={`Fast responder badge: average response time ~${formatResponseTime(responseStats.avgResponseTimeMs)} based on ${responseStats.sampleCount} responses (threshold: average <= 2 hours with at least 3 responses)`}
                    aria-label={`Fast responder badge: ${responseStats.sampleCount} responses`}
                  >
                    <Zap className="w-3 h-3 text-teal-600 fill-teal-600" aria-hidden="true" />
                    Fast Responder
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-600 flex-wrap">
                <div className="flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
                  <span>{peer.university || "University Student"}</span>
                </div>
                {peer.campus && (
                  <>
                    <span className="text-stone-300">•</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
                      <span>{peer.campus}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Mode & Pricing Badges & Report Button */}
          <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
            <div className="flex sm:flex-col gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-800">
                <span className="font-semibold text-stone-500">Mode:</span>{" "}
                {peer.mode === "both" ? "Online & Campus" : peer.mode}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-800">
                <span className="font-semibold text-stone-500">Pricing:</span>{" "}
                {peer.pricingPreference === "free"
                  ? "Free Exchange"
                  : peer.pricingPreference === "paid"
                  ? "Paid Tutoring"
                  : "Free or Paid"}
              </span>
            </div>

            {!isCurrentUser && (
              <ReportButton
                targetType="user"
                targetId={peer.id}
                targetTitle={peer.name}
                isAuthenticated={isAuthenticated}
                isCurrentUser={isCurrentUser}
                variant="button"
              />
            )}
          </div>
        </div>

        {/* Bio Section */}
        {peer.bio && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              About &amp; Study Focus
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
              {peer.bio}
            </p>
          </section>
        )}

        {/* Topics & Subjects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
          {/* Topics of Expertise */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
              <span>Specific Topics</span>
            </div>
            {peer.topics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {peer.topics.map((topic) => (
                  <span
                    key={topic}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-100/80"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500">No specific topics listed.</p>
            )}
          </section>

          {/* Broader Subjects */}
          <section className="space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
              <BookOpen className="w-3.5 h-3.5 text-stone-400" aria-hidden="true" />
              <span>Academic Subjects</span>
            </div>
            {peer.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {peer.subjects.map((sub) => (
                  <span
                    key={sub}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-stone-100 text-stone-700"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-500">General coursework and study sessions.</p>
            )}
          </section>
        </div>

        {/* Availability Schedule */}
        {peer.availability && (
          <section className="space-y-2 pt-2 border-t border-stone-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Availability Schedule
            </h2>
            <div className="flex items-start gap-2 text-xs text-stone-700 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">{peer.availability}</p>
            </div>
          </section>
        )}

        {/* Response Reliability & Fast-Reply Stats */}
        <section className="space-y-3 pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Response Reliability
            </h2>
            <span className="text-xs text-stone-500">
              Derived from verified study request responses
            </span>
          </div>

          <div className="rounded-xl border border-stone-200/90 bg-stone-50/70 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {responseStats.hasFastReplyBadge ? (
                <span className="inline-flex items-center gap-1.5 font-bold text-teal-900 bg-teal-100/90 px-2.5 py-1 rounded-md border border-teal-200">
                  <Zap className="w-3.5 h-3.5 text-teal-700 fill-teal-700" aria-hidden="true" />
                  Fast Responder Badge Earned
                </span>
              ) : (
                <span className="font-semibold text-stone-700">
                  Response History
                </span>
              )}
              <span className="text-stone-400">•</span>
              <span className="text-stone-700 font-medium">
                {responseStats.sampleCount === 0
                  ? "New helper: No study request responses yet"
                  : `Average response: ~${formatResponseTime(responseStats.avgResponseTimeMs)} based on ${
                      responseStats.sampleCount
                    } ${responseStats.sampleCount === 1 ? "response" : "responses"}`}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              The Fast Responder badge requires at least 3 responses with an average response time of 2 hours or less. Timestamps are recorded atomically upon acceptance or rejection.
            </p>
          </div>
        </section>

        {/* Reviews Section: Paginated verified reviews or honest empty state */}
        <section className="space-y-4 pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Reviews &amp; Verified Helpfulness
            </h2>
            {ratingStats.reviewCount > 0 && (
              <span className="text-xs font-semibold text-stone-600">
                ★ {ratingStats.averageRating.toFixed(1)} / 5.0 ({ratingStats.reviewCount}{" "}
                {ratingStats.reviewCount === 1 ? "review" : "reviews"})
              </span>
            )}
          </div>

          {ratingStats.reviewCount === 0 || peerReviews.reviews.length === 0 ? (
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-4 text-xs text-stone-600 space-y-1">
              <p className="font-semibold text-stone-800">No student reviews yet</p>
              <p className="leading-relaxed">
                Reviews on Peerly derive exclusively from verified completed study sessions. Once sessions are completed and confirmed by both participants, honest learner feedback will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2.5">
                {peerReviews.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-stone-200/90 bg-stone-50/50 p-4 space-y-2 text-xs text-stone-700"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3.5 h-3.5 ${
                                star <= rev.rating
                                  ? "text-amber-500 fill-amber-500"
                                  : "text-stone-300"
                              }`}
                              aria-hidden="true"
                            />
                          ))}
                        </div>
                        <span className="font-bold text-stone-900">{rev.rating} / 5</span>
                        <span className="text-stone-400">•</span>
                        <span className="font-medium text-stone-700">{rev.learnerName}</span>
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {rev.comment && (
                      <p className="leading-relaxed text-stone-700 bg-white p-3 rounded-lg border border-stone-100">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Review Pagination Controls */}
              {peerReviews.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  {peerReviews.page > 1 ? (
                    <Link
                      href={`/peers/${id}?reviewPage=${peerReviews.page - 1}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      Previous
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                      Previous
                    </span>
                  )}

                  <span className="text-xs text-stone-600">
                    Page {peerReviews.page} of {peerReviews.totalPages}
                  </span>

                  {peerReviews.page < peerReviews.totalPages ? (
                    <Link
                      href={`/peers/${id}?reviewPage=${peerReviews.page + 1}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
                      Next
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Published Resources Section: Public and does NOT require an accepted request */}
        <section className="space-y-4 pt-2 border-t border-stone-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Published Study Resources (
              {peerResourcesResult.state === "success" ? peerResourcesResult.resources.length : 0}
              )
            </h2>
            <p className="text-[11px] text-stone-500">
              Free reference material and study guides published by this peer.
            </p>
          </div>

          {peerResourcesResult.state === "error" ? (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-800 space-y-2">
              <p className="font-semibold text-red-900">Study resources temporarily unavailable</p>
              <p className="leading-relaxed">
                We could not load this peer&apos;s published resources due to a database issue. Please try again shortly.
              </p>
              <div>
                <Link
                  href={`/peers/${id}`}
                  className="inline-flex items-center gap-1 font-semibold text-red-900 underline hover:text-red-950"
                >
                  Retry loading resources
                </Link>
              </div>
            </div>
          ) : peerResourcesResult.resources.length === 0 ? (
            <div className="rounded-xl border border-stone-200/80 bg-stone-50/70 p-4 text-xs text-stone-600">
              <p className="font-semibold text-stone-800">No study resources published yet</p>
              <p className="leading-relaxed mt-0.5">
                This peer helper has not published external study notes or reference links yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {peerResourcesResult.resources.map((res) => (
                  <div
                    key={res.id}
                    className="flex flex-col justify-between rounded-xl border border-stone-200 bg-stone-50/50 p-4 space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                          {res.topic}
                        </span>
                        <h3 className="text-xs font-bold text-stone-900 line-clamp-1">
                          {res.title}
                        </h3>
                      </div>
                      <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed whitespace-pre-line">
                        {res.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400">
                          {new Date(res.createdAt).toLocaleDateString()}
                        </span>
                        <ReportButton
                          targetType="resource"
                          targetId={res.id}
                          targetTitle={res.title}
                          isAuthenticated={isAuthenticated}
                          variant="subtle"
                        />
                      </div>
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
                        aria-label={`Open external resource: ${res.title}`}
                      >
                        <span>Open Link</span>
                        <ExternalLink className="w-3 h-3 opacity-80" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-stone-400 italic">
                External resource links are provided directly by the student contributor. Peerly does not host files or verify third-party links.
              </p>
            </div>
          )}
        </section>

        {/* Request Form Section */}
        <section className="pt-2 border-t border-stone-100">
          <StudyRequestForm
            peerId={peer.id}
            peerName={peer.name}
            peerTopics={peer.topics}
            peerMode={peer.mode}
            isCurrentUser={isCurrentUser}
            isAuthenticated={isAuthenticated}
          />
        </section>
      </article>
    </div>
  );
}
