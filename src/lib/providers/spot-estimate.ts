import { z } from "zod";
import { istDate } from "@/lib/time";
import type { Karat, ProviderResult, Rate, RateProvider } from "@/lib/types";

const URL = "https://xaus.com/api/v1/spot?currency=INR&unit=gram";
const TIMEOUT_MS = 10_000;
/** Reject data whose own timestamp is older than this: cached copies can look fresh. */
export const MAX_DATA_AGE_MS = 60 * 60_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const PURITY: Record<Karat, number> = { "24K": 1, "22K": 22 / 24, "18K": 18 / 24 };

const responseSchema = z.object({
  xau: z.object({
    price: z.number().positive(),
    currency: z.literal("INR"),
    unit: z.literal("gram"),
  }),
  updated_at: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "not a date"),
  // true means the FX feed fell back to a static table; do not trust the conversion.
  fx_stale: z.boolean().optional(),
});

/**
 * Pure: international gold (INR per gram, pure 24K) -> per-karat estimate.
 * This is NOT a retail rate: it excludes import duty, GST and local premium.
 */
export function mapSpotResponse(json: unknown, now: Date = new Date()): ProviderResult {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "response"}: ${i.message}`).join("; ");
    throw new Error(`Spot feed returned an unexpected shape (${issues})`);
  }
  const { xau, updated_at, fx_stale } = parsed.data;
  if (fx_stale) throw new Error("Spot feed is using a stale FX table; refusing to convert");

  const dataTime = new Date(updated_at);
  const age = now.getTime() - dataTime.getTime();
  if (age > MAX_DATA_AGE_MS) throw new Error(`Spot feed data is ${Math.round(age / 60_000)} minutes old`);
  if (age < -MAX_CLOCK_SKEW_MS) throw new Error("Spot feed timestamp is in the future");

  const fetchedAt = dataTime.toISOString();
  const date = istDate(dataTime);
  const current: Rate[] = (["24K", "22K", "18K"] as const).map((karat) => ({
    karat,
    pricePerGram: Math.round(xau.price * PURITY[karat] * 100) / 100,
    date,
    fetchedAt,
    source: "spot-estimate",
  }));
  // No backfill: the feed has no matching historical USD/INR series, so history accumulates from first run.
  return { current, history: [] };
}

/**
 * Keyless international-spot estimate from xaus.com ("free for reasonable use", asks callers to
 * cache >= 60 s; we poll at most every 15 minutes). Prices are indicative mid-market, as-is.
 */
export class SpotEstimateProvider implements RateProvider {
  readonly id = "spot-estimate";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchRates(): Promise<ProviderResult> {
    const res = await this.fetchImpl(URL, {
      headers: { "User-Agent": "GoldPulse/0.1 (gold rate tracker)", Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Spot feed responded ${res.status}`);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error("Spot feed returned a non-JSON body");
    }
    return mapSpotResponse(json);
  }
}
