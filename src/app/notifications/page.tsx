import Link from "next/link";
import { redirect } from "next/navigation";
import type mongoose from "mongoose";
import { BellOff, ChevronLeft, ChevronRight } from "lucide-react";
import { getCurrentDbUser } from "@/lib/auth-guards";
import { isDatabaseConfigured } from "@/lib/db";
import { listNotificationsFor } from "@/lib/notifications";
import { EmptyState } from "@/components/ui";
import { NotificationList } from "./NotificationList";

export const dynamic = "force-dynamic";

export default async function NotificationsPage(props: { searchParams: Promise<{ page?: string }> }) {
  const context = await getCurrentDbUser();
  if (!context) redirect("/login");
  const { page } = await props.searchParams;

  if (!isDatabaseConfigured()) {
    return <div className="workspace-page max-w-3xl mx-auto py-8"><h1 className="page-title">Notifications</h1><p className="text-muted mt-3">Notifications are unavailable because the database is not configured.</p></div>;
  }

  let data: Awaited<ReturnType<typeof listNotificationsFor>> | null = null;
  try {
    data = await listNotificationsFor(context.user._id as mongoose.Types.ObjectId, parseInt(page || "1", 10) || 1);
  } catch {
    data = null;
  }

  return (
    <div className="workspace-page max-w-3xl mx-auto py-8 space-y-6">
      <div className="border-b border-line pb-6">
        <h1 className="page-title">Notifications</h1>
        <p className="text-sm text-muted mt-2">Updates on requests you sent and requests sent to you. Kept for 90 days.</p>
      </div>
      {!data ? (
        <p role="alert" className="text-danger">We couldn&apos;t load your notifications. Please refresh to try again.</p>
      ) : data.total === 0 ? (
        <EmptyState icon={<BellOff size={20} />} title="Nothing yet">When someone asks you for help or responds to your request, it shows up here.</EmptyState>
      ) : (
        <>
          <NotificationList items={data.items} unread={data.unread} />
          {data.totalPages > 1 && (
            <nav aria-label="Notification pages" className="flex items-center justify-between text-sm">
              {data.page > 1 ? <Link className="ui-button is-secondary is-sm" href={`/notifications?page=${data.page - 1}`}><ChevronLeft size={15} aria-hidden="true" />Newer</Link> : <span />}
              <span className="text-muted tabular">Page {data.page} of {data.totalPages}</span>
              {data.page < data.totalPages ? <Link className="ui-button is-secondary is-sm" href={`/notifications?page=${data.page + 1}`}>Older<ChevronRight size={15} aria-hidden="true" /></Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
