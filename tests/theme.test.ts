import { describe, expect, it } from "vitest";
import { oppositeTheme, resolveTheme, THEME_KEY, themeInitScript } from "@/lib/theme";

function runInit(storage: { getItem: (k: string) => string | null }) {
  const attrs: Record<string, string> = {};
  const doc = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
  new Function("localStorage", "document", themeInitScript)(storage, doc);
  return attrs;
}

describe("resolveTheme", () => {
  it("explicit attribute wins over system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("falls back to system when attribute missing or invalid", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(undefined, false)).toBe("light");
    expect(resolveTheme("sepia", true)).toBe("dark");
  });
});

describe("oppositeTheme", () => {
  it("flips", () => {
    expect(oppositeTheme("light")).toBe("dark");
    expect(oppositeTheme("dark")).toBe("light");
  });
});

describe("themeInitScript", () => {
  it("applies saved light or dark", () => {
    expect(runInit({ getItem: (k) => (k === THEME_KEY ? "dark" : null) })).toEqual({ "data-theme": "dark" });
    expect(runInit({ getItem: () => "light" })).toEqual({ "data-theme": "light" });
  });
  it("ignores garbage and empty values", () => {
    expect(runInit({ getItem: () => "<script>" })).toEqual({});
    expect(runInit({ getItem: () => null })).toEqual({});
  });
  it("does not throw when storage is blocked", () => {
    expect(() =>
      runInit({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).not.toThrow();
  });
});
