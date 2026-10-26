"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Tag } from "lucide-react";

interface ResourceFiltersProps {
  availableTopics: string[];
}

export default function ResourceFilters({ availableTopics }: ResourceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(searchParams.get("q") || "");
  const selectedTopic = searchParams.get("topic") || "";
  const sort = searchParams.get("sort") === "helpful" ? "helpful" : "newest";

  const setSort = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "helpful") params.set("sort", "helpful"); else params.delete("sort");
    params.delete("page");
    router.push(`/resources?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.push(`/resources?${params.toString()}`);
  };

  const handleTopicClick = (topic: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedTopic.toLowerCase() === topic.toLowerCase()) {
      params.delete("topic");
    } else {
      params.set("topic", topic);
    }
    params.delete("page");
    router.push(`/resources?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(searchParams.get("q") || searchParams.get("topic"));

  const handleClearFilters = () => {
    setQ("");
    router.push("/resources");
  };

  return (
    <div className="resource-filters space-y-4 border-b border-line pb-6">
      {/* Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-faint">
            <Search className="w-4 h-4" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or topic"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-edge text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent min-h-[44px]"
            aria-label="Search study resources"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-action hover:bg-action-hover text-white text-xs font-semibold transition-colors min-h-[44px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Search
        </button>
      </form>

      <div className="segmented" role="group" aria-label="Sort resources">
        <button type="button" aria-pressed={sort === "newest"} onClick={() => setSort("newest")}>Newest</button>
        <button type="button" aria-pressed={sort === "helpful"} onClick={() => setSort("helpful")}>Most helpful</button>
      </div>

      {/* Available Topic Filter Pills */}
      {availableTopics.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <Tag className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Filter by Topic:</span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Topic filters">
            {availableTopics.map((topic) => {
              const isSelected = selectedTopic.toLowerCase() === topic.toLowerCase();
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => handleTopicClick(topic)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent min-h-[32px] ${
                    isSelected
                      ? "bg-action text-white font-semibold shadow-xs"
                      : "bg-raised text-body hover:bg-edge"
                  }`}
                  aria-pressed={isSelected}
                >
                  {topic}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Active filters clear row */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
          <span className="text-muted">
            Active filters: {selectedTopic && <span className="font-semibold text-accent mr-2">Topic: {selectedTopic}</span>}
            {q && <span className="font-semibold text-accent">Keyword: &quot;{q}&quot;</span>}
          </span>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 text-accent hover:text-accent font-semibold"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
