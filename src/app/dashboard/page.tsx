import Link from "next/link";
import { auth } from "@/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { getDashboardRequests } from "@/lib/study-requests";
import DashboardView from "./DashboardView";
import { LayoutDashboard, Lock, User, ArrowRight, AlertTriangle, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    tab?: string;
    incomingPage?: string;
    outgoingPage?: string;
  }>;
}

export default async function DashboardPage(props: DashboardPageProps) {
  const session = await auth();
  const searchParams = await props.searchParams;

  if (!session?.user?.id) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-stone-200/90 bg-white p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-stone-900">Sign in to Access Dashboard</h1>
            <p className="text-xs text-stone-600">
              You must be signed in with your Google account to view your study sessions and requests.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Sign In with Google
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isDatabaseConfigured()) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-amber-900">
              Database Setup Required
            </h1>
            <p className="text-xs text-amber-800 leading-relaxed">
              Study requests cannot be loaded because the database is not configured.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tab = searchParams.tab === "outgoing" ? "outgoing" : "incoming";
  const incomingPage = parseInt(searchParams.incomingPage || "1", 10) || 1;
  const outgoingPage = parseInt(searchParams.outgoingPage || "1", 10) || 1;

  let requestsData = null;
  let dbError = false;

  try {
    requestsData = await getDashboardRequests(incomingPage, outgoingPage);
  } catch (err) {
    console.error("[DashboardPage] Error loading study requests:", err);
    dbError = true;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Dashboard Header */}
      <div className="border-b border-stone-200/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-1">
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            <span>Student Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Welcome back, {session.user.name || "Student"}
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Signed in as {session.user.email} • Role:{" "}
            <span className="font-medium capitalize">{session.user.role || "student"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Link
            href="/resources/manage"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors min-h-[40px]"
          >
            <BookOpen className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
            <span>My Resources</span>
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-semibold transition-colors min-h-[40px]"
          >
            <User className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
            <span>Edit Profile</span>
          </Link>
        </div>
      </div>

      {/* Database Error Banner */}
      {dbError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-800 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-red-900">
              Database Connection Error
            </h2>
            <p className="text-xs text-red-800 leading-relaxed">
              We encountered an issue loading your study requests. Your session is active, but the database could not be reached.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors"
            >
              Retry
            </Link>
          </div>
        </div>
      ) : requestsData ? (
        <DashboardView
          incoming={requestsData.incoming}
          outgoing={requestsData.outgoing}
          initialTab={tab}
          incomingPage={incomingPage}
          outgoingPage={outgoingPage}
        />
      ) : null}
    </div>
  );
}
