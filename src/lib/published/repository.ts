import raw from "../../../published/snapshot.json";
import type { RateRepository } from "@/lib/repo/types";
import { EMPTY_INGEST_STATE, KARATS, type DailyClose, type IngestState, type Karat, type Rate, type Snapshot } from "@/lib/types";
import { publishedSchema, type PublishedSnapshot } from "./schema";

const READ_ONLY = "Published data is read-only.";

/** Read-only view over a published snapshot. Every write throws. */
export class PublishedSnapshotRepository implements RateRepository {
  constructor(private readonly data: PublishedSnapshot) {}

  get generatedAt(): string {
    return this.data.generatedAt;
  }

  async getDailyCloses(): Promise<DailyClose[]> {
    return this.data.dailyCloses.map((c) => ({ ...c }));
  }

  async getSnapshots(sinceIso?: string): Promise<Snapshot[]> {
    return this.data.snapshots
      .filter((s) => !sinceIso || s.fetchedAt >= sinceIso)
      .map((s) => ({ karat: s.karat, pricePerGram: s.pricePerGram, date: s.date, fetchedAt: s.fetchedAt, source: s.source }));
  }

  async getLatestSnapshots(): Promise<Record<Karat, Snapshot | null>> {
    const all = await this.getSnapshots();
    const out = {} as Record<Karat, Snapshot | null>;
    for (const k of KARATS) out[k] = all.filter((s) => s.karat === k).at(-1) ?? null;
    return out;
  }

  async getIngestState(): Promise<IngestState> {
    return { ...EMPTY_INGEST_STATE };
  }

  async insertSnapshot(rate: Rate): Promise<void> {
    void rate;
    throw new Error(READ_ONLY);
  }
  async upsertDailyCloses(rows: DailyClose[]): Promise<void> {
    void rows;
    throw new Error(READ_ONLY);
  }
  async deleteDay(date: string): Promise<void> {
    void date;
    throw new Error(READ_ONLY);
  }
  async saveIngestState(state: IngestState): Promise<void> {
    void state;
    throw new Error(READ_ONLY);
  }
}

let cached: PublishedSnapshotRepository | undefined;

/** Loads and validates the bundled snapshot (`published/snapshot.json`). Throws if it is malformed. */
export function getPublishedRepository(): PublishedSnapshotRepository {
  cached ??= new PublishedSnapshotRepository(publishedSchema.parse(raw));
  return cached;
}
