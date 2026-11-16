import { describe, expect, it } from "vitest";
import {
  parseGoodreturns,
  parseRupees,
  parseSourceDate,
} from "@/lib/providers/goodreturns-parser";
import { samplePageHtml } from "./helpers/sample-page";

const html = samplePageHtml();
const opts = { fetchedAt: "2026-11-16T10:00:00.000Z", todayIst: "2026-11-16", source: "goodreturns" };

describe("parseRupees", () => {
  it("handles Indian digit grouping and ignores the delta", () => {
    expect(parseRupees("₹1,09,440")).toBe(109440);
    expect(parseRupees("₹13,680 (-82)")).toBe(13680);
  });
  it("returns NaN when no number is present", () => {
    expect(parseRupees("n/a")).toBeNaN();
  });
});

describe("parseSourceDate", () => {
  it("parses 'Nov 16, 2026'", () => expect(parseSourceDate("Nov 16, 2026")).toBe("2026-11-16"));
  it("parses zero-padded days", () => expect(parseSourceDate("Nov 09, 2026")).toBe("2026-11-09"));
  it("rejects garbage", () => expect(parseSourceDate("yesterday")).toBeNull());
});

describe("parseGoodreturns (saved sample)", () => {
  const result = parseGoodreturns(html, opts);

  it("extracts per-gram rates for 24K, 22K and 18K", () => {
    const by = Object.fromEntries(result.current.map((r) => [r.karat, r.pricePerGram]));
    expect(by).toEqual({ "24K": 13680, "22K": 12540, "18K": 10260 });
  });

  it("dates today's rate from the matching newest history row", () => {
    expect(result.current.every((r) => r.date === "2026-11-16")).toBe(true);
  });

  it("extracts 10 days of 24K and 22K history, no 18K", () => {
    const k24 = result.history.filter((r) => r.karat === "24K");
    expect(k24).toHaveLength(10);
    expect(result.history.filter((r) => r.karat === "22K")).toHaveLength(10);
    expect(result.history.some((r) => r.karat === "18K")).toBe(false);
    expect(k24.at(-1)).toMatchObject({ date: "2026-11-07", pricePerGram: 14357 });
  });

  it("ignores the +/- delta text in history cells", () => {
    const nov13 = result.history.find((r) => r.karat === "24K" && r.date === "2026-11-13");
    expect(nov13?.pricePerGram).toBe(13735);
  });
});

describe("parseGoodreturns failure modes", () => {
  it("throws when the page layout has no tables", () => {
    expect(() => parseGoodreturns("<html><body>oops</body></html>", opts)).toThrow(/not found/);
  });
  it("throws on an empty document", () => {
    expect(() => parseGoodreturns("", opts)).toThrow();
  });
  it("yields NaN prices (to be rejected by validation) when cells are blank", () => {
    const blank = html.replace(/&#x20b9;13,680/, "&#x20b9;");
    const r = parseGoodreturns(blank, opts);
    expect(r.current.find((x) => x.karat === "24K")?.pricePerGram).toBeNaN();
  });
});
