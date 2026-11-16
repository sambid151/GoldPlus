"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useMemo, useState } from "react";
import { buildHistoryRows, type Move } from "@/lib/history-table";
import { formatPct, formatRupees, formatSigned } from "@/lib/format";
import { formatShortDate } from "@/lib/time";
import { KARATS, type DailyClose, type Karat } from "@/lib/types";

const SIZES = [
  { label: "10 days", count: 10 },
  { label: "30 days", count: 30 },
  { label: "All", count: Infinity },
] as const;

function MoveCell({ move }: { move?: Move }) {
  if (!move) return <span className="text-muted">—</span>;
  const dir = move.change > 0 ? "up" : move.change < 0 ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const tone = dir === "up" ? "text-up" : dir === "down" ? "text-down" : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
      <Icon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{dir === "up" ? "Up" : dir === "down" ? "Down" : "No change"} </span>
      {formatSigned(move.change)} ({formatPct(move.pct)})
    </span>
  );
}

export function HistoryTable({ closes }: { closes: DailyClose[] }) {
  const [size, setSize] = useState<(typeof SIZES)[number]["label"]>("10 days");
  const all = useMemo(() => buildHistoryRows(closes), [closes]);
  const karats = KARATS.filter((k) => closes.some((c) => c.karat === k)) as Karat[];
  const count = SIZES.find((s) => s.label === size)!.count;
  const rows = all.slice(0, count);

  return (
    <div className="rounded-2xl border border-line bg-bg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <h3 className="font-semibold">Daily rates</h3>
        <div role="group" aria-label="Rows to show" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {SIZES.map((s) => (
            <button
              key={s.label}
              type="button"
              aria-pressed={s.label === size}
              onClick={() => setSize(s.label)}
              className={`min-h-9 cursor-pointer rounded-lg px-3 text-sm font-medium transition-colors ${
                s.label === size ? "bg-action text-on-action" : "text-muted hover:bg-brand-soft hover:text-brand-strong"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="sr-only">Price per gram by day, newest first, with the change since the previous day</caption>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Date</th>
              {karats.map((k) => <th key={k} scope="col" className="px-4 py-3 text-right font-medium">{k}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.date} className="transition-colors hover:bg-brand-wash">
                <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium">
                  {formatShortDate(r.date)} {r.date.slice(0, 4)}
                </th>
                {karats.map((k) => (
                  <td key={k} className="num px-4 py-3 text-right">
                    {r.prices[k] ? formatRupees(r.prices[k]!) : "—"}
                    {r.prices[k] ? <div><MoveCell move={r.moves[k]} /></div> : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-3 text-xs text-muted">
        Showing {rows.length} of {all.length} stored days. Change is versus the previous stored day.
      </p>
    </div>
  );
}
