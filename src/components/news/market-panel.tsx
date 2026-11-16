"use client";

import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { MarketQuote } from "@/lib/market";
import { formatIst } from "@/lib/time";
import { Sparkline } from "@/components/rates/sparkline";
import { Skeleton } from "@/components/ui/states";

interface MarketData {
  quotes: MarketQuote[];
  errors: string[];
}

const REFRESH_MS = 60_000;
const nf = (digits: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function MarketPanel() {
  const [data, setData] = useState<MarketData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      try {
        const res = await fetch("/api/market", { cache: "no-store", signal: ctrl.signal });
        const json = (await res.json()) as MarketData;
        if (!res.ok || json.quotes.length === 0) throw new Error(json.errors?.[0] ?? `Request failed (${res.status})`);
        setData(json);
        setFailed(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed((e as Error).message);
      }
    };
    void run();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, REFRESH_MS);
    return () => {
      ctrl.abort();
      clearInterval(id);
    };
  }, [attempt]);

  return (
    <aside aria-labelledby="market-title" className="rounded-2xl border border-line bg-bg p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="market-title" className="font-semibold">Live market indicators</h3>
          <p className="mt-1 text-xs text-muted">Intraday, refreshed every minute</p>
        </div>
        <span className="shrink-0 rounded-full border border-down/40 bg-warn-bg px-2.5 py-1 text-xs font-semibold text-warn-ink">
          Not the local retail rate
        </span>
      </div>

      <div aria-live="polite">
      {!data && !failed ? (
        <div aria-busy="true" aria-label="Loading market data…" className="mt-5 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {failed && !data ? (
        <div role="alert" className="mt-5 rounded-xl bg-down-soft p-4 text-sm">
          <p className="font-semibold">Market data unavailable</p>
          <p className="mt-1 break-words text-muted">{failed}</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg px-3 font-medium hover:bg-brand-soft">
            <RefreshCw aria-hidden="true" className="size-4" /> Retry
          </button>
        </div>
      ) : null}

      {data ? (
        <ul className="mt-5 space-y-3">
          {data.quotes.map((q) => {
            const up = q.change >= 0;
            const Icon = up ? ArrowUpRight : ArrowDownRight;
            return (
              <li key={q.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{q.label}</p>
                  <Sparkline values={q.points} label={`${q.label} intraday trend`} />
                </div>
                <p className="num mt-1 text-2xl font-semibold">{nf(q.id === "usdinr" ? 3 : 2).format(q.price)}</p>
                <p className={`num mt-1 inline-flex items-center gap-1 text-sm font-semibold ${up ? "text-up" : "text-down"}`}>
                  <Icon aria-hidden="true" className="size-4" />
                  <span className="sr-only">{up ? "up" : "down"}</span>
                  {up ? "+" : "−"}{nf(q.id === "usdinr" ? 3 : 2).format(Math.abs(q.change))} ({up ? "+" : "−"}{Math.abs(q.changePct).toFixed(2)}%)
                </p>
                <p className="mt-1 text-xs text-muted">{q.note} · {formatIst(q.asOf)}</p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {data && failed ? <p role="status" className="mt-3 text-xs text-warn-ink">Refresh failed; showing the last values. {failed}</p> : null}
      {data && data.errors.length > 0 ? <p className="mt-3 text-xs text-muted">Partial data: {data.errors.join("; ")}</p> : null}
      </div>
      <p className="mt-4 text-xs text-muted">
        Factors move together with gold at times; this panel shows correlates, not proven causes of the local rate.
        Gold is a futures proxy and may differ from spot XAU/USD.
      </p>
    </aside>
  );
}
