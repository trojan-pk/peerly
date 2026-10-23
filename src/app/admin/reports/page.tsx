import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, AlertCircle } from "lucide-react";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth-guards";
import { getAdminReports } from "@/lib/reports";
import AdminReportsView from "./AdminReportsView";

export const dynamic = "force-dynamic";

interface AdminReportsPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function AdminReportsPage(props: AdminReportsPageProps) {
  const searchParams = await props.searchParams;

  // 1. Strict server-side authorization check against current ADMIN_EMAILS
  let adminContext;
  try {
    adminContext = await requireAdmin();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect("/login");
    }
    if (err instanceof ForbiddenError) {
      return (
        <div className="max-w-xl mx-auto py-12 px-4">
          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-6 sm:p-8 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h1 className="text-base font-bold text-red-950">
                Administrative Access Required
              </h1>
              <p className="text-xs text-red-800 leading-relaxed max-w-sm mx-auto">
                This account does not have permission to view moderation reports.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Return to Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      );
    }
    throw err;
  }

  // 2. Query reports from MongoDB
  const statusFilter = typeof searchParams.status === "string" ? searchParams.status : "ALL";
  const pageParam = typeof searchParams.page === "string" ? searchParams.page : 1;

  const result = await getAdminReports(statusFilter, pageParam, 10);

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 mb-1">
            <ShieldAlert className="w-4 h-4" aria-hidden="true" />
            <span>Administrator Moderation Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Safety &amp; Content Reports
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
            Review reported peer profiles and study resources, take moderation actions, and manage visibility.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-500 self-start sm:self-auto bg-stone-100/80 px-3 py-1.5 rounded-xl border border-stone-200">
          <span className="font-semibold text-stone-700">Moderator:</span>
          <span className="font-mono text-stone-900">{adminContext.user.email}</span>
        </div>
      </div>

      {/* Database Error Warning */}
      {result.state === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            {result.message || "Failed to load moderation reports due to a database error."}
          </p>
        </div>
      )}

      {/* Main Admin Reports View */}
      <AdminReportsView
        key={`${statusFilter}-${pageParam}`}
        initialResult={result}
        currentStatus={statusFilter}
      />
    </div>
  );
}
