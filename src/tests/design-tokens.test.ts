import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Parses the Paper & Ink token file and checks every text/background role pair
 * against WCAG 2.2 AA. Values are resolved through primitive var() references,
 * so this test protects against a token edit silently breaking contrast.
 */
const css = readFileSync(path.join(process.cwd(), "src/app/styles/tokens.css"), "utf8");

function block(selector: RegExp): Record<string, string> {
  const match = css.match(selector);
  if (!match) throw new Error(`Token block not found: ${selector}`);
  const vars: Record<string, string> = {};
  for (const [, name, value] of match[1].matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[name] = value.trim();
  return vars;
}

const primitives = block(/:root\s*\{([^}]*)\}/);
const paper = block(/:root,\s*\[data-theme="paper"\]\s*\{([^}]*)\}/);
const ink = block(/\[data-theme="ink"\]\s*\{([^}]*)\}/);

function resolve(theme: Record<string, string>, name: string): string {
  let value = theme[name];
  for (let i = 0; i < 5 && value?.startsWith("var("); i++) {
    const ref = value.slice(6, -1);
    value = theme[ref] ?? primitives[ref];
  }
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Token ${name} did not resolve to a hex colour: ${value}`);
  return value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const backgrounds = ["pi-canvas", "pi-panel", "pi-surface", "pi-raised"];
const textRoles = ["pi-ink", "pi-body", "pi-muted", "pi-faint", "pi-accent", "pi-danger", "pi-warning", "pi-info", "pi-lilac", "pi-success"];

describe.each([["Paper", paper], ["Ink", ink]] as const)("%s theme contrast (WCAG AA)", (_name, theme) => {
  it.each(textRoles.flatMap((fg) => backgrounds.map((bg) => [fg, bg])))("%s on %s ≥ 4.5:1", (fg, bg) => {
    expect(contrast(resolve(theme, fg), resolve(theme, bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("button text on primary action and its hover state ≥ 4.5:1", () => {
    expect(contrast(resolve(theme, "pi-on-action"), resolve(theme, "pi-action"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(resolve(theme, "pi-on-action"), resolve(theme, "pi-action-hover"))).toBeGreaterThanOrEqual(4.5);
  });

  it("accent-filled controls keep readable text", () => {
    expect(contrast(resolve(theme, "pi-accent-ink"), resolve(theme, "pi-accent"))).toBeGreaterThanOrEqual(4.5);
  });

  it("highlighter keeps its text readable", () => {
    expect(contrast(resolve(theme, "pi-highlight-ink"), resolve(theme, "pi-highlight"))).toBeGreaterThanOrEqual(4.5);
  });

  it("input borders are distinguishable from surfaces (non-text ≥ 3:1)", () => {
    for (const bg of ["pi-surface", "pi-panel", "pi-canvas"]) {
      expect(contrast(resolve(theme, "pi-edge"), resolve(theme, bg))).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("theme token coverage", () => {
  it("defines every semantic role in both themes", () => {
    const paperRoles = Object.keys(paper).filter((k) => k.startsWith("pi-")).sort();
    const inkRoles = Object.keys(ink).filter((k) => k.startsWith("pi-")).sort();
    expect(inkRoles).toEqual(paperRoles);
  });
});
