import { addDays } from "@/lib/time";
import { KARATS, type DailyClose, type Karat } from "@/lib/types";

export type Range = "7D" | "30D" | "90D" | "ALL";
export const RANGES: Range[] = ["7D", "30D", "90D", "ALL"];
const RANGE_DAYS: Record<Exclude<Range, "ALL">, number> = { "7D": 7, "30D": 30, "90D": 90 };

export interface SeriesRow {
  date: string;
  "24K"?: number;
  "22K"?: number;
  "18K"?: number;
}

export interface ChangeRow {
  date: string;
  change: number;
}

/** Rows (one per date) limited to the range ending at the newest stored date. */
export function buildSeries(closes: DailyClose[], range: Range): SeriesRow[] {
  if (closes.length === 0) return [];
  const newest = closes.reduce((m, c) => (c.date > m ? c.date : m), closes[0].date);
  const from = range === "ALL" ? "" : addDays(newest, -(RANGE_DAYS[range] - 1));
  const byDate = new Map<string, SeriesRow>();
  for (const c of closes) {
    if (c.date < from) continue;
    const row = byDate.get(c.date) ?? { date: c.date };
    row[c.karat] = c.pricePerGram;
    byDate.set(c.date, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Day-over-day change for one karat; the first day has no predecessor and is omitted. */
export function buildChanges(series: SeriesRow[], karat: Karat): ChangeRow[] {
  const points = series.filter((r) => r[karat] !== undefined);
  return points.slice(1).map((r, i) => ({
    date: r.date,
    change: (r[karat] as number) - (points[i][karat] as number),
  }));
}

export const availableKarats = (closes: DailyClose[]): Karat[] =>
  KARATS.filter((k) => closes.some((c) => c.karat === k));
