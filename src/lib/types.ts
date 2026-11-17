export const KARATS = ["24K", "22K", "18K"] as const;
export type Karat = (typeof KARATS)[number];

/** One per-gram price for a karat on a given IST calendar date. */
export interface Rate {
  karat: Karat;
  pricePerGram: number;
  /** IST calendar date, YYYY-MM-DD */
  date: string;
  /** ISO-8601 instant the value was fetched */
  fetchedAt: string;
  source: string;
}

export interface ProviderResult {
  /** Today's rates (24K/22K/18K) */
  current: Rate[];
  /** Historical daily rates the source exposes (may omit karats) */
  history: Rate[];
}

/** Swappable data source. Implement this to add a licensed API. */
export interface RateProvider {
  readonly id: string;
  fetchRates(): Promise<ProviderResult>;
}

export interface DailyClose {
  karat: Karat;
  date: string;
  pricePerGram: number;
  source: string;
  /** ISO time this price was last written (saved, imported or ingested). Absent on older entries. */
  updatedAt?: string;
}

export interface Snapshot extends Rate {
  id?: string;
}

export interface IngestState {
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  consecutiveFailures: number;
  lastError: string | null;
  nextRetryAt: string | null;
}

export const EMPTY_INGEST_STATE: IngestState = {
  lastSuccessAt: null,
  lastAttemptAt: null,
  consecutiveFailures: 0,
  lastError: null,
  nextRetryAt: null,
};
