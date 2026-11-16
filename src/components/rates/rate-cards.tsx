import type { RateCardData } from "@/lib/dashboard";
import { formatRupees } from "@/lib/format";
import { formatShortDate } from "@/lib/time";
import type { DailyClose, Karat } from "@/lib/types";
import { Delta } from "@/components/ui/delta";
import { Sparkline } from "./sparkline";

const PURITY: Record<Karat, string> = { "24K": "99.9% pure", "22K": "91.6% pure", "18K": "75.0% pure" };

function trend(closes: DailyClose[], karat: Karat): number[] {
  return closes.filter((c) => c.karat === karat).slice(-8).map((c) => c.pricePerGram);
}

export function RateCards({ cards, closes }: { cards: RateCardData[]; closes: DailyClose[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {cards.map((c) => (
        <li key={c.karat} className="rounded-xl border border-line bg-bg p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-lg font-semibold">{c.karat}</h3>
            <span className="text-sm text-muted">{PURITY[c.karat]}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <p className="num text-3xl font-semibold tracking-tight sm:text-4xl">
              {formatRupees(c.pricePerGram)}
              <span className="ml-1 text-base font-medium text-muted">/g</span>
            </p>
            <Sparkline values={trend(closes, c.karat)} label={`${c.karat} trend, last ${trend(closes, c.karat).length} days`} />
          </div>
          <div className="mt-3">
            <Delta change={c.change} pct={c.changePct} />
          </div>
          <p className="mt-3 text-sm text-muted">
            Dated {formatShortDate(c.date)}
            {c.prevDate ? `, compared with ${formatShortDate(c.prevDate)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
