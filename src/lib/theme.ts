/**
 * Theme preference handling shared by the pre-paint script and the client toggle.
 *
 * Preference ("light" | "dark" | "system") is stored in localStorage. The resolved
 * theme is written to <html data-theme="paper|ink"> before first paint by
 * THEME_INIT_SCRIPT, so there is no flash of the wrong theme.
 */
export const THEME_STORAGE_KEY = "peerly-theme";
export const THEME_CHANGE_EVENT = "peerly-theme-change";

export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "paper" | "ink";

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value);
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "dark") return "ink";
  if (preference === "light") return "paper";
  return systemPrefersDark ? "ink" : "paper";
}

/**
 * Inline, dependency-free script executed in <head> before the body renders.
 * It must stay self-contained (no imports) and is hashed for the CSP in Phase 7.
 * When the preference is "system" it also follows live OS theme changes.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)},r=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}if(p!=="light"&&p!=="dark")p="system";r.dataset.themePreference=p;r.dataset.theme=p==="dark"||(p==="system"&&m.matches)?"ink":"paper"}a();m.addEventListener("change",function(){if(r.dataset.themePreference==="system")a()})}catch(e){}})();`;

/** Applies a preference immediately (client only) and notifies subscribers. */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page.
  }
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  // Suppress colour transitions for the switch itself so the change is instant.
  root.setAttribute("data-theme-switching", "");
  root.dataset.themePreference = preference;
  root.dataset.theme = resolveTheme(preference, systemDark);
  window.requestAnimationFrame(() => root.removeAttribute("data-theme-switching"));
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function readThemePreference(): ThemePreference {
  const value = document.documentElement.dataset.themePreference;
  return isThemePreference(value) ? value : "system";
}
