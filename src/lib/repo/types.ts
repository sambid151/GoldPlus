import type { DailyClose, IngestState, Karat, Rate, Snapshot } from "@/lib/types";

/** Storage port. Implemented by Supabase (prod) and a JSON file (local). */
export interface RateRepository {
  /** Most recent stored snapshot per karat (null if none yet). */
  getLatestSnapshots(): Promise<Record<Karat, Snapshot | null>>;
  insertSnapshot(rate: Rate): Promise<void>;
  /** One row per (karat, date); later writes on the same date overwrite. */
  upsertDailyCloses(rows: DailyClose[]): Promise<void>;
  getDailyCloses(): Promise<DailyClose[]>;
  getSnapshots(sinceIso?: string): Promise<Snapshot[]>;
  /** Remove a day's daily closes (all karats). Snapshots are append-only history and stay. */
  deleteDay(date: string): Promise<void>;
  getIngestState(): Promise<IngestState>;
  saveIngestState(state: IngestState): Promise<void>;
}
