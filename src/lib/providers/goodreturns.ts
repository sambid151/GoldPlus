import type { ProviderResult, RateProvider } from "@/lib/types";
import { istDate } from "@/lib/time";
import { parseGoodreturns } from "./goodreturns-parser";

const URL = "https://www.goodreturns.in/gold-rates/bhubaneswar.html";
const TIMEOUT_MS = 15_000;

/**
 * Scrapes the public Bhubaneswar rates page.
 * PERSONAL USE ONLY: the site's terms restrict reuse to personal, non-commercial
 * use and bar republishing, so do not deploy this provider publicly.
 * NOTE: the site's Cloudflare currently answers 403 to Node's fetch. Do not work
 * around that; use SavedHtmlProvider (the default) instead.
 */
export class GoodreturnsProvider implements RateProvider {
  readonly id = "goodreturns";

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetchRates(): Promise<ProviderResult> {
    const res = await this.fetchImpl(URL, {
      headers: {
        "User-Agent": "GoldPulse/0.1 (personal rate tracker)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Source responded ${res.status}`);
    const html = await res.text();
    const now = new Date();
    return parseGoodreturns(html, {
      fetchedAt: now.toISOString(),
      todayIst: istDate(now),
      source: this.id,
    });
  }
}
