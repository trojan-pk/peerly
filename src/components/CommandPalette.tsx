"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, BookOpen, FileText, Hash, Inbox, Keyboard, LayoutDashboard, Search, Send, Settings, User, Users } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { searchWorkspace, type PaletteResults } from "@/app/actions/palette";

export const OPEN_PALETTE_EVENT = "peerly:open-palette";

interface Option { id: string; group: string; label: string; detail?: string; href: string; Icon: typeof Search }

const PAGES: Option[] = [
  { id: "p-requests", group: "Pages", label: "Requests sent to you", href: "/dashboard?tab=incoming", Icon: Inbox },
  { id: "p-sent", group: "Pages", label: "Requests you sent", href: "/dashboard?tab=outgoing", Icon: Send },
  { id: "p-peers", group: "Pages", label: "Find a peer helper", href: "/peers", Icon: Users },
  { id: "p-resources", group: "Pages", label: "Resource library", href: "/resources", Icon: BookOpen },
  { id: "p-manage", group: "Pages", label: "Manage my resources", href: "/resources/manage", Icon: FileText },
  { id: "p-notifications", group: "Pages", label: "Notifications", href: "/notifications", Icon: Bell },
  { id: "p-settings", group: "Pages", label: "Profile & settings", href: "/settings", Icon: Settings },
];
const STATUS: Record<string, string> = { PENDING: "Pending", ACCEPTED: "Accepted", REJECTED: "Declined", CANCELLED: "Cancelled", COMPLETED: "Completed", REVIEWED: "Reviewed", EXPIRED: "Expired" };

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}

/**
 * Workspace command palette (⌘K / Ctrl+K) and keyboard-shortcut help (?).
 * Implements the ARIA combobox + listbox pattern: focus stays in the input,
 * arrow keys move aria-activedescendant, Enter opens the highlighted option.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResults | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const close = useCallback(() => { setOpen(false); setQuery(""); setResults(null); setSearchedFor(""); setActive(0); }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setHelp(false);
        setOpen((value) => !value);
      } else if (event.key === "?" && !event.metaKey && !event.ctrlKey && !isTyping(event.target)) {
        event.preventDefault();
        setOpen(false);
        setHelp(true);
      }
    }
    const onOpen = () => { setHelp(false); setOpen(true); };
    document.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener(OPEN_PALETTE_EVENT, onOpen); };
  }, []);

  // Debounced server search; stale responses are ignored.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await searchWorkspace(q);
        if (!cancelled) { setResults(next); setSearchedFor(q); setActive(0); }
      } catch {
        if (!cancelled) { setResults({ peers: [], topics: [], requests: [] }); setSearchedFor(q); }
      }
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, open]);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    const pages = PAGES.filter((p) => !q || p.label.toLowerCase().includes(q));
    if (q.length < 2 || !results || searchedFor !== query.trim()) return pages;
    return [
      ...results.requests.map((r): Option => ({ id: `r-${r.id}`, group: "Your requests", label: r.topic, detail: `${STATUS[r.status]} · ${r.other}`, href: `/dashboard?tab=${r.tab}#request-${r.id}`, Icon: LayoutDashboard })),
      ...results.peers.map((p): Option => ({ id: `u-${p.id}`, group: "Peers", label: p.name, detail: p.detail, href: `/peers/${p.id}`, Icon: User })),
      ...results.topics.map((t): Option => ({ id: `t-${t}`, group: "Topics", label: t, detail: "Find helpers", href: `/peers?topic=${encodeURIComponent(t)}`, Icon: Hash })),
      ...pages,
    ];
  }, [query, results, searchedFor]);

  const current = Math.min(active, Math.max(0, options.length - 1));

  function go(option: Option | undefined) {
    if (!option) return;
    close();
    router.push(option.href);
  }

  function onInputKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((current + 1) % Math.max(1, options.length)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((current - 1 + options.length) % Math.max(1, options.length)); }
    else if (event.key === "Home") { event.preventDefault(); setActive(0); }
    else if (event.key === "End") { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === "Enter") { event.preventDefault(); go(options[current]); }
  }

  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, listId]);

  const searching = query.trim().length >= 2 && searchedFor !== query.trim();

  return (
    <>
      <Dialog open={open} onClose={close} title={<span className="sr-only">Search Peerly</span>} size="md" hideCloseButton initialFocusRef={inputRef}>
        <div className="palette">
          <div className="palette-input-row">
            <Search size={18} aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-label="Search pages, peers, topics and your requests"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={options.length ? `${listId}-${current}` : undefined}
              placeholder="Search pages, peers, topics, requests…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onInputKey}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="kbd">Esc</kbd>
          </div>
          <ul id={listId} role="listbox" aria-label="Results" className="palette-list" aria-busy={searching || undefined}>
            {options.map((option, index) => {
              const header = index === 0 || options[index - 1].group !== option.group ? option.group : null;
              return (
                <li key={option.id} role="presentation">
                  {header && <div className="palette-group" role="presentation" aria-hidden="true">{header}</div>}
                  <div id={`${listId}-${index}`} role="option" aria-selected={index === current} className="palette-option" onMouseMove={() => setActive(index)} onClick={() => go(option)}>
                    <option.Icon size={16} aria-hidden="true" />
                    <span>{option.label}</span>
                    {option.detail && <small>{option.detail}</small>}
                  </div>
                </li>
              );
            })}
            {options.length === 0 && <li role="presentation" className="palette-empty">{searching ? "Searching…" : `No matches for “${query.trim()}”.`}</li>}
          </ul>
          <div className="palette-foot" aria-hidden="true">
            <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> move</span>
            <span><kbd className="kbd">↵</kbd> open</span>
            <span><kbd className="kbd">?</kbd> shortcuts</span>
          </div>
        </div>
      </Dialog>

      <Dialog open={help} onClose={() => setHelp(false)} title={<span className="inline-flex items-center gap-2"><Keyboard size={18} aria-hidden="true" />Keyboard shortcuts</span>} size="sm">
        <dl className="shortcut-list">
          <div><dt>Search anything</dt><dd><kbd className="kbd">Ctrl</kbd><kbd className="kbd">K</kbd> <span className="sr-only">or</span><kbd className="kbd">⌘</kbd><kbd className="kbd">K</kbd></dd></div>
          <div><dt>Show this help</dt><dd><kbd className="kbd">?</kbd></dd></div>
          <div><dt>Accept the focused request</dt><dd><kbd className="kbd">A</kbd></dd></div>
          <div><dt>Decline the focused request</dt><dd><kbd className="kbd">R</kbd></dd></div>
          <div><dt>Close a dialog</dt><dd><kbd className="kbd">Esc</kbd></dd></div>
        </dl>
        <p className="mt-4 text-sm text-muted">Tab to a request card on your dashboard to use A and R. They only work on pending requests sent to you.</p>
      </Dialog>
    </>
  );
}

export function PaletteButton({ compact = false }: { compact?: boolean }) {
  return (
    <button type="button" className={`palette-trigger ${compact ? "is-icon" : ""}`} onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))} aria-label="Search Peerly" aria-keyshortcuts="Control+K Meta+K">
      <Search size={17} aria-hidden="true" />
      {!compact && <><span>Search</span><kbd className="kbd">Ctrl K</kbd></>}
    </button>
  );
}
