import type { RateRepository } from "@/lib/repo/types";
import { KARATS, type IngestState, type Karat, type RateProvider } from "@/lib/types";
import { seriesOf } from "@/lib/series";
import { validateBatch, validateRate } from "@/lib/validation";

const BACKOFF_BASE_MS = 5 * 60_000;
const BACKOFF_MAX_MS = 4 * 60 * 60_000;

export function backoffDelayMs(consecutiveFailures: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, consecutiveFailures - 1), BACKOFF_MAX_MS);
}

export type IngestOutcome =
  | { status: "ok"; snapshotsWritten: number; backfilled: number }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reasons: string[]; nextRetryAt: string };

interface Deps {
  provider: RateProvider;
  repo: RateRepository;
  now?: () => Date;
}

/**
 * One ingest pass:
 * fetch -> validate -> (snapshot on change) + (daily close) + (first-run backfill).
 * On any failure the last good data is untouched; only ingest_state changes.
 */
export async function runIngest({ provider, repo, now = () => new Date() }: Deps): Promise<IngestOutcome> {
  const state = await repo.getIngestState();
  const at = now();

  if (state.nextRetryAt && new Date(state.nextRetryAt) > at) {
    return { status: "skipped", reason: `backing off until ${state.nextRetryAt}` };
  }

  try {
    const { current, history } = await provider.fetchRates();

    const latest = await repo.getLatestSnapshots();
    const lastGood: Partial<Record<Karat, number>> = {};
    for (const k of KARATS) if (latest[k]) lastGood[k] = latest[k]!.pricePerGram;

    const stored = KARATS.map((k) => latest[k]?.source).find(Boolean);
    const incoming = current[0]?.source;
    if (stored && incoming && seriesOf(stored) !== seriesOf(incoming)) {
      return await recordFailure(repo, state, at, [
        `Data source changed (${stored} -> ${incoming}). The series are not comparable; clear stored data or use a new database before switching.`,
      ]);
    }

    const check = validateBatch(current, lastGood);
    if (!check.ok) return await recordFailure(repo, state, at, check.reasons);

    let snapshotsWritten = 0;
    for (const rate of current) {
      if (latest[rate.karat]?.pricePerGram !== rate.pricePerGram) {
        await repo.insertSnapshot(rate);
        snapshotsWritten++;
      }
    }

    const existing = await repo.getDailyCloses();
    const backfillRows = existing.length === 0
      ? history.filter((h) => validateRate(h).ok)
      : [];
    await repo.upsertDailyCloses([
      ...backfillRows,
      ...current.map((r) => ({
        karat: r.karat, date: r.date, pricePerGram: r.pricePerGram, source: r.source,
      })),
    ]);

    // Freshness tracks when the data was obtained (a saved file may be old), not when we polled.
    const obtainedAt = current.map((r) => r.fetchedAt).sort()[0] ?? at.toISOString();
    await repo.saveIngestState({
      lastSuccessAt: obtainedAt,
      lastAttemptAt: at.toISOString(),
      consecutiveFailures: 0,
      lastError: null,
      nextRetryAt: null,
    });
    return { status: "ok", snapshotsWritten, backfilled: backfillRows.length };
  } catch (e) {
    return await recordFailure(repo, state, at, [e instanceof Error ? e.message : String(e)]);
  }
}

async function recordFailure(
  repo: RateRepository,
  prev: IngestState,
  at: Date,
  reasons: string[],
): Promise<IngestOutcome> {
  const failures = prev.consecutiveFailures + 1;
  const nextRetryAt = new Date(at.getTime() + backoffDelayMs(failures)).toISOString();
  await repo.saveIngestState({
    ...prev,
    lastAttemptAt: at.toISOString(),
    consecutiveFailures: failures,
    lastError: reasons.join("; ").slice(0, 500),
    nextRetryAt,
  });
  return { status: "failed", reasons, nextRetryAt };
}
