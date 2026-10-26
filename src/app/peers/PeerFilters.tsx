"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Filter } from "lucide-react";

interface PeerFiltersProps {
  availableTopics: string[];
  availableSubjects: string[];
  availableCourses?: Array<{ id: string; label: string }>;
}

export default function PeerFilters({
  availableTopics,
  availableSubjects,
  availableCourses = [],
}: PeerFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") || "";
  const currentTopic = searchParams.get("topic") || "";
  const currentSubject = searchParams.get("subject") || "";
  const currentMode = searchParams.get("mode") || "";
  const currentPricing = searchParams.get("pricing") || "";
  const currentCourse = searchParams.get("course") || "";

  const hasActiveFilters = Boolean(
    currentCourse || currentQ || currentTopic || currentSubject || currentMode || currentPricing
  );

  const handleClearFilters = () => {
    router.push("/peers");
  };

  return (
    <form
      method="GET"
      action="/peers"
      className="rounded-2xl border border-line/90 bg-surface p-5 sm:p-6 space-y-4 shadow-xs"
    >
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2 text-ink font-bold text-sm">
          <Filter className="w-4 h-4 text-accent" aria-hidden="true" />
          <span>Filter Peer Helpers</span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:underline"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Clear all filters
          </button>
        )}
      </div>

      {/* Keyword Search */}
      <div className="relative">
        <label htmlFor="peer-search-input" className="sr-only">
          Search peers by topic, course, or university
        </label>
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
          <Search className="w-4 h-4" aria-hidden="true" />
        </div>
        <input
          type="text"
          id="peer-search-input"
          name="q"
          defaultValue={currentQ}
          placeholder="Search by course code, topic, university or name…"
          className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-edge text-sm text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-lg bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Search
        </button>
      </div>

      {/* Filter Dropdowns Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${availableCourses.length ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-3 pt-1`}>
        {availableCourses.length > 0 && (
          <div className="space-y-1">
            <label htmlFor="filter-course" className="block text-[11px] font-semibold text-body">Course</label>
            <select
              id="filter-course"
              name="course"
              defaultValue={currentCourse}
              onChange={(e) => { e.currentTarget.form?.requestSubmit(); }}
              className="w-full px-3 py-2 rounded-lg border border-edge text-xs text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            >
              <option value="">All courses</option>
              {availableCourses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        )}
        {/* Topic filter */}
        <div className="space-y-1">
          <label htmlFor="filter-topic" className="block text-[11px] font-semibold text-body">
            Topic
          </label>
          <select
            id="filter-topic"
            name="topic"
            defaultValue={currentTopic}
            onChange={(e) => {
              e.currentTarget.form?.requestSubmit();
            }}
            className="w-full px-3 py-2 rounded-lg border border-edge text-xs text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          >
            <option value="">All Topics</option>
            {availableTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>

        {/* Subject filter */}
        <div className="space-y-1">
          <label htmlFor="filter-subject" className="block text-[11px] font-semibold text-body">
            Subject
          </label>
          <select
            id="filter-subject"
            name="subject"
            defaultValue={currentSubject}
            onChange={(e) => {
              e.currentTarget.form?.requestSubmit();
            }}
            className="w-full px-3 py-2 rounded-lg border border-edge text-xs text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          >
            <option value="">All Subjects</option>
            {availableSubjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Learning Mode filter */}
        <div className="space-y-1">
          <label htmlFor="filter-mode" className="block text-[11px] font-semibold text-body">
            Learning Mode
          </label>
          <select
            id="filter-mode"
            name="mode"
            defaultValue={currentMode}
            onChange={(e) => {
              e.currentTarget.form?.requestSubmit();
            }}
            className="w-full px-3 py-2 rounded-lg border border-edge text-xs text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          >
            <option value="">Any Mode</option>
            <option value="online">Online (or Both)</option>
            <option value="campus">Campus In-person (or Both)</option>
            <option value="both">Only Both</option>
          </select>
        </div>

        {/* Pricing Preference filter */}
        <div className="space-y-1">
          <label htmlFor="filter-pricing" className="block text-[11px] font-semibold text-body">
            Pricing Preference
          </label>
          <select
            id="filter-pricing"
            name="pricing"
            defaultValue={currentPricing}
            onChange={(e) => {
              e.currentTarget.form?.requestSubmit();
            }}
            className="w-full px-3 py-2 rounded-lg border border-edge text-xs text-ink bg-panel/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
          >
            <option value="">Any Preference</option>
            <option value="free">Free Peer Help (or Both)</option>
            <option value="paid">Paid Tutoring (or Both)</option>
            <option value="both">Only Both</option>
          </select>
        </div>
      </div>
    </form>
  );
}
