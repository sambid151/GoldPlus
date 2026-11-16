import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runIngest } from "@/lib/ingest/ingest";
import { FileRateRepository } from "@/lib/repo/file-repository";
import { mapSpotResponse, MAX_DATA_AGE_MS, SpotEstimateProvider } from "@/lib/providers/spot-estimate";
import { seriesOf } from "@/lib/series";
import { validateBatch } from "@/lib/validation";

// Trimmed from a real response of GET https://xaus.com/api/v1/spot?currency=INR&unit=gram (16 Nov 2026).
const real = {
  xau: { price: 11768.4967, currency: "INR", unit: "gram" },
  spot_usd_oz: 3877.570068,
  per_gram_usd: 124.6668,
  fx_rate: 94.399626,
  fx_stale: false,
  updated_at: "2026-11-16T11:40:45.736Z",
  source: "xaus.com",
};
const NOW = new Date("2026-11-16T11:45:00Z");

describe("mapSpotResponse (real sample)", () => {
  const r = mapSpotResponse(real, NOW);

  it("treats the spot price as pure 24K and derives 22K and 18K by purity", () => {
    expect(r.current.map((x) => [x.karat, x.pricePerGram])).toEqual([["24K", 11768.5], ["22K", 10787.79], ["18K", 8826.37]]);
  });
  it("stamps data with its own time, IST date and a series source", () => {
    expect(r.current.every((x) => x.fetchedAt === "2026-11-16T11:40:45.736Z" && x.date === "2026-11-16" && x.source === "spot-estimate")).toBe(true);
  });
  it("uses the data's IST date, not the fetch date, around midnight", () => {
    const late = { ...real, updated_at: "2026-11-16T19:00:00Z" }; // 00:30 IST on the 17th
    expect(mapSpotResponse(late, new Date("2026-11-16T19:05:00Z")).current[0].date).toBe("2026-11-17");
  });
  it("does not invent history", () => expect(r.history).toEqual([]));
  it("produces a batch that passes validation", () => expect(validateBatch(r.current, {}).ok).toBe(true));
});

describe("mapSpotResponse rejects untrustworthy data", () => {
  it("rejects data older than the freshness window even if the HTTP call succeeded", () => {
    const old = { ...real, updated_at: new Date(NOW.getTime() - MAX_DATA_AGE_MS - 60_000).toISOString() };
    expect(() => mapSpotResponse(old, NOW)).toThrow(/minutes old/);
  });
  it("rejects timestamps in the future", () => {
    expect(() => mapSpotResponse({ ...real, updated_at: "2026-11-16T13:00:00Z" }, NOW)).toThrow(/future/);
  });
  it("rejects a stale FX table", () => {
    expect(() => mapSpotResponse({ ...real, fx_stale: true }, NOW)).toThrow(/stale FX/);
  });
  it("rejects wrong currency, wrong unit, zero price and bad dates", () => {
    expect(() => mapSpotResponse({ ...real, xau: { ...real.xau, currency: "USD" } }, NOW)).toThrow(/unexpected shape/);
    expect(() => mapSpotResponse({ ...real, xau: { ...real.xau, unit: "troy_oz" } }, NOW)).toThrow(/unexpected shape/);
    expect(() => mapSpotResponse({ ...real, xau: { ...real.xau, price: 0 } }, NOW)).toThrow(/unexpected shape/);
    expect(() => mapSpotResponse({ ...real, updated_at: "yesterday" }, NOW)).toThrow(/unexpected shape/);
    expect(() => mapSpotResponse({}, NOW)).toThrow(/unexpected shape/);
    expect(() => mapSpotResponse(null, NOW)).toThrow(/unexpected shape/);
  });
});

describe("SpotEstimateProvider", () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW, toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("calls the INR per-gram endpoint with an honest User-Agent", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(real)));
    const r = await new SpotEstimateProvider(f as unknown as typeof fetch).fetchRates();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://xaus.com/api/v1/spot?currency=INR&unit=gram");
    expect((init.headers as Record<string, string>)["User-Agent"]).toMatch(/^GoldPulse/);
    expect(r.current).toHaveLength(3);
  });
  it("surfaces HTTP errors (including 429) and non-JSON bodies", async () => {
    const f429 = vi.fn(async () => new Response("", { status: 429 }));
    await expect(new SpotEstimateProvider(f429 as unknown as typeof fetch).fetchRates()).rejects.toThrow("Spot feed responded 429");
    const fHtml = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(new SpotEstimateProvider(fHtml as unknown as typeof fetch).fetchRates()).rejects.toThrow(/non-JSON/);
  });
});

describe("series guard", () => {
  let dir: string;
  let repo: FileRateRepository;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "goldpulse-series-"));
    repo = new FileRateRepository(path.join(dir, "db.json"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("groups sources into comparable series", () => {
    expect(seriesOf("saved-html")).toBe(seriesOf("goodreturns"));
    expect(seriesOf("licensed")).toBe(seriesOf("licensed-derived"));
    expect(seriesOf("spot-estimate")).not.toBe(seriesOf("saved-html"));
  });

  it("refuses to mix a spot estimate into stored retail data", async () => {
    const retail = { id: "retail", fetchRates: async () => ({ history: [], current: (["24K", "22K", "18K"] as const).map((karat, i) => ({ karat, pricePerGram: [13680, 12540, 10260][i], date: "2026-11-16", fetchedAt: "2026-11-16T10:00:00.000Z", source: "saved-html" })) }) };
    expect((await runIngest({ provider: retail, repo, now: () => NOW })).status).toBe("ok");

    const spot = { id: "spot", fetchRates: async () => mapSpotResponse(real, NOW) };
    const out = await runIngest({ provider: spot, repo, now: () => NOW });
    expect(out.status).toBe("failed");
    expect(out.status === "failed" && out.reasons[0]).toMatch(/Data source changed/);
    expect((await repo.getLatestSnapshots())["24K"]?.pricePerGram).toBe(13680); // untouched
  });

  it("ingests spot estimates normally into an empty store, and keeps going", async () => {
    const spot = { id: "spot", fetchRates: async () => mapSpotResponse(real, NOW) };
    expect(await runIngest({ provider: spot, repo, now: () => NOW })).toMatchObject({ status: "ok", snapshotsWritten: 3 });
    const moved = { ...real, xau: { ...real.xau, price: 11800 }, updated_at: "2026-11-16T12:30:00Z" };
    const later = { id: "spot", fetchRates: async () => mapSpotResponse(moved, new Date("2026-11-16T12:31:00Z")) };
    expect(await runIngest({ provider: later, repo, now: () => new Date("2026-11-16T12:31:00Z") })).toMatchObject({ status: "ok", snapshotsWritten: 3 });
  });
});
