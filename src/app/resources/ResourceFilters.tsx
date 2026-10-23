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
    <div className="space-y-4 rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs">
      {/* Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes, problem sets, or study guides by title or topic..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent min-h-[44px]"
            aria-label="Search study resources"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors min-h-[44px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          Search
        </button>
      </form>

      {/* Available Topic Filter Pills */}
      {availableTopics.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
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
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 min-h-[32px] ${
                    isSelected
                      ? "bg-emerald-600 text-white font-semibold shadow-xs"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
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
        <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
          <span className="text-stone-500">
            Active filters: {selectedTopic && <span className="font-semibold text-emerald-800 mr-2">Topic: {selectedTopic}</span>}
            {q && <span className="font-semibold text-emerald-800">Keyword: &quot;{q}&quot;</span>}
          </span>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
