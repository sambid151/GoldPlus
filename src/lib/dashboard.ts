import { after, connection } from "next/server";
import { cache } from "react";
import { runIngest } from "@/lib/ingest/ingest";
import { refreshEnabled, refreshIntervalMinutes, shouldRefresh } from "@/lib/ingest/refresh";
import { getFreshness, type FreshnessStatus } from "@/lib/ingest/status";
import { getRateProvider } from "@/lib/providers";
import { getRepository } from "@/lib/repo";
import { istDate } from "@/lib/time";
import { KARATS, type DailyClose, type Karat } from "@/lib/types";

export interface RateCardData {
  karat: Karat;
  pricePerGram: number;
  /** IST date the source attributes the rate to */
  date: string;
  prevPrice: number | null;
  prevDate: string | null;
  change: number | null;
  changePct: number | null;
}

export interface DashboardData {
  cards: RateCardData[];
  freshness: FreshnessStatus;
  closes: DailyClose[];
  /** Newest stored date across karats, and today in IST. */
  latestDate: string | null;
  today: string;
  /** Whole days between the newest stored rate and today (0 = up to date). */
  daysBehind: number;
}

/** Whole days from `from` to `to` (YYYY-MM-DD, both calendar dates). Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/** Pure: the newest daily close per karat. */
export function latestPerKarat(closes: DailyClose[]): Partial<Record<Karat, DailyClose>> {
  const out: Partial<Record<Karat, DailyClose>> = {};
  for (const c of closes) {
    const cur = out[c.karat];
    if (!cur || c.date > cur.date) out[c.karat] = c;
  }
  return out;
}

/** Pure: derive a card from the latest price and the daily closes before its date. */
export function buildCard(
  karat: Karat,
  latest: { pricePerGram: number; date: string },
  closes: DailyClose[],
): RateCardData {
  const prev = closes
    .filter((c) => c.karat === karat && c.date < latest.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const change = prev ? latest.pricePerGram - prev.pricePerGram : null;
  return {
    karat,
    pricePerGram: latest.pricePerGram,
    date: latest.date,
    prevPrice: prev?.pricePerGram ?? null,
    prevDate: prev?.date ?? null,
    change,
    changePct: prev && change !== null ? (change / prev.pricePerGram) * 100 : null,
  };
}

/** Deduped per request. Reads only stored data; never a hard-coded price. */
export const getDashboardData = cache(async (): Promise<DashboardData> => {
  // Stored data and "now" are per-request values: opt out of prerendering explicitly.
  await connection();
  const repo = getRepository();
  const [closes, state] = await Promise.all([repo.getDailyCloses(), repo.getIngestState()]);
  const now = new Date();
  if (refreshEnabled() && shouldRefresh(state, now, refreshIntervalMinutes())) {
    // Claim the slot first so concurrent views do not all refresh, then ingest after the response.
    await repo.saveIngestState({ ...state, lastAttemptAt: now.toISOString() });
    after(async () => {
      try {
        await runIngest({ provider: getRateProvider(), repo });
      } catch (e) {
        console.error("background refresh failed:", e instanceof Error ? e.message : e);
      }
    });
  }
  // Cards come from daily closes, so manual entries, imports and ingest all behave the same.
  const latest = latestPerKarat(closes);
  const cards = KARATS.flatMap((k) => (latest[k] ? [buildCard(k, latest[k]!, closes)] : []));
  const latestDate = cards.map((c) => c.date).sort().at(-1) ?? null;
  const today = istDate(now);
  return {
    cards,
    freshness: getFreshness(state, now),
    closes,
    latestDate,
    today,
    daysBehind: latestDate ? Math.max(0, daysBetween(latestDate, today)) : 0,
  };
});
