import { istDate, istHour } from "@/lib/time";
import type { DailyClose, Snapshot } from "@/lib/types";

export interface UpdateEntry {
  at: string;
  price: number;
}

/**
 * When the rate for `date` was last updated. Uses the time stored with the daily close;
 * older entries fall back to the newest snapshot recorded for that date. Null if unknown.
 */
export function lastUpdateFor(date: string, closes: DailyClose[], snapshots: Snapshot[]): string | null {
  const times = closes.filter((c) => c.date === date && c.updatedAt).map((c) => c.updatedAt!);
  if (times.length > 0) return times.sort().at(-1)!;
  const snaps = snapshots.filter((s) => s.date === date).map((s) => s.fetchedAt);
  return snaps.length > 0 ? snaps.sort().at(-1)! : null;
}

/** 24K price changes recorded on `date`, oldest first (a new entry only when the price moved). */
export function updatesOn(date: string, snapshots: Snapshot[]): UpdateEntry[] {
  const list = snapshots
    .filter((s) => s.date === date && s.karat === "24K")
    .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
  return list
    .filter((s, i) => i === 0 || s.pricePerGram !== list[i - 1].pricePerGram)
    .map((s) => ({ at: s.fetchedAt, price: s.pricePerGram }));
}

/** Rates are often revised in the afternoon: nudge when today's rate is from the morning and it is now afternoon. */
export function shouldNudgeAfternoon(lastUpdatedAt: string | null, now: Date): boolean {
  if (!lastUpdatedAt) return false;
  const sameDay = istDate(lastUpdatedAt) === istDate(now);
  return sameDay && istHour(now) >= 14 && istHour(lastUpdatedAt) < 12;
}
