import { buildMonthlySummary } from "@/lib/history-table";
import { formatPct, formatRupees } from "@/lib/format";
import type { DailyClose } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** 24K month-by-month view: needs at least one month with two or more stored days. */
export function MonthlySummary({ closes }: { closes: DailyClose[] }) {
  const months = buildMonthlySummary(closes, "24K").filter((m) => m.days >= 2);
  if (months.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-bg">
      <h3 className="border-b border-line p-4 font-semibold">24K by month</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <caption className="sr-only">24K price per gram: first, last, high and low by month</caption>
          <thead className="text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Month</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">First</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Last</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">High</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Low</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row" className="whitespace-nowrap px-4 py-3 font-medium">{label(m.month)}<span className="font-normal text-muted"> · {m.days} days</span></th>
                <td className="num px-4 py-3 text-right">{formatRupees(m.first)}</td>
                <td className="num px-4 py-3 text-right">{formatRupees(m.last)}</td>
                <td className="num px-4 py-3 text-right">{formatRupees(m.high)}</td>
                <td className="num px-4 py-3 text-right">{formatRupees(m.low)}</td>
                <td className={`num px-4 py-3 text-right font-medium ${m.changePct >= 0 ? "text-up" : "text-down"}`}>{formatPct(m.changePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
