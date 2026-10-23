"use client";

import { safeAction } from "@/lib/client-action";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDialogFocus } from "@/components/useDialogFocus";
import Link from "next/link";
import {
  BookOpen,
  PlusCircle,
  ExternalLink,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PublicResourceDTO } from "@/lib/resources";
import {
  createResource,
  updateResource,
  deleteResource,
  ResourceActionResult,
} from "../actions";

export interface ManagePaginationInfo {
  page: number;
  totalPages: number;
  totalCount: number;
  hasPrev: boolean;
  hasNext: boolean;
}

interface ManageResourcesViewProps {
  initialResources: PublicResourceDTO[];
  pagination?: ManagePaginationInfo;
}

export default function ManageResourcesView({
  initialResources,
  pagination,
}: ManageResourcesViewProps) {
  const router = useRouter();
  const resources = initialResources;
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");

  // Edit form state
  const [editingResource, setEditingResource] = useState<PublicResourceDTO | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Status and error messages
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const deleteDialogRef = useDialogFocus(Boolean(deletingId), () => { if (!isPending) setDeletingId(null); });

  const resetCreateForm = () => {
    setTitle("");
    setTopic("");
    setUrl("");
    setDescription("");
    setFieldErrors({});
    setShowCreateForm(false);
  };

  const startEditing = (res: PublicResourceDTO) => {
    setEditingResource(res);
    setEditTitle(res.title);
    setEditTopic(res.topic);
    setEditUrl(res.url);
    setEditDescription(res.description);
    setFieldErrors({});
    setActionError(null);
    setActionSuccess(null);
  };

  const cancelEditing = () => {
    setEditingResource(null);
    setFieldErrors({});
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setFieldErrors({});

    startTransition(async () => {
      const res: ResourceActionResult = await safeAction(() => createResource({
        title,
        topic,
        url,
        description,
      }));

      if (!res.success) {
        setActionError(res.message || "Failed to create resource.");
        if (res.errors) {
          setFieldErrors(res.errors);
        }
      } else {
        setActionSuccess(res.message || "Resource created successfully!");
        router.refresh();
        resetCreateForm();
      }
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingResource) return;

    setActionError(null);
    setActionSuccess(null);
    setFieldErrors({});

    startTransition(async () => {
      const res: ResourceActionResult = await safeAction(() => updateResource({
        resourceId: editingResource.id,
        title: editTitle,
        topic: editTopic,
        url: editUrl,
        description: editDescription,
      }));

      if (!res.success) {
        setActionError(res.message || "Failed to update resource.");
        if (res.errors) {
          setFieldErrors(res.errors);
        }
      } else {
        setActionSuccess(res.message || "Resource updated successfully!");
        router.refresh();
        cancelEditing();
      }
    });
  };

  const handleDeleteConfirm = (resourceId: string) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res: ResourceActionResult = await safeAction(() => deleteResource({
        resourceId,
      }));

      if (!res.success) {
        setActionError(res.message || "Failed to delete resource.");
      } else {
        setActionSuccess(res.message || "Resource deleted successfully.");
        router.refresh();
      }
      setDeletingId(null);
    });
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {actionSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-accent/25 bg-accent/10 p-4 flex items-center justify-between text-xs text-accent shadow-xs"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-accent hover:text-accent text-xs font-semibold focus-visible:outline-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-danger/25 bg-danger/10 p-4 flex items-center justify-between text-xs text-danger shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-danger hover:text-danger text-xs font-semibold focus-visible:outline-none"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sharing Responsibility Reminder */}
      <div className="rounded-xl border border-line bg-panel/80 p-4 flex items-start gap-3 text-xs text-muted">
        <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="font-semibold text-ink">Contributor Guidelines</p>
          <p className="leading-relaxed">
            Only share study materials, guides, and notes that you authored or have explicit rights to publish. Links must use safe HTTP/HTTPS protocols. Embedded passwords and file uploads are prohibited.
          </p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-ink">
            Your Published Resources ({resources.length})
          </h2>
          <p className="text-xs text-muted">
            Manage, edit, or publish study links visible across the public directory.
          </p>
        </div>

        {!showCreateForm && !editingResource && (
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(true);
              setActionError(null);
              setActionSuccess(null);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors shadow-xs min-h-[40px]"
          >
            <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Resource</span>
          </button>
        )}
      </div>

      {/* Create Resource Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-2xl border border-accent/25 bg-surface p-6 space-y-4 shadow-sm"
        >
          <div className="border-b border-line pb-3">
            <h3 className="text-sm font-bold text-ink">Publish a New Study Resource</h3>
            <p className="text-xs text-muted">
              Share lecture summaries, study outlines, or reference guides with other students.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1">
              <label htmlFor="create-title" className="block text-xs font-semibold text-body">
                Resource Title <span className="text-danger">*</span>
              </label>
              <input
                id="create-title"
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Calculus II Midterm Review Notes"
                className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {fieldErrors.title && (
                <p className="text-[11px] text-danger">{fieldErrors.title}</p>
              )}
            </div>

            {/* Topic */}
            <div className="space-y-1">
              <label htmlFor="create-topic" className="block text-xs font-semibold text-body">
                Topic / Course <span className="text-danger">*</span>
              </label>
              <input
                id="create-topic"
                type="text"
                required
                maxLength={50}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Calculus, Physics, Organic Chemistry"
                className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {fieldErrors.topic && (
                <p className="text-[11px] text-danger">{fieldErrors.topic}</p>
              )}
            </div>
          </div>

          {/* URL */}
          <div className="space-y-1">
            <label htmlFor="create-url" className="block text-xs font-semibold text-body">
              Resource Web URL (HTTP/HTTPS) <span className="text-danger">*</span>
            </label>
            <input
              id="create-url"
              type="url"
              required
              maxLength={500}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/... or https://notion.so/..."
              className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <p className="text-[11px] text-faint">
              Must be a valid HTTP or HTTPS URL with a valid domain. Embedded credentials are not allowed.
            </p>
            {fieldErrors.url && (
              <p className="text-[11px] text-danger">{fieldErrors.url}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label htmlFor="create-desc" className="block text-xs font-semibold text-body">
              Description <span className="text-danger">*</span>
            </label>
            <textarea
              id="create-desc"
              rows={3}
              required
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Summarize what topics are covered, key formulas included, or how this resource helps students."
              className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex justify-between items-center text-[11px] text-faint">
              <span>{description.length} / 1000 characters</span>
              {fieldErrors.description && (
                <span className="text-danger">{fieldErrors.description}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              disabled={isPending}
              onClick={resetCreateForm}
              className="px-4 py-2 rounded-xl border border-edge hover:bg-panel text-body text-xs font-semibold transition-colors min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 min-h-[40px]"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Publish Resource</span>
            </button>
          </div>
        </form>
      )}

      {/* Edit Resource Form */}
      {editingResource && (
        <form
          onSubmit={handleUpdateSubmit}
          className="rounded-2xl border border-warning/25 bg-surface p-6 space-y-4 shadow-sm"
        >
          <div className="border-b border-line pb-3">
            <h3 className="text-sm font-bold text-ink">Edit Published Resource</h3>
            <p className="text-xs text-muted">
              Update the details or link for &ldquo;{editingResource.title}&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="edit-title" className="block text-xs font-semibold text-body">
                Resource Title <span className="text-danger">*</span>
              </label>
              <input
                id="edit-title"
                type="text"
                required
                maxLength={120}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {fieldErrors.title && (
                <p className="text-[11px] text-danger">{fieldErrors.title}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="edit-topic" className="block text-xs font-semibold text-body">
                Topic / Course <span className="text-danger">*</span>
              </label>
              <input
                id="edit-topic"
                type="text"
                required
                maxLength={50}
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {fieldErrors.topic && (
                <p className="text-[11px] text-danger">{fieldErrors.topic}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-url" className="block text-xs font-semibold text-body">
              Resource Web URL (HTTP/HTTPS) <span className="text-danger">*</span>
            </label>
            <input
              id="edit-url"
              type="url"
              required
              maxLength={500}
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {fieldErrors.url && (
              <p className="text-[11px] text-danger">{fieldErrors.url}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="edit-desc" className="block text-xs font-semibold text-body">
              Description <span className="text-danger">*</span>
            </label>
            <textarea
              id="edit-desc"
              rows={3}
              required
              maxLength={1000}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-edge p-2.5 text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="flex justify-between items-center text-[11px] text-faint">
              <span>{editDescription.length} / 1000 characters</span>
              {fieldErrors.description && (
                <span className="text-danger">{fieldErrors.description}</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button
              type="button"
              disabled={isPending}
              onClick={cancelEditing}
              className="px-4 py-2 rounded-xl border border-edge hover:bg-panel text-body text-xs font-semibold transition-colors min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors disabled:opacity-50 min-h-[40px]"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* Resources List */}
      {resources.length > 0 ? (
        <>
          <div className="space-y-4">
          {resources.map((res) => (
            <article
              key={res.id}
              className="rounded-2xl border border-line/90 bg-surface p-5 space-y-3 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-accent/10 text-accent border border-accent/25">
                    {res.topic}
                  </span>
                  {res.moderation?.isHidden && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-warning/15 text-warning border border-warning/25">
                      Hidden by Moderator
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-ink">{res.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-edge hover:bg-panel text-body text-xs font-medium transition-colors"
                  >
                    <span>View Link</span>
                    <ExternalLink className="w-3 h-3 text-faint" aria-hidden="true" />
                  </a>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => startEditing(res)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-edge hover:bg-panel text-body text-xs font-medium transition-colors"
                  >
                    <Edit2 className="w-3 h-3 text-muted" aria-hidden="true" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setDeletingId(res.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-danger/25 hover:bg-danger/10 text-danger text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Moderation Notice if hidden by administrator */}
              {res.moderation?.isHidden && (
                <div className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-warning">Moderation Notice: Hidden from Public View</p>
                    <p className="text-[11px] text-warning leading-relaxed">
                      This study resource was hidden by a platform moderator
                      {res.moderation.reason ? `: "${res.moderation.reason}"` : "."}
                      It remains visible in your management area, but is excluded from the public directory.
                    </p>
                  </div>
                </div>
              )}

              {/* Description */}
              <p className="text-xs text-body leading-relaxed whitespace-pre-line">
                {res.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between text-[11px] text-faint pt-1">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>Published on {new Date(res.createdAt).toLocaleDateString()}</span>
                </div>
                {res.updatedAt !== res.createdAt && (
                  <span>Edited {new Date(res.updatedAt).toLocaleDateString()}</span>
                )}
              </div>

              {/* Delete Confirmation Box */}
              {deletingId === res.id && (
                <div
                  ref={deleteDialogRef}
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby={`delete-title-${res.id}`}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
                >
                  <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-danger/25 bg-surface p-6 space-y-3 shadow-xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-danger">
                    <AlertCircle className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
                    <span id={`delete-title-${res.id}`}>
                      Confirm Deletion of &ldquo;{res.title}&rdquo;
                    </span>
                  </div>
                  <p className="text-xs text-danger leading-relaxed">
                    Are you sure you want to delete this study resource? This action cannot be undone and will immediately remove the resource from the public directory.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1.5 rounded-lg border border-edge bg-surface hover:bg-panel text-body text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDeleteConfirm(res.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 min-h-[36px]"
                    >
                      {isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>Yes, Delete Resource</span>
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <nav aria-label="My resources pagination" className="flex items-center justify-center gap-2 pt-4">
            {pagination.hasPrev ? (
              <Link
                href={`/resources/manage?page=${pagination.page - 1}`}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-edge bg-surface text-xs font-semibold text-body hover:bg-panel transition-colors"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Previous
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-line bg-panel text-xs font-semibold text-faint cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                Previous
              </span>
            )}
            <span className="text-xs text-muted px-2 font-medium">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            {pagination.hasNext ? (
              <Link
                href={`/resources/manage?page=${pagination.page + 1}`}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-edge bg-surface text-xs font-semibold text-body hover:bg-panel transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-line bg-panel text-xs font-semibold text-faint cursor-not-allowed">
                Next
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </span>
            )}
          </nav>
        )}
        </>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-line/80 bg-surface p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-raised text-muted flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-semibold text-ink">
              You haven&apos;t published any study resources yet
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Publishing study notes, lecture outlines, and problem sets makes it easy for other students to find helpful material and discover your peer tutoring services.
            </p>
          </div>
          {!showCreateForm && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors min-h-[44px]"
              >
                <PlusCircle className="w-4 h-4" aria-hidden="true" />
                <span>Publish Your First Resource</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
