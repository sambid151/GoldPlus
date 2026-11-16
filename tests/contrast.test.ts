import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards the colour tokens in globals.css: every text/background pair the UI uses must keep WCAG AA in both themes.
const css = readFileSync(path.join(__dirname, "../src/app/globals.css"), "utf8");

function tokens(re: RegExp): Record<string, string> {
  const block = css.match(re)?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}
const light = tokens(/:root\s*\{([\s\S]*?)\n\}/);
const dark = { ...light, ...tokens(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/) };

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

type T = Record<string, string>;
const pairs = (t: T): [string, string, string, number][] => [
  ["body on page", t.ink, t.bg, 4.5],
  ["body on light-white band", t.ink, t.surface, 4.5],
  ["muted on page", t.muted, t.bg, 4.5],
  ["muted on light-white band", t.muted, t.surface, 4.5],
  ["muted on brand-wash", t.muted, t["brand-wash"], 4.5],
  ["muted on surface-2", t.muted, t["surface-2"], 4.5],
  ["muted on brand-soft", t.muted, t["brand-soft"], 4.5],
  ["brand-strong on page", t["brand-strong"], t.bg, 4.5],
  ["brand-strong on brand-soft", t["brand-strong"], t["brand-soft"], 4.5],
  ["up on page", t.up, t.bg, 4.5],
  ["up on brand-soft", t.up, t["brand-soft"], 4.5],
  ["down on page", t.down, t.bg, 4.5],
  ["down on down-soft", t.down, t["down-soft"], 4.5],
  ["down on light-white band", t.down, t.surface, 4.5],
  ["warning text", t["warn-ink"], t["warn-bg"], 4.5],
  ["hero text on band start", t["on-band"], t["band-from"], 4.5],
  ["hero text on band end", t["on-band"], t["band-to"], 4.5],
  ["hero muted text on band start", t["on-band-muted"], t["band-from"], 4.5],
  ["hero muted text on band end", t["on-band-muted"], t["band-to"], 4.5],
  ["hero accent text on band end", t["on-band-accent"], t["band-to"], 4.5],
  ["selected chip and primary button", t["on-action"], t.action, 4.5],
  ["delete button", t["on-danger"], t.danger, 4.5],
  ["green-800 button text on white", "#166534", "#ffffff", 4.5],
  ["focus ring on page", t.brand, t.bg, 3],
  ["chart line 24K", t.c24, t.bg, 3],
  ["chart line 22K", t.c22, t.bg, 3],
  ["chart line 18K", t.c18, t.bg, 3],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast", (_name, theme) => {
  it("defines every token the checks need", () => {
    for (const k of ["ink", "bg", "surface", "muted", "brand", "action", "on-action", "danger", "on-danger", "band-from", "band-to", "c24"]) {
      expect(theme[k], `--${k}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it.each(pairs(theme).map((p) => [p[0], p] as const))("%s meets its minimum", (_label, [label, fg, bg, min]) => {
    expect(ratio(fg, bg), `${label}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
  });
});
