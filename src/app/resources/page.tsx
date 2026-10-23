import Link from "next/link";
import {
  BookOpen,
  ArrowRight,
  ExternalLink,
  Clock,
  PlusCircle,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { auth } from "@/auth";
import { queryResources } from "@/lib/resources";
import ResourceFilters from "./ResourceFilters";
import { ReportButton } from "@/components/ReportModal";

export const dynamic = "force-dynamic";

interface ResourcesPageProps {
  searchParams: Promise<{
    q?: string;
    topic?: string;
    page?: string;
  }>;
}

export default async function ResourcesPage(props: ResourcesPageProps) {
  const searchParams = await props.searchParams;
  const session = await auth();

  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const topic = typeof searchParams.topic === "string" ? searchParams.topic : undefined;
  const page = typeof searchParams.page === "string" ? searchParams.page : undefined;

  const result = await queryResources({ q, topic, page });

  const buildPaginationUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (topic) params.set("topic", topic);
    params.set("page", String(newPage));
    return `/resources?${params.toString()}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>Academic Knowledge Share</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Study Resources &amp; Notes
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
            Peer-shared lecture notes, problem sets, and study guides across university courses.
          </p>
        </div>

        {session?.user ? (
          <Link
            href="/resources/manage"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors self-start sm:self-auto shadow-xs min-h-[44px]"
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>Manage My Resources</span>
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors self-start sm:self-auto min-h-[44px]"
          >
            <span>Sign In to Share</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>

      {/* Responsibility & Permission Notice */}
      <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-4 flex items-start gap-3 text-xs text-stone-600">
        <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="font-semibold text-stone-800">Permission &amp; Academic Integrity Reminder</p>
          <p className="leading-relaxed">
            Please share only notes, study guides, and materials that you created or have explicit permission to distribute. Peerly does not host uploaded files or verify third-party links; external links open directly in a new tab.
          </p>
        </div>
      </div>

      {/* Filter component (when database is available) */}
      {result.state !== "unconfigured" &&
        result.state !== "error" &&
        result.state !== "database_empty" && (
          <ResourceFilters availableTopics={result.availableTopics} />
        )}

      {/* State 1: Active resources matching query */}
      {result.state === "success" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <span>
              Showing {result.resources.length} of {result.pagination.totalCount} resource
              {result.pagination.totalCount === 1 ? "" : "s"}
            </span>
            <span>
              Page {result.pagination.page} of {result.pagination.totalPages}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {result.resources.map((res) => (
              <article
                key={res.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-200/90 bg-white p-5 space-y-4 shadow-xs hover:border-emerald-300 transition-colors"
              >
                <div className="space-y-3">
                  {/* Topic & Contributor */}
                  <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3">
                    <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100/80">
                      {res.topic}
                    </span>

                    <div className="flex items-center gap-1.5 text-right">
                      {res.contributor.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={res.contributor.image}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover border border-stone-200"
                          aria-hidden="true"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center font-bold text-[10px]">
                          {res.contributor.name[0]?.toUpperCase() || "S"}
                        </div>
                      )}
                      <span className="text-[11px] font-medium text-stone-600 truncate max-w-[120px]">
                        {res.contributor.name}
                      </span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1.5">
                    <h2 className="text-sm font-bold text-stone-900 leading-snug line-clamp-2">
                      {res.title}
                    </h2>
                    <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed whitespace-pre-line">
                      {res.description}
                    </p>
                  </div>
                </div>

                {/* Footer with date, report button, and external link */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 text-[11px] text-stone-400">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      <span>{new Date(res.createdAt).toLocaleDateString()}</span>
                    </div>
                    <ReportButton
                      targetType="resource"
                      targetId={res.id}
                      targetTitle={res.title}
                      isAuthenticated={Boolean(session?.user)}
                      isCurrentUser={session?.user?.id === res.contributor.id}
                      variant="subtle"
                    />
                  </div>

                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs"
                    aria-label={`Open external resource: ${res.title}`}
                  >
                    <span>Open Resource</span>
                    <ExternalLink className="w-3 h-3 opacity-80" aria-hidden="true" />
                  </a>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination */}
          {result.pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-6 border-t border-stone-200/80">
              {result.pagination.hasPrev ? (
                <Link
                  href={buildPaginationUrl(result.pagination.page - 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  Previous
                </span>
              )}

              <span className="text-xs text-stone-600 font-medium">
                Page {result.pagination.page} of {result.pagination.totalPages}
              </span>

              {result.pagination.hasNext ? (
                <Link
                  href={buildPaginationUrl(result.pagination.page + 1)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-50 text-xs font-semibold text-stone-400 cursor-not-allowed">
                  Next
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* State 2: No matching results for current filter */}
      {result.state === "no_results" && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-stone-900">
              No matching resources found
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              No study resources matched your current filter criteria. Try searching for a broader topic or clear your search query.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
            >
              Clear All Filters
            </Link>
          </div>
        </div>
      )}

      {/* State 3: Database empty */}
      {result.state === "database_empty" && (
        <div className="rounded-2xl border border-stone-200/80 bg-white p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-stone-900">
              No resources published yet
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Be the first to share study notes, lecture summaries, or practice problem sets with fellow university students.
            </p>
          </div>
          <div className="pt-2">
            {session?.user ? (
              <Link
                href="/resources/manage"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                Publish First Resource
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                Sign In to Publish Resource
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* State 4: Unconfigured */}
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
              The academic resources directory is currently waiting for database configuration.
            </p>
          </div>
        </div>
      )}

      {/* State 5: Database outage or error */}
      {result.state === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-red-900">
              Resources Temporarily Unavailable
            </h2>
            <p className="text-xs text-red-700 leading-relaxed">{result.message}</p>
          </div>
          <div className="pt-2">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors"
            >
              Retry
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
