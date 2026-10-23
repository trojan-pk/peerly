import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentDbUser } from "@/lib/auth-guards";
import type { RequestStatus } from "@/models/StudyRequest";
import { isDatabaseConfigured } from "@/lib/db";
import { getDashboardRequests } from "@/lib/study-requests";
import DashboardView from "./DashboardView";
import { LayoutDashboard, Settings, AlertTriangle, BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    tab?: string;
    incomingPage?: string;
    outgoingPage?: string;
    status?: string;
    view?: string;
  }>;
}

export default async function DashboardPage(props: DashboardPageProps) {
  const session = await auth();
  const searchParams = await props.searchParams;

  if (!session?.user?.id) redirect("/login");

  if (!isDatabaseConfigured()) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-warning/25 bg-warning/10 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-warning">
              Database Setup Required
            </h1>
            <p className="text-xs text-warning leading-relaxed">
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

  const validStatuses = ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "COMPLETED", "REVIEWED"];
  const status = validStatuses.includes(searchParams.status || "") ? searchParams.status as RequestStatus : undefined;
  const archivedView = searchParams.view === "archived";
  const context = await getCurrentDbUser();
  let requestsData = null;
  let dbError = false;

  try {
    requestsData = await getDashboardRequests(incomingPage, outgoingPage, 10, { status, archived: archivedView });
  } catch (err) {
    console.error("[DashboardPage] Error loading study requests:", err);
    dbError = true;
  }

  return (
    <div className="workspace-page dashboard-page max-w-5xl mx-auto space-y-8 py-8">
      {/* Dashboard Header */}
      <div className="border-b border-line/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent mb-1">
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
            <span>Student Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Your study workspace
          </h1>
          <p className="text-sm text-muted mt-2">{context?.user.name ? `${context.user.name}, track` : "Track"} your requests, responses and completed sessions.</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <Link
            href="/resources/manage"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-edge hover:bg-panel text-ink text-xs font-semibold transition-colors min-h-[40px]"
          >
            <BookOpen className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            <span>My Resources</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-edge hover:bg-panel text-ink text-xs font-semibold transition-colors min-h-[40px]"
          >
            <Settings className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* Database Error Banner */}
      {dbError ? (
        <div className="rounded-2xl border border-danger/25 bg-danger/10 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-semibold text-danger">
              Database Connection Error
            </h2>
            <p className="text-xs text-danger leading-relaxed">
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
          key={`${tab}-${status || "all"}-${archivedView}-${incomingPage}-${outgoingPage}`}
          statusFilter={status || "all"}
          archivedView={archivedView}
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
