import type { IngestState } from "@/lib/types";

/** Consider data stale if no successful fetch for this long (poller likely down). */
export const STALE_AFTER_MS = 3 * 60 * 60_000;

export interface FreshnessStatus {
  stale: boolean;
  /** Time of the last good fetch; the data has been unchanged-by-source since then. */
  staleSince: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export function getFreshness(state: IngestState, now: Date = new Date()): FreshnessStatus {
  const age = state.lastSuccessAt ? now.getTime() - new Date(state.lastSuccessAt).getTime() : Infinity;
  const stale = state.consecutiveFailures > 0 || age > STALE_AFTER_MS;
  return {
    stale,
    staleSince: stale ? state.lastSuccessAt : null,
    lastSuccessAt: state.lastSuccessAt,
    lastError: state.consecutiveFailures > 0 ? state.lastError : null,
  };
}
