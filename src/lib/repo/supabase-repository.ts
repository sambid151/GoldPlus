import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

interface SnapshotRow {
  karat: Karat;
  price_per_gram: number;
  rate_date: string;
  fetched_at: string;
  source: string;
}

const toSnapshot = (r: SnapshotRow): Snapshot => ({
  karat: r.karat,
  pricePerGram: Number(r.price_per_gram),
  date: r.rate_date,
  fetchedAt: r.fetched_at,
  source: r.source,
});

function fail(action: string, error: { message: string } | null): void {
  if (error) throw new Error(`Supabase ${action}: ${error.message}`);
}

export class SupabaseRateRepository implements RateRepository {
  private readonly db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false } });
  }

  async getLatestSnapshots(): Promise<Record<Karat, Snapshot | null>> {
    const out = {} as Record<Karat, Snapshot | null>;
    await Promise.all(
      KARATS.map(async (karat) => {
        const { data, error } = await this.db
          .from("rate_snapshots").select("*").eq("karat", karat)
          .order("fetched_at", { ascending: false }).limit(1);
        fail("latest snapshot", error);
        out[karat] = data?.[0] ? toSnapshot(data[0] as SnapshotRow) : null;
      }),
    );
    return out;
  }

  async insertSnapshot(rate: Rate): Promise<void> {
    const { error } = await this.db.from("rate_snapshots").insert({
      karat: rate.karat, price_per_gram: rate.pricePerGram, rate_date: rate.date,
      fetched_at: rate.fetchedAt, source: rate.source,
    });
    fail("insert snapshot", error);
  }

  async upsertDailyCloses(rows: DailyClose[]): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await this.db.from("daily_closes").upsert(
      rows.map((r) => ({
        karat: r.karat, rate_date: r.date, price_per_gram: r.pricePerGram, source: r.source,
      })),
      { onConflict: "karat,rate_date" },
    );
    fail("upsert daily closes", error);
  }

  async deleteDay(date: string): Promise<void> {
    const { error } = await this.db.from("daily_closes").delete().eq("rate_date", date);
    fail("delete day", error);
  }

  async getDailyCloses(): Promise<DailyClose[]> {
    const { data, error } = await this.db
      .from("daily_closes").select("*").order("rate_date", { ascending: true }).limit(5000);
    fail("daily closes", error);
    return (data ?? []).map((r) => ({
      karat: r.karat as Karat, date: r.rate_date as string,
      pricePerGram: Number(r.price_per_gram), source: r.source as string,
    }));
  }

  async getSnapshots(sinceIso?: string): Promise<Snapshot[]> {
    let q = this.db.from("rate_snapshots").select("*").order("fetched_at", { ascending: true });
    if (sinceIso) q = q.gte("fetched_at", sinceIso);
    const { data, error } = await q.limit(5000);
    fail("snapshots", error);
    return (data ?? []).map((r) => toSnapshot(r as SnapshotRow));
  }

  async getIngestState(): Promise<IngestState> {
    const { data, error } = await this.db.from("ingest_state").select("*").eq("id", 1).maybeSingle();
    fail("ingest state", error);
    if (!data) return { ...EMPTY_INGEST_STATE };
    return {
      lastSuccessAt: data.last_success_at,
      lastAttemptAt: data.last_attempt_at,
      consecutiveFailures: data.consecutive_failures,
      lastError: data.last_error,
      nextRetryAt: data.next_retry_at,
    };
  }

  async saveIngestState(s: IngestState): Promise<void> {
    const { error } = await this.db.from("ingest_state").upsert({
      id: 1, last_success_at: s.lastSuccessAt, last_attempt_at: s.lastAttemptAt,
      consecutive_failures: s.consecutiveFailures, last_error: s.lastError,
      next_retry_at: s.nextRetryAt,
    });
    fail("save ingest state", error);
  }
}
