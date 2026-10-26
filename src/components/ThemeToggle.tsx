"use client";

import { useRef, useSyncExternalStore, type KeyboardEvent } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyThemePreference,
  readThemePreference,
  THEME_CHANGE_EVENT,
  THEME_PREFERENCES,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: Record<ThemePreference, { label: string; Icon: typeof Sun }> = {
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
  system: { label: "System", Icon: Monitor },
};

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Light / Dark / System selector implemented as an ARIA radio group:
 * one tab stop, arrow keys move and select, Home/End jump to the ends.
 * `compact` renders icon-only radios (labels remain available to assistive tech).
 */
export function ThemeToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  // Server snapshot is null: no option is checked until the client knows the stored value.
  const current = useSyncExternalStore(subscribe, readThemePreference, () => null);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function choose(preference: ThemePreference, focus = false) {
    applyThemePreference(preference);
    if (focus) refs.current[preference]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = THEME_PREFERENCES.indexOf(current ?? "system");
    const last = THEME_PREFERENCES.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    choose(THEME_PREFERENCES[next], true);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`theme-toggle ${compact ? "is-compact" : ""} ${className}`}
      onKeyDown={onKeyDown}
    >
      {THEME_PREFERENCES.map((preference) => {
        const { label, Icon } = OPTIONS[preference];
        const checked = current === preference;
        // Before hydration nothing is checked; keep "system" focusable so the group has a tab stop.
        const focusable = current === null ? preference === "system" : checked;
        return (
          <button
            key={preference}
            ref={(node) => { refs.current[preference] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={compact ? `${label} theme` : undefined}
            title={compact ? `${label} theme` : undefined}
            tabIndex={focusable ? 0 : -1}
            data-theme-option={preference}
            onClick={() => choose(preference)}
          >
            <Icon size={compact ? 16 : 15} aria-hidden="true" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
