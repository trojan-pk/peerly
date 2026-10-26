import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/auth-guards";
import { isDatabaseConfigured } from "@/lib/db";
import { listCourses, listUniversities } from "@/lib/courses";
import { AdminCatalogView } from "./AdminCatalogView";

export const dynamic = "force-dynamic";

export default async function AdminUniversitiesPage(props: { searchParams: Promise<{ university?: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/login");
    if (error instanceof ForbiddenError) {
      return (
        <div className="workspace-page max-w-xl mx-auto py-12 text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-danger mx-auto" aria-hidden="true" />
          <h1 className="page-title is-compact">Administrator access required</h1>
          <p className="text-muted">Only accounts listed in ADMIN_EMAILS can manage the university catalogue.</p>
        </div>
      );
    }
    throw error;
  }
  if (!isDatabaseConfigured()) return <div className="workspace-page max-w-3xl mx-auto py-8"><h1 className="page-title">Universities &amp; courses</h1><p className="text-muted mt-3">The database is not configured.</p></div>;

  const { university } = await props.searchParams;
  const universities = await listUniversities({ includeHidden: true });
  const selected = universities.find((u) => u.id === university) ?? universities[0] ?? null;
  const courses = selected ? await listCourses(selected.id, { includeHidden: true }) : [];

  return (
    <div className="workspace-page max-w-5xl mx-auto py-8 space-y-8">
      <div className="border-b border-line pb-6 space-y-2">
        <Link href="/admin/reports" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft size={15} aria-hidden="true" />Moderation reports</Link>
        <h1 className="page-title">Universities &amp; courses</h1>
        <p className="text-sm text-muted">Email domains decide who can earn the “University email verified” badge. Students add courses; you can hide or merge duplicates.</p>
      </div>
      <AdminCatalogView key={selected?.id ?? "none"} universities={universities} selectedId={selected?.id ?? null} courses={courses} />
    </div>
  );
}
