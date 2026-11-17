"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteDayAction } from "@/app/data/actions";
import { formatRupees } from "@/lib/format";
import { formatIst, formatShortDate } from "@/lib/time";
import { KARATS, type Karat } from "@/lib/types";

export interface DayRow {
  date: string;
  prices: Partial<Record<Karat, number>>;
  source: string;
  /** ISO time last saved, if recorded. */
  updatedAt?: string;
}

export function DayList({ days }: { days: DayRow[] }) {
  const [confirming, setConfirming] = useState<string | null>(null);

  if (days.length === 0) return <p className="text-sm text-muted">No days stored yet. Add one above.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <caption className="sr-only">Stored daily rates, newest first</caption>
        <thead className="bg-surface text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Date</th>
            {KARATS.map((k) => <th key={k} scope="col" className="px-3 py-2 text-right font-medium">{k}</th>)}
            <th scope="col" className="px-3 py-2 font-medium">Source</th>
            <th scope="col" className="px-3 py-2 font-medium">Last updated</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row" className="px-3 py-2 font-medium">{formatShortDate(d.date)} {d.date.slice(0, 4)}</th>
              {KARATS.map((k) => (
                <td key={k} className="num px-3 py-2 text-right">{d.prices[k] ? formatRupees(d.prices[k]!) : "—"}</td>
              ))}
              <td className="px-3 py-2 text-muted">{d.source}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted">{d.updatedAt ? formatIst(d.updatedAt) : "not recorded"}</td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-2">
                  <Link href={`/data?date=${d.date}#add`} className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 font-medium hover:bg-brand-soft">
                    Edit<span className="sr-only"> {d.date}</span>
                  </Link>
                  {confirming === d.date ? (
                    <form action={deleteDayAction} onSubmit={() => setConfirming(null)} className="flex gap-2">
                      <input type="hidden" name="date" value={d.date} />
                      <button type="submit" className="min-h-9 cursor-pointer rounded-lg bg-danger px-3 font-semibold text-on-danger">Delete {d.date}</button>
                      <button type="button" onClick={() => setConfirming(null)} className="min-h-9 cursor-pointer rounded-lg border border-line px-3">Cancel</button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => setConfirming(d.date)} className="min-h-9 cursor-pointer rounded-lg border border-line px-3 font-medium text-down hover:bg-down-soft">
                      Delete<span className="sr-only"> {d.date}</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
