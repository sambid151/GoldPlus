import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calculator";
import { buildChanges, buildSeries } from "@/lib/chart";
import { buildCard } from "@/lib/dashboard";
import { toQuote } from "@/lib/market";
import { tagHeadline } from "@/lib/news/factors";
import { parseNewsRss } from "@/lib/news/rss";
import type { DailyClose, Karat } from "@/lib/types";

const close = (karat: Karat, date: string, pricePerGram: number): DailyClose => ({ karat, date, pricePerGram, source: "t" });
const closes = [
  close("24K", "2026-08-01", 12000),
  close("24K", "2026-10-10", 13000), close("24K", "2026-11-09", 14460),
  close("24K", "2026-11-15", 13762), close("24K", "2026-11-16", 13680),
  close("22K", "2026-11-16", 12540),
];

describe("buildCard", () => {
  it("compares against the latest earlier close, in rupees and percent", () => {
    const c = buildCard("24K", { pricePerGram: 13680, date: "2026-11-16" }, closes);
    expect(c).toMatchObject({ prevPrice: 13762, prevDate: "2026-11-15", change: -82 });
    expect(c.changePct).toBeCloseTo(-0.5958, 3);
  });
  it("has no change when there is no earlier day", () => {
    const c = buildCard("22K", { pricePerGram: 12540, date: "2026-11-16" }, closes);
    expect(c).toMatchObject({ prevPrice: null, change: null, changePct: null });
  });
  it("skips same-day rows when finding the previous day", () => {
    const c = buildCard("24K", { pricePerGram: 13680, date: "2026-11-15" }, closes);
    expect(c.prevDate).toBe("2026-11-09");
  });
});

describe("buildSeries / buildChanges", () => {
  it("limits ranges relative to the newest stored date", () => {
    expect(buildSeries(closes, "7D").map((r) => r.date)).toEqual(["2026-11-15", "2026-11-16"]);
    expect(buildSeries(closes, "30D").map((r) => r.date)).toEqual(["2026-11-09", "2026-11-15", "2026-11-16"]);
    expect(buildSeries(closes, "90D")).toHaveLength(4);
    expect(buildSeries(closes, "ALL")).toHaveLength(5);
  });
  it("merges karats onto one row per date", () => {
    expect(buildSeries(closes, "7D").at(-1)).toEqual({ date: "2026-11-16", "24K": 13680, "22K": 12540 });
  });
  it("returns nothing for no data", () => expect(buildSeries([], "ALL")).toEqual([]));
  it("computes day-over-day changes and omits the first day", () => {
    const ch = buildChanges(buildSeries(closes, "30D"), "24K");
    expect(ch).toEqual([
      { date: "2026-11-15", change: -698 },
      { date: "2026-11-16", change: -82 },
    ]);
  });
  it("has no change bars for a karat with a single day", () => {
    expect(buildChanges(buildSeries(closes, "ALL"), "22K")).toEqual([]);
  });
});

describe("calculate", () => {
  it("adds making charge then GST 3% on the sum", () => {
    expect(calculate({ weightGrams: 10, ratePerGram: 12540, makingChargePct: 8 })).toEqual({
      goldValue: 125400, makingCharge: 10032, gst: 4062.96, total: 139494.96,
    });
  });
  it("handles zero making charge", () => {
    expect(calculate({ weightGrams: 1, ratePerGram: 10000, makingChargePct: 0 }).total).toBe(10300);
  });
  it("treats invalid input as zero rather than producing NaN", () => {
    const r = calculate({ weightGrams: NaN, ratePerGram: 10000, makingChargePct: -5 });
    expect(r.total).toBe(0);
  });
});

describe("tagHeadline", () => {
  it("tags factors mentioned in a headline", () => {
    expect(tagHeadline("Gold falls as Fed rate-hike fears deepen")).toEqual(expect.arrayContaining(["rates", "cb"]));
    expect(tagHeadline("Rupee slides; dollar index firm")).toContain("usdinr");
    expect(tagHeadline("Dhanteras demand lifts jewellers")).toContain("festive");
    expect(tagHeadline("Crude and inflation worries")).toContain("infl");
    expect(tagHeadline("Gold up amid Middle East tension")).toContain("geo");
  });
  it("returns no tags when nothing matches", () => {
    expect(tagHeadline("Gold rate today in Chennai")).toEqual([]);
  });
});

describe("parseNewsRss", () => {
  const now = new Date("2026-11-16T10:00:00Z");
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Gold slips as rupee gains - Mint</title><link>https://e.com/a</link><pubDate>Mon, 16 Nov 2026 08:00:00 GMT</pubDate><source url="https://mint.com">Mint</source></item>
    <item><title>Old story - Mint</title><link>https://e.com/old</link><pubDate>Mon, 02 Nov 2026 08:00:00 GMT</pubDate><source url="https://mint.com">Mint</source></item>
    <item><title>Gold slips as rupee gains - Other</title><link>https://e.com/dup</link><pubDate>Mon, 16 Nov 2026 07:00:00 GMT</pubDate><source url="https://o.com">Other</source></item>
    <item><title>No date</title><link>https://e.com/nd</link></item>
    <item><title>Newer</title><link>https://e.com/n</link><pubDate>Mon, 16 Nov 2026 09:30:00 GMT</pubDate><source url="https://x.com">X</source></item>
  </channel></rss>`;

  it("keeps only the last 7 days, dedupes titles, strips the source suffix and sorts newest first", () => {
    const items = parseNewsRss(xml, now);
    expect(items.map((i) => i.title)).toEqual(["Newer", "Gold slips as rupee gains"]);
    expect(items[1]).toMatchObject({ source: "Mint", link: "https://e.com/a" });
    expect(items[1].factors).toContain("usdinr");
  });
  it("keeps only title, source, date, link and tags", () => {
    expect(Object.keys(parseNewsRss(xml, now)[0]).sort()).toEqual(["factors", "link", "publishedAt", "source", "title"]);
  });
  it("copes with a single item and an empty feed", () => {
    expect(parseNewsRss(`<rss><channel><item><title>One</title><link>https://e.com</link><pubDate>Mon, 16 Nov 2026 09:00:00 GMT</pubDate></item></channel></rss>`, now)).toHaveLength(1);
    expect(parseNewsRss("<rss><channel></channel></rss>", now)).toEqual([]);
  });
});

describe("toQuote", () => {
  const spec = { id: "usdinr", symbol: "INR=X", label: "USD/INR", note: "n" } as const;
  const ok = (price: number, prev: number) => ({
    chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: prev, regularMarketTime: 1_794_825_600 }, indicators: { quote: [{ close: [1, null, 2] }] } }] },
  });
  it("derives change, percent and drops null points", () => {
    const q = toQuote(spec, ok(94, 94.2));
    expect(q.change).toBeCloseTo(-0.2);
    expect(q.changePct).toBeCloseTo(-0.2123, 3);
    expect(q.points).toEqual([1, 2]);
  });
  it("throws on missing data or non-positive prices", () => {
    expect(() => toQuote(spec, { chart: { result: undefined, error: { description: "Not Found" } } })).toThrow("Not Found");
    expect(() => toQuote(spec, ok(0, 94))).toThrow(/Invalid quote/);
  });
});

describe("refresh-on-view", () => {
  const state = (over: Partial<import("@/lib/types").IngestState> = {}) => ({
    lastSuccessAt: null, lastAttemptAt: null, consecutiveFailures: 0, lastError: null, nextRetryAt: null, ...over,
  });
  const now = new Date("2026-11-16T12:00:00Z");

  it("refreshes when never attempted or the interval has passed", async () => {
    const { shouldRefresh } = await import("@/lib/ingest/refresh");
    expect(shouldRefresh(state(), now, 15)).toBe(true);
    expect(shouldRefresh(state({ lastAttemptAt: "2026-11-16T11:44:00Z" }), now, 15)).toBe(true);
    expect(shouldRefresh(state({ lastAttemptAt: "2026-11-16T11:50:00Z" }), now, 15)).toBe(false);
  });
  it("does not refresh while backing off", async () => {
    const { shouldRefresh } = await import("@/lib/ingest/refresh");
    expect(shouldRefresh(state({ lastAttemptAt: "2026-11-16T10:00:00Z", nextRetryAt: "2026-11-16T12:05:00Z" }), now, 15)).toBe(false);
  });
  it("is on for the spot estimate, off for others unless forced, and clamps the interval", async () => {
    const { refreshEnabled, refreshIntervalMinutes } = await import("@/lib/ingest/refresh");
    expect(refreshEnabled({ RATE_PROVIDER: "spot-estimate" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(refreshEnabled({ RATE_PROVIDER: "licensed" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(refreshEnabled({ RATE_PROVIDER: "licensed", RATE_REFRESH_ON_VIEW: "true" } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(refreshEnabled({ RATE_PROVIDER: "spot-estimate", RATE_REFRESH_ON_VIEW: "false" } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(refreshIntervalMinutes({ RATE_REFRESH_MINUTES: "1" } as unknown as NodeJS.ProcessEnv)).toBe(5);
    expect(refreshIntervalMinutes({} as unknown as NodeJS.ProcessEnv)).toBe(15);
  });
});
