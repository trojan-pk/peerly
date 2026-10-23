import Link from "next/link";
import { auth } from "@/auth";
import { isDatabaseConfigured, connectToDatabase } from "@/lib/db";
import { getAuthConfigStatus } from "@/lib/auth-config";
import { User, toPublicProfile } from "@/models/User";
import { PublicUserProfile } from "@/types/user";
import {
  GraduationCap,
  Search,
  Lock,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  UserCheck,
} from "lucide-react";

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

export default async function HomePage() {
  const session = await auth();
  const authStatus = getAuthConfigStatus();
  const dbConfigured = isDatabaseConfigured();
  const recentResult = await getRecentPublicPeers();
  const recentPeers = recentResult.peers;
  const isDev = process.env.NODE_ENV === "development";

  const isFullyConfigured = authStatus.isConfigured && dbConfigured;

  return (
    <div className="space-y-16 py-6 sm:py-10">
      {/* Developer Environment Notice (only shown in development mode when configuration is incomplete) */}
      {isDev && !isFullyConfigured && (
        <section aria-label="Development Setup Notice">
          <div className="max-w-4xl mx-auto rounded-xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-semibold text-amber-900">
                  Developer Setup: Local Credentials Needed
                </h2>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  {!dbConfigured && !authStatus.isConfigured
                    ? "MongoDB and Google OAuth credentials need to be set in .env.local."
                    : !dbConfigured
                    ? "MongoDB connection string (MONGODB_URI) is missing or set to a placeholder."
                    : "Google OAuth credentials (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) are missing."}
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 text-white text-xs font-medium hover:bg-amber-900 transition-colors shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-amber-700"
            >
              Setup Guide
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {/* Hero Section */}
      <section aria-labelledby="hero-title" className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium">
          <GraduationCap className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          <span>Student Peer-to-Peer Learning</span>
        </div>

        <h1
          id="hero-title"
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-stone-900 leading-tight"
        >
          Master your coursework with help from fellow students.
        </h1>

        <p className="text-base sm:text-lg text-stone-600 leading-relaxed max-w-2xl mx-auto">
          Connect with university peers for subject-specific problem solving, study sessions, and shared academic resources. Find a helper, request a session, and keep your contact private.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/peers"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-xs min-h-[48px] focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            Find Peers
          </Link>

          {session?.user ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-sm font-semibold transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <UserCheck className="w-4 h-4 text-emerald-600" aria-hidden="true" />
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-sm font-semibold transition-colors min-h-[48px] focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Sign In to Participate
            </Link>
          )}
        </div>
      </section>

      {/* Core Principles Section */}
      <section aria-labelledby="principles-title" className="max-w-5xl mx-auto">
        <h2 id="principles-title" className="sr-only">
          Peerly Core Principles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Search className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-stone-900">
              Topic &amp; Subject Search
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Find peers who have mastered specific subjects and topics. Filter by university, study mode (online or campus), and free or paid preferences.
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Lock className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-stone-900">
              Protected Contact Details
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Your email, WhatsApp number, and meeting links are strictly protected. They only unlock to your study partner after you accept their request.
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-6 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-stone-900">
              Reviews After Completion
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Reviews and helpfulness scores derive strictly from completed sessions confirmed by both students. Real peers without vanity metrics.
            </p>
          </div>
        </div>
      </section>

      {/* Peer Discovery Section */}
      <section aria-labelledby="peers-heading" className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-4">
          <div>
            <h2 id="peers-heading" className="text-xl font-bold tracking-tight text-stone-900">
              Available Peer Helpers
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Browse students offering academic support in their coursework topics.
            </p>
          </div>
          <Link
            href="/peers"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 min-h-[44px] px-2 focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
          >
            Browse all peers
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentPeers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentPeers.map((peer) => (
              <Link
                key={peer.id}
                href={`/peers/${peer.id}`}
                className="rounded-xl border border-stone-200/90 bg-white p-5 space-y-3 hover:border-emerald-300 transition-colors shadow-xs block"
              >
                <div className="flex items-center gap-3">
                  {peer.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={peer.image}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-stone-200"
                      aria-hidden="true"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-semibold text-sm">
                      {peer.name[0]?.toUpperCase() || "P"}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-stone-900">{peer.name}</h3>
                    <p className="text-xs text-stone-500">
                      {peer.university || "University Student"}
                    </p>
                  </div>
                </div>

                {peer.bio && (
                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {peer.bio}
                  </p>
                )}

                {peer.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {peer.topics.slice(0, 3).map((topic) => (
                      <span
                        key={topic}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-stone-700"
                      >
                        {topic}
                      </span>
                    ))}
                    {peer.topics.length > 3 && (
                      <span className="text-[11px] text-stone-500 self-center">
                        +{peer.topics.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200/80 bg-white p-8 sm:p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h3 className="text-base font-semibold text-stone-900">
                {recentResult.unavailable ? "Peer directory temporarily unavailable" : "No peer profiles available yet"}
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                {recentResult.unavailable
                  ? "We cannot load the directory right now. Please try again shortly."
                  : "Connect with classmates and campus peers. Once students sign in with Google and complete their profiles, they will appear here."}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                Sign In to Offer Peer Help
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Academic Resources Hub Callout */}
      <section aria-labelledby="resources-callout" className="max-w-5xl mx-auto">
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <BookOpen className="w-4 h-4 text-emerald-700" aria-hidden="true" />
              <span>Study Materials &amp; Resources</span>
            </div>
            <h2 id="resources-callout" className="text-xl font-bold tracking-tight text-stone-900">
              Academic Resource Hub
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              Explore subject-specific reference links, lecture notes, and practice problems shared by fellow students. Browse without signing in, or sign in to share your own.
            </p>
          </div>
          <Link
            href="/resources"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors shrink-0 shadow-xs min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            Explore Resources
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
