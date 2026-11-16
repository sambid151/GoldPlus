import type { IngestState } from "@/lib/types";
import { isSpotEstimate } from "@/lib/providers/name";

const MIN_REFRESH_MINUTES = 5;

/** Refresh-on-view keeps spot data fresh without needing a frequent cron (Vercel free allows daily). */
export function refreshEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.RATE_REFRESH_ON_VIEW === "false") return false;
  return env.RATE_REFRESH_ON_VIEW === "true" || isSpotEstimate(env);
}

export function refreshIntervalMinutes(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.RATE_REFRESH_MINUTES ?? 15);
  return Number.isFinite(n) ? Math.max(MIN_REFRESH_MINUTES, n) : 15;
}

/** Pure: has it been long enough since the last attempt, and are we not backing off? */
export function shouldRefresh(state: IngestState, now: Date, intervalMinutes: number): boolean {
  if (state.nextRetryAt && new Date(state.nextRetryAt) > now) return false;
  if (!state.lastAttemptAt) return true;
  return now.getTime() - new Date(state.lastAttemptAt).getTime() >= intervalMinutes * 60_000;
}
