import { promises as fs } from "node:fs";
import path from "node:path";
import {
  EMPTY_INGEST_STATE,
  KARATS,
  type DailyClose,
  type IngestState,
  type Karat,
  type Rate,
  type Snapshot,
} from "@/lib/types";
import type { RateRepository } from "./types";

interface Db {
  snapshots: Snapshot[];
  dailyCloses: DailyClose[];
  state: IngestState;
}

const emptyDb = (): Db => ({ snapshots: [], dailyCloses: [], state: { ...EMPTY_INGEST_STATE } });

/** Local-development store. Not safe for concurrent writers across processes. */
export class FileRateRepository implements RateRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly file = process.env.GOLDPULSE_DATA_FILE || path.join(process.cwd(), ".data", "goldpulse.json"),
  ) {}

  private async read(): Promise<Db> {
    try {
      return { ...emptyDb(), ...JSON.parse(await fs.readFile(this.file, "utf8")) };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyDb();
      throw e;
    }
  }

  /** Serialise read-modify-write cycles within this process. */
  private mutate(fn: (db: Db) => void): Promise<void> {
    const run = async () => {
      const db = await this.read();
      fn(db);
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      // Write a temp file, then rename over the original: a crash mid-write cannot leave a half-written store.
      const tmp = `${this.file}.${process.pid}.tmp`;
      try {
        await fs.writeFile(tmp, JSON.stringify(db, null, 2));
        await fs.rename(tmp, this.file);
      } catch (e) {
        await fs.rm(tmp, { force: true });
        throw e;
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  async getLatestSnapshots(): Promise<Record<Karat, Snapshot | null>> {
    const { snapshots } = await this.read();
    const out = {} as Record<Karat, Snapshot | null>;
    for (const k of KARATS) {
      out[k] = snapshots.filter((s) => s.karat === k).sort(byFetched).at(-1) ?? null;
    }
    return out;
  }

  insertSnapshot(rate: Rate): Promise<void> {
    return this.mutate((db) => void db.snapshots.push({ ...rate }));
  }

  upsertDailyCloses(rows: DailyClose[]): Promise<void> {
    return this.mutate((db) => {
      for (const row of rows) {
        const i = db.dailyCloses.findIndex((d) => d.karat === row.karat && d.date === row.date);
        if (i >= 0) db.dailyCloses[i] = row;
        else db.dailyCloses.push(row);
      }
    });
  }

  deleteDay(date: string): Promise<void> {
    return this.mutate((db) => void (db.dailyCloses = db.dailyCloses.filter((d) => d.date !== date)));
  }

  async getDailyCloses(): Promise<DailyClose[]> {
    return (await this.read()).dailyCloses.sort((a, b) => a.date.localeCompare(b.date));
  }

  async getSnapshots(sinceIso?: string): Promise<Snapshot[]> {
    const { snapshots } = await this.read();
    return snapshots.filter((s) => !sinceIso || s.fetchedAt >= sinceIso).sort(byFetched);
  }

  async getIngestState(): Promise<IngestState> {
    return (await this.read()).state;
  }

  saveIngestState(state: IngestState): Promise<void> {
    return this.mutate((db) => void (db.state = state));
  }
}

const byFetched = (a: Snapshot, b: Snapshot) => a.fetchedAt.localeCompare(b.fetchedAt);
