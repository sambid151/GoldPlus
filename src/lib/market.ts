export interface MarketQuote {
  id: "usdinr" | "xau";
  label: string;
  note: string;
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  asOf: string;
  /** Recent intraday closes for a sparkline */
  points: number[];
}

interface SymbolSpec {
  id: MarketQuote["id"];
  symbol: string;
  label: string;
  note: string;
}

const SYMBOLS: readonly SymbolSpec[] = [
  { id: "usdinr", symbol: "INR=X", label: "USD/INR", note: "Rupees per US dollar" },
  { id: "xau", symbol: "GC=F", label: "Gold (XAU/USD proxy)", note: "COMEX gold futures, US$ per ounce" },
];

interface ChartResponse {
  chart: {
    result?: {
      meta: { regularMarketPrice: number; chartPreviousClose: number; regularMarketTime: number };
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

/** Pure: shape a Yahoo chart payload into a quote. Throws on missing/invalid data. */
export function toQuote(spec: SymbolSpec, json: ChartResponse): MarketQuote {
  const r = json.chart.result?.[0];
  if (!r) throw new Error(json.chart.error?.description ?? `No data for ${spec.label}`);
  const { regularMarketPrice: price, chartPreviousClose: prev, regularMarketTime: t } = r.meta;
  if (!(price > 0) || !(prev > 0)) throw new Error(`Invalid quote for ${spec.label}`);
  const points = (r.indicators.quote[0]?.close ?? []).filter((v): v is number => typeof v === "number");
  return {
    id: spec.id, label: spec.label, note: spec.note, price, prevClose: prev,
    change: price - prev, changePct: ((price - prev) / prev) * 100,
    asOf: new Date(t * 1000).toISOString(), points: points.slice(-60),
  };
}

async function fetchOne(spec: SymbolSpec): Promise<MarketQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(spec.symbol)}?interval=5m&range=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "GoldPulse/0.1 (personal rate tracker)" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${spec.label}: source responded ${res.status}`);
  return toQuote(spec, (await res.json()) as ChartResponse);
}

/** Each quote settles independently so one failure doesn't blank the other. */
export async function fetchMarket(): Promise<{ quotes: MarketQuote[]; errors: string[] }> {
  const settled = await Promise.allSettled(SYMBOLS.map(fetchOne));
  return {
    quotes: settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : [])),
    errors: settled.flatMap((s) => (s.status === "rejected" ? [String(s.reason?.message ?? s.reason)] : [])),
  };
}

export { SYMBOLS as MARKET_SYMBOLS };
