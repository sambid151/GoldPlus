import { KARATS, type DailyClose, type Karat } from "@/lib/types";

export interface Move {
  change: number;
  pct: number;
}

export interface HistoryRow {
  date: string;
  prices: Partial<Record<Karat, number>>;
  /** Change versus that karat's previous stored day (absent for the first day). */
  moves: Partial<Record<Karat, Move>>;
}

/** One row per stored date, newest first, with each karat's change since its previous stored day. */
export function buildHistoryRows(closes: DailyClose[]): HistoryRow[] {
  const byDate = new Map<string, Partial<Record<Karat, number>>>();
  for (const c of closes) byDate.set(c.date, { ...byDate.get(c.date), [c.karat]: c.pricePerGram });
  const dates = [...byDate.keys()].sort();

  const last: Partial<Record<Karat, number>> = {};
  const rows: HistoryRow[] = dates.map((date) => {
    const prices = byDate.get(date)!;
    const moves: HistoryRow["moves"] = {};
    for (const k of KARATS) {
      const p = prices[k];
      if (p === undefined) continue;
      const prev = last[k];
      if (prev !== undefined) moves[k] = { change: p - prev, pct: ((p - prev) / prev) * 100 };
      last[k] = p;
    }
    return { date, prices, moves };
  });
  return rows.reverse();
}

export interface MonthSummary {
  /** YYYY-MM */
  month: string;
  days: number;
  first: number;
  last: number;
  high: number;
  low: number;
  /** Percent move from the first to the last stored day of the month. */
  changePct: number;
}

/** Per-month first, last, high, low and % move for one karat, newest month first. */
export function buildMonthlySummary(closes: DailyClose[], karat: Karat): MonthSummary[] {
  const months = new Map<string, DailyClose[]>();
  for (const c of closes) {
    if (c.karat !== karat) continue;
    const m = c.date.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), c]);
  }
  return [...months.entries()]
    .map(([month, list]) => {
      const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
      const prices = sorted.map((c) => c.pricePerGram);
      const first = prices[0];
      const last = prices[prices.length - 1];
      return {
        month,
        days: sorted.length,
        first,
        last,
        high: Math.max(...prices),
        low: Math.min(...prices),
        changePct: ((last - first) / first) * 100,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}
