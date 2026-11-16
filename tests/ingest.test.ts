import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backoffDelayMs, runIngest } from "@/lib/ingest/ingest";
import { getFreshness } from "@/lib/ingest/status";
import { FileRateRepository } from "@/lib/repo/file-repository";
import type { Karat, ProviderResult, Rate, RateProvider } from "@/lib/types";

const mk = (karat: Karat, pricePerGram: number, date = "2026-11-16"): Rate => ({
  karat, pricePerGram, date, fetchedAt: "2026-11-16T10:00:00.000Z", source: "test",
});
const day = (p24: number, p22: number, p18: number, date?: string) => [
  mk("24K", p24, date), mk("22K", p22, date), mk("18K", p18, date),
];

function provider(result: ProviderResult | Error): RateProvider {
  return {
    id: "test",
    fetchRates: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

let dir: string;
let repo: FileRateRepository;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "goldpulse-"));
  repo = new FileRateRepository(path.join(dir, "db.json"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const at = (iso: string) => () => new Date(iso);

describe("runIngest", () => {
  it("backfills history once and writes first snapshots", async () => {
    const history = [mk("24K", 13762, "2026-11-15"), mk("22K", 12615, "2026-11-15")];
    const out = await runIngest({
      provider: provider({ current: day(13680, 12540, 10260), history }),
      repo, now: at("2026-11-16T10:00:00Z"),
    });
    expect(out).toMatchObject({ status: "ok", snapshotsWritten: 3, backfilled: 2 });
    expect((await repo.getDailyCloses()).length).toBe(5);
  });

  it("does not store a snapshot when nothing changed, and does not re-backfill", async () => {
    const p = provider({ current: day(13680, 12540, 10260), history: [mk("24K", 13762, "2026-11-15")] });
    await runIngest({ provider: p, repo, now: at("2026-11-16T10:00:00Z") });
    const second = await runIngest({ provider: p, repo, now: at("2026-11-16T10:30:00Z") });
    expect(second).toMatchObject({ status: "ok", snapshotsWritten: 0, backfilled: 0 });
    expect((await repo.getSnapshots()).length).toBe(3);
  });

  it("writes a new snapshot when the price changes and overwrites the day's close", async () => {
    const h = { history: [] as Rate[] };
    await runIngest({ provider: provider({ current: day(13680, 12540, 10260), ...h }), repo, now: at("2026-11-16T10:00:00Z") });
    await runIngest({ provider: provider({ current: day(13700, 12558, 10275), ...h }), repo, now: at("2026-11-16T12:00:00Z") });
    expect((await repo.getSnapshots()).length).toBe(6);
    const closes = (await repo.getDailyCloses()).filter((c) => c.karat === "24K" && c.date === "2026-11-16");
    expect(closes).toHaveLength(1);
    expect(closes[0].pricePerGram).toBe(13700);
  });

  it("keeps last good data and marks stale when the source throws", async () => {
    await runIngest({ provider: provider({ current: day(13680, 12540, 10260), history: [] }), repo, now: at("2026-11-16T10:00:00Z") });
    const out = await runIngest({ provider: provider(new Error("Source responded 503")), repo, now: at("2026-11-16T10:30:00Z") });
    expect(out.status).toBe("failed");
    expect((await repo.getLatestSnapshots())["24K"]?.pricePerGram).toBe(13680);

    const freshness = getFreshness(await repo.getIngestState(), new Date("2026-11-16T10:31:00Z"));
    expect(freshness).toMatchObject({ stale: true, staleSince: "2026-11-16T10:00:00.000Z" });
  });

  it("rejects a >15% jump and keeps the previous value", async () => {
    await runIngest({ provider: provider({ current: day(13680, 12540, 10260), history: [] }), repo, now: at("2026-11-16T10:00:00Z") });
    const out = await runIngest({ provider: provider({ current: day(20000, 18333, 15000), history: [] }), repo, now: at("2026-11-16T10:30:00Z") });
    expect(out.status).toBe("failed");
    expect((await repo.getLatestSnapshots())["24K"]?.pricePerGram).toBe(13680);
  });

  it("rejects an empty or zero result", async () => {
    expect((await runIngest({ provider: provider({ current: [], history: [] }), repo, now: at("2026-11-16T10:00:00Z") })).status).toBe("failed");
  });

  it("skips while backing off, then recovers and clears the stale flag", async () => {
    await runIngest({ provider: provider(new Error("down")), repo, now: at("2026-11-16T10:00:00Z") });
    const skipped = await runIngest({ provider: provider({ current: day(13680, 12540, 10260), history: [] }), repo, now: at("2026-11-16T10:01:00Z") });
    expect(skipped.status).toBe("skipped");

    const ok = await runIngest({ provider: provider({ current: day(13680, 12540, 10260), history: [] }), repo, now: at("2026-11-16T10:06:00Z") });
    expect(ok.status).toBe("ok");
    expect(getFreshness(await repo.getIngestState(), new Date("2026-11-16T10:07:00Z")).stale).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("doubles and caps", () => {
    expect(backoffDelayMs(1)).toBe(5 * 60_000);
    expect(backoffDelayMs(2)).toBe(10 * 60_000);
    expect(backoffDelayMs(20)).toBe(4 * 60 * 60_000);
  });
});

describe("getFreshness", () => {
  it("is stale when the last success is older than 3 hours", () => {
    const f = getFreshness(
      { lastSuccessAt: "2026-11-16T05:00:00.000Z", lastAttemptAt: null, consecutiveFailures: 0, lastError: null, nextRetryAt: null },
      new Date("2026-11-16T10:00:00Z"),
    );
    expect(f.stale).toBe(true);
  });
  it("is stale (no timestamp) when nothing has ever succeeded", () => {
    const f = getFreshness({ lastSuccessAt: null, lastAttemptAt: null, consecutiveFailures: 0, lastError: null, nextRetryAt: null });
    expect(f).toMatchObject({ stale: true, staleSince: null });
  });
});
