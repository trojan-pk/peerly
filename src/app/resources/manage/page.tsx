import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { getUserResources } from "@/lib/resources";
import ManageResourcesView from "./ManageResourcesView";
import { BookOpen, ArrowLeft, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

interface ManageResourcesPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function ManageResourcesPage(props: ManageResourcesPageProps) {
  const searchParams = await props.searchParams;
  const page = searchParams.page || "1";
  const session = await auth();

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
              Resource management is unavailable because the database is not configured.
            </p>
          </div>
        </div>
      </div>
    );
  }

  let result;
  try {
    result = await getUserResources(page, 10);
  } catch (err) {
    console.error("[ManageResourcesPage] Error loading resources:", err);
    result = {
      state: "error" as const,
      resources: [],
      pagination: {
        page: 1,
        totalPages: 1,
        totalCount: 0,
        hasPrev: false,
        hasNext: false,
      },
      message: "An unexpected database error occurred while loading your resources.",
    };
  }

  if (result.state === "error") {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-danger/25 bg-danger/10 p-6 sm:p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h1 className="text-base font-semibold text-danger">
              Resource Management Temporarily Unavailable
            </h1>
            <p className="text-xs text-danger leading-relaxed">
              {result.message || "We could not load your study resources due to a database error. Please try again."}
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/resources/manage"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold transition-colors min-h-[44px]"
            >
              Retry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page resources-page max-w-4xl mx-auto space-y-6 py-6">
      {/* Back Link */}
      <div>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-accent transition-colors focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Back to Resources Hub</span>
        </Link>
      </div>

      {/* Header */}
      <div className="border-b border-line/80 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent mb-1">
            <BookOpen className="w-4 h-4" aria-hidden="true" />
            <span>Resource Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            My Study Resources
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Keep your shared notes, guides and practice links organised.
          </p>
        </div>
      </div>

      {/* Manage View */}
      <ManageResourcesView
        initialResources={result.resources}
        pagination={result.pagination}
      />
    </div>
  );
}
