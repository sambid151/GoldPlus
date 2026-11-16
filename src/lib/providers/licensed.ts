import { z } from "zod";
import { istDate } from "@/lib/time";
import type { Karat, ProviderResult, Rate, RateProvider } from "@/lib/types";

/** Grams per one unit of the vendor's quoted weight. */
const UNIT_GRAMS = { gram: 1, "10gram": 10, kg: 1000, troy_ounce: 31.1034768 } as const;
const PURITY: Record<Karat, number> = { "24K": 1, "22K": 22 / 24, "18K": 18 / 24 };

const configSchema = z
  .object({
    url: z.url().refine((u) => u.startsWith("https://"), "must be https"),
    apiKey: z.string().min(1),
    /** Send the key in this header (e.g. "x-access-token", "Authorization") ... */
    keyHeader: z.string().min(1).optional(),
    /** ... or as this query parameter (e.g. "api_key"). */
    keyParam: z.string().min(1).optional(),
    /** Prepended to the header value, e.g. "Bearer ". */
    keyPrefix: z.string().default(""),
    unit: z.enum(["gram", "10gram", "kg", "troy_ounce"]).default("gram"),
    /** Dot paths into the JSON response, e.g. "data.rates.gold_24k" or "items.0.price". */
    paths: z.object({
      "24K": z.string().min(1),
      "22K": z.string().min(1).optional(),
      "18K": z.string().min(1).optional(),
    }),
    datePath: z.string().min(1).optional(),
    /** Derive a missing 22K/18K from 24K by purity. Marked source "licensed-derived". */
    deriveMissing: z.boolean().default(false),
  })
  .refine((c) => c.keyHeader || c.keyParam, { message: "set LICENSED_KEY_HEADER or LICENSED_KEY_PARAM" });

export type LicensedConfig = z.infer<typeof configSchema>;

export function loadLicensedConfig(env: NodeJS.ProcessEnv = process.env): LicensedConfig {
  const parsed = configSchema.safeParse({
    url: env.LICENSED_API_URL,
    apiKey: env.LICENSED_API_KEY,
    keyHeader: env.LICENSED_KEY_HEADER || undefined,
    keyParam: env.LICENSED_KEY_PARAM || undefined,
    keyPrefix: env.LICENSED_KEY_PREFIX ?? "",
    unit: env.LICENSED_PRICE_UNIT || undefined,
    paths: {
      "24K": env.LICENSED_PATH_24K,
      "22K": env.LICENSED_PATH_22K || undefined,
      "18K": env.LICENSED_PATH_18K || undefined,
    },
    datePath: env.LICENSED_PATH_DATE || undefined,
    deriveMissing: env.LICENSED_DERIVE_MISSING === "true",
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "config"}: ${i.message}`).join("; ");
    throw new Error(`Licensed provider misconfigured: ${issues}`);
  }
  return parsed.data;
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur === null || typeof cur !== "object") return undefined;
    return (cur as Record<string, unknown>)[key];
  }, obj);
}

/** Accepts 13680, "13680.5" and "13,680.50". Anything else is NaN. */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v.replace(/[,\s₹]/g, ""));
  return NaN;
}

function readDate(v: unknown, fallback: string): string {
  if (typeof v === "number") return istDate(new Date(v > 1e11 ? v : v * 1000));
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return istDate(new Date(v));
  return fallback;
}

/** Pure mapping from a vendor JSON body to rates per gram. Throws on anything unusable. */
export function mapLicensedResponse(json: unknown, cfg: LicensedConfig, now: Date = new Date()): ProviderResult {
  const grams = UNIT_GRAMS[cfg.unit];
  const fetchedAt = now.toISOString();
  const date = cfg.datePath ? readDate(getPath(json, cfg.datePath), istDate(now)) : istDate(now);
  const perGram = (karat: Karat): number => {
    const path = cfg.paths[karat];
    return path ? toNumber(getPath(json, path)) / grams : NaN;
  };

  const base = perGram("24K");
  if (!(base > 0)) throw new Error("Licensed API response has no usable 24K price at the configured path");

  const current: Rate[] = (["24K", "22K", "18K"] as const).map((karat) => {
    const direct = perGram(karat);
    const derived = !(direct > 0) && cfg.deriveMissing;
    return {
      karat,
      pricePerGram: Math.round((derived ? base * PURITY[karat] : direct) * 100) / 100,
      date,
      fetchedAt,
      source: derived ? "licensed-derived" : "licensed",
    };
  });
  return { current, history: [] };
}

export class LicensedApiProvider implements RateProvider {
  readonly id = "licensed";

  constructor(
    private readonly cfg: LicensedConfig = loadLicensedConfig(),
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchRates(): Promise<ProviderResult> {
    const url = new URL(this.cfg.url);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.cfg.keyHeader) headers[this.cfg.keyHeader] = `${this.cfg.keyPrefix}${this.cfg.apiKey}`;
    if (this.cfg.keyParam) url.searchParams.set(this.cfg.keyParam, this.cfg.apiKey);

    const res = await this.fetchImpl(url, { headers, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    // Never include the URL in errors: it may carry the API key.
    if (!res.ok) throw new Error(`Licensed API responded ${res.status}`);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new Error("Licensed API returned a non-JSON body");
    }
    return mapLicensedResponse(json, this.cfg);
  }
}
