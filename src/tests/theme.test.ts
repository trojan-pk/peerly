import { describe, expect, it, beforeEach } from "vitest";
import { runInNewContext } from "node:vm";
import { resolveTheme, isThemePreference, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme preference resolution", () => {
  it("maps explicit preferences regardless of the system setting", () => {
    expect(resolveTheme("light", true)).toBe("paper");
    expect(resolveTheme("dark", false)).toBe("ink");
  });
  it("follows the system for the system preference", () => {
    expect(resolveTheme("system", true)).toBe("ink");
    expect(resolveTheme("system", false)).toBe("paper");
  });
  it("rejects unknown stored values", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

describe("pre-paint theme script", () => {
  let dataset: Record<string, string>;
  let listeners: Array<() => void>;
  function run(stored: string | null, prefersDark: boolean, storageThrows = false) {
    dataset = {};
    listeners = [];
    const media = { matches: prefersDark, addEventListener: (_: string, fn: () => void) => listeners.push(fn) };
    runInNewContext(THEME_INIT_SCRIPT, {
      document: { documentElement: { dataset } },
      window: { matchMedia: () => media },
      localStorage: { getItem: (key: string) => { if (storageThrows) throw new Error("blocked"); return key === THEME_STORAGE_KEY ? stored : null; } },
    });
    return media;
  }
  beforeEach(() => { dataset = {}; });

  it("applies a stored dark preference before paint", () => {
    run("dark", false);
    expect(dataset).toEqual({ theme: "ink", themePreference: "dark" });
  });
  it("defaults to system when storage is empty, invalid or blocked", () => {
    run(null, true); expect(dataset.theme).toBe("ink");
    run("neon", false); expect(dataset).toEqual({ theme: "paper", themePreference: "system" });
    run(null, true, true); expect(dataset).toEqual({ theme: "ink", themePreference: "system" });
  });
  it("follows live OS changes only while the preference is system", () => {
    const media = run(null, false);
    media.matches = true; listeners.forEach((fn) => fn());
    expect(dataset.theme).toBe("ink");
    dataset.themePreference = "light"; dataset.theme = "paper";
    media.matches = false; listeners.forEach((fn) => fn());
    media.matches = true; listeners.forEach((fn) => fn());
    expect(dataset.theme).toBe("paper");
  });
});
