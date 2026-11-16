import type { RateCardData } from "@/lib/dashboard";
import { formatRupees, formatSigned } from "@/lib/format";

const WEIGHTS = [1, 8, 10, 100];

export function RateTable({ cards }: { cards: RateCardData[] }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-bg shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] text-left text-sm sm:text-base">
          <caption className="border-b border-line bg-surface px-4 py-3 text-left text-sm font-semibold">
            Price by weight <span className="font-normal text-muted">— per-gram rate × grams, before making charges and GST</span>
          </caption>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 font-medium">Weight</th>
              {cards.map((c) => (
                <th key={c.karat} scope="col" className="px-4 py-3 text-right font-medium">{c.karat}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {WEIGHTS.map((g) => (
              <tr key={g} className="transition-colors hover:bg-brand-wash">
                <th scope="row" className="px-4 py-3 font-medium">{g} g</th>
                {cards.map((c) => (
                  <td key={c.karat} className="num px-4 py-3 text-right">
                    {formatRupees(c.pricePerGram * g)}
                    {c.change !== null ? (
                      <div className={`text-xs ${c.change > 0 ? "text-up" : c.change < 0 ? "text-down" : "text-muted"}`}>
                        <span className="sr-only">{c.change > 0 ? "Up " : c.change < 0 ? "Down " : "No change "}</span>
                        {formatSigned(c.change * g)}
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
